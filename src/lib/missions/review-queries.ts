// server-only: @/lib/supabase/server 참조 → 클라이언트 번들 금지.
//
// 기관 포털 "미션 검토" 페이지용 쿼리 로더.
//   - loadPendingReviews         : SUBMITTED + PENDING_REVIEW (오래된 순)
//   - loadRecentlyApprovedToday  : APPROVED + AUTO_APPROVED (오늘 KST 한정, 최신 30)
//   - loadRecentlyRejected       : REJECTED (최신 limit 개, 기본 30)
//
// 공통 조립 순서:
//   1) org_missions 로드 → 이 기관 미션 id/title/kind/icon/acorns/quest_pack_id 맵
//   2) mission_submissions 쿼리 (status 필터 + org_mission_id IN missionIds)
//   3) user_id / child_id / pack_id 맵 (배치 조회, dedupe)
//   4) in-memory join + waitingMinutes 계산
//
// 실패 정책: 각 함수는 try/catch 로 감싸 실패 시 빈 배열 반환. 에러는 console.error 만.

import { createClient } from "@/lib/supabase/server";
import { startOfTodayKstIso } from "@/lib/time/kst";

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

export interface ReviewSubmissionItem {
  id: string;
  status:
    | "SUBMITTED"
    | "PENDING_REVIEW"
    | "APPROVED"
    | "AUTO_APPROVED"
    | "REJECTED"
    | "REVOKED";
  missionId: string;
  missionTitle: string;
  missionKind: string; // PHOTO, QR_QUIZ, TEXT, LOCATION, ATTENDANCE, RADIO ...
  missionIcon: string | null;
  defaultAcorns: number; // org_missions.acorns
  awardedAcorns: number | null; // mission_submissions.awarded_acorns
  submitterUserId: string;
  submitterDisplayName: string; // "{parent_name} 가족" 또는 "보호자 가족"
  childName: string | null; // app_children.name (submission.child_id 경유)
  submittedAt: string;
  reviewedAt: string | null;
  rejectReason: string | null;
  waitingMinutes: number; // PENDING 만 유의미, 아니면 0
  payload: Record<string, unknown>;
  packName: string | null;
  packId: string | null;
}

/* -------------------------------------------------------------------------- */
/* Local row shapes + Supabase response wrappers                              */
/* -------------------------------------------------------------------------- */

type SbResp<T> = { data: T[] | null; error: unknown };

type OrgMissionLiteRow = {
  id: string;
  title: string;
  kind: string;
  icon: string | null;
  acorns: number;
  quest_pack_id: string | null;
};

type SubmissionRow = {
  id: string;
  org_mission_id: string;
  user_id: string;
  child_id: string | null;
  status: string;
  payload_json: Record<string, unknown> | null;
  awarded_acorns: number | null;
  submitted_at: string;
  reviewed_at: string | null;
  reject_reason: string | null;
};

type AppUserLiteRow = {
  id: string;
  parent_name: string | null;
};

type AppChildLiteRow = {
  id: string;
  name: string;
};

type OrgQuestPackLiteRow = {
  id: string;
  name: string;
};

/* -------------------------------------------------------------------------- */
/* Supabase 에러 로그 정규화                                                  */
/* -------------------------------------------------------------------------- */

function logSbError(tag: string, error: unknown): void {
  if (error && typeof error === "object") {
    const e = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    console.error(`[review-queries/${tag}]`, {
      message: e.message,
      code: e.code,
      details: e.details,
      hint: e.hint,
    });
  } else {
    console.error(`[review-queries/${tag}]`, error);
  }
}

/* -------------------------------------------------------------------------- */
/* 공통 로더: org_missions → 맵                                               */
/* -------------------------------------------------------------------------- */

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function loadOrgMissionMap(
  supabase: SupabaseServerClient,
  orgId: string
): Promise<Map<string, OrgMissionLiteRow>> {
  const resp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<SbResp<OrgMissionLiteRow>>;
      };
    }
  )
    .select("id, title, kind, icon, acorns, quest_pack_id")
    .eq("org_id", orgId)) as SbResp<OrgMissionLiteRow>;

  if (resp.error) {
    logSbError("loadOrgMissionMap", resp.error);
    return new Map();
  }

  const map = new Map<string, OrgMissionLiteRow>();
  for (const m of resp.data ?? []) map.set(m.id, m);
  return map;
}

/* -------------------------------------------------------------------------- */
/* 공통 조립: submissions 배열 → ReviewSubmissionItem[]                       */
/* -------------------------------------------------------------------------- */

async function assembleItems(
  supabase: SupabaseServerClient,
  subs: SubmissionRow[],
  missionMap: Map<string, OrgMissionLiteRow>,
  tag: string,
  computeWaiting: boolean
): Promise<ReviewSubmissionItem[]> {
  if (subs.length === 0) return [];

  // dedupe user/child/pack ids
  const userIds = Array.from(new Set(subs.map((s) => s.user_id).filter(Boolean)));
  const childIds = Array.from(
    new Set(
      subs
        .map((s) => s.child_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    )
  );
  const packIds = Array.from(
    new Set(
      subs
        .map((s) => missionMap.get(s.org_mission_id)?.quest_pack_id ?? null)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    )
  );

  const parentNameMap = new Map<string, string | null>();
  const childNameMap = new Map<string, string>();
  const packNameMap = new Map<string, string>();

  await Promise.all([
    (async () => {
      if (userIds.length === 0) return;
      try {
        const resp = (await (
          supabase.from("app_users" as never) as unknown as {
            select: (c: string) => {
              in: (
                k: string,
                v: string[]
              ) => Promise<SbResp<AppUserLiteRow>>;
            };
          }
        )
          .select("id, parent_name")
          .in("id", userIds)) as SbResp<AppUserLiteRow>;

        if (resp.error) {
          logSbError(`${tag}/users`, resp.error);
          return;
        }
        for (const u of resp.data ?? []) parentNameMap.set(u.id, u.parent_name);
      } catch (e) {
        logSbError(`${tag}/users throw`, e);
      }
    })(),
    (async () => {
      if (childIds.length === 0) return;
      try {
        const resp = (await (
          supabase.from("app_children" as never) as unknown as {
            select: (c: string) => {
              in: (
                k: string,
                v: string[]
              ) => Promise<SbResp<AppChildLiteRow>>;
            };
          }
        )
          .select("id, name")
          .in("id", childIds)) as SbResp<AppChildLiteRow>;

        if (resp.error) {
          logSbError(`${tag}/children`, resp.error);
          return;
        }
        for (const c of resp.data ?? []) childNameMap.set(c.id, c.name);
      } catch (e) {
        logSbError(`${tag}/children throw`, e);
      }
    })(),
    (async () => {
      if (packIds.length === 0) return;
      try {
        const resp = (await (
          supabase.from("org_quest_packs" as never) as unknown as {
            select: (c: string) => {
              in: (
                k: string,
                v: string[]
              ) => Promise<SbResp<OrgQuestPackLiteRow>>;
            };
          }
        )
          .select("id, name")
          .in("id", packIds)) as SbResp<OrgQuestPackLiteRow>;

        if (resp.error) {
          logSbError(`${tag}/packs`, resp.error);
          return;
        }
        for (const p of resp.data ?? []) packNameMap.set(p.id, p.name);
      } catch (e) {
        logSbError(`${tag}/packs throw`, e);
      }
    })(),
  ]);

  const nowMs = Date.now();

  return subs.map((s) => {
    const mission = missionMap.get(s.org_mission_id);
    const packId = mission?.quest_pack_id ?? null;
    const parentName = parentNameMap.get(s.user_id) || "보호자";
    const childName =
      s.child_id && childNameMap.has(s.child_id)
        ? (childNameMap.get(s.child_id) ?? null)
        : null;

    let waitingMinutes = 0;
    if (computeWaiting) {
      const submittedMs = new Date(s.submitted_at).getTime();
      if (Number.isFinite(submittedMs)) {
        waitingMinutes = Math.max(
          0,
          Math.floor((nowMs - submittedMs) / 60000)
        );
      }
    }

    return {
      id: s.id,
      status: s.status as ReviewSubmissionItem["status"],
      missionId: s.org_mission_id,
      missionTitle: mission?.title ?? "(삭제된 미션)",
      missionKind: mission?.kind ?? "",
      missionIcon: mission?.icon ?? null,
      defaultAcorns: mission?.acorns ?? 0,
      awardedAcorns: s.awarded_acorns ?? null,
      submitterUserId: s.user_id,
      submitterDisplayName: `${parentName} 가족`,
      childName,
      submittedAt: s.submitted_at,
      reviewedAt: s.reviewed_at ?? null,
      rejectReason: s.reject_reason ?? null,
      waitingMinutes,
      payload: (s.payload_json ?? {}) as Record<string, unknown>,
      packName: packId ? (packNameMap.get(packId) ?? null) : null,
      packId,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* 1) loadPendingReviews                                                      */
/* -------------------------------------------------------------------------- */

export async function loadPendingReviews(
  orgId: string
): Promise<ReviewSubmissionItem[]> {
  if (!orgId) return [];

  try {
    const supabase = await createClient();
    const missionMap = await loadOrgMissionMap(supabase, orgId);
    if (missionMap.size === 0) return [];

    const missionIds = Array.from(missionMap.keys());

    const subResp = (await (
      supabase.from("mission_submissions" as never) as unknown as {
        select: (c: string) => {
          in: (k: string, v: string[]) => {
            in: (k: string, v: string[]) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => Promise<SbResp<SubmissionRow>>;
            };
          };
        };
      }
    )
      .select(
        "id, org_mission_id, user_id, child_id, status, payload_json, awarded_acorns, submitted_at, reviewed_at, reject_reason"
      )
      .in("org_mission_id", missionIds)
      .in("status", ["SUBMITTED", "PENDING_REVIEW"])
      .order("submitted_at", { ascending: true })) as SbResp<SubmissionRow>;

    if (subResp.error) {
      logSbError("loadPendingReviews/subs", subResp.error);
      return [];
    }

    const subs = subResp.data ?? [];
    return assembleItems(supabase, subs, missionMap, "loadPendingReviews", true);
  } catch (e) {
    logSbError("loadPendingReviews throw", e);
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* 2) loadRecentlyApprovedToday                                               */
/* -------------------------------------------------------------------------- */

export async function loadRecentlyApprovedToday(
  orgId: string
): Promise<ReviewSubmissionItem[]> {
  if (!orgId) return [];

  try {
    const supabase = await createClient();
    const missionMap = await loadOrgMissionMap(supabase, orgId);
    if (missionMap.size === 0) return [];

    const missionIds = Array.from(missionMap.keys());
    const todayIso = startOfTodayKstIso();

    const subResp = (await (
      supabase.from("mission_submissions" as never) as unknown as {
        select: (c: string) => {
          in: (k: string, v: string[]) => {
            in: (k: string, v: string[]) => {
              gte: (
                k: string,
                v: string
              ) => {
                order: (
                  c: string,
                  o: { ascending: boolean }
                ) => {
                  limit: (n: number) => Promise<SbResp<SubmissionRow>>;
                };
              };
            };
          };
        };
      }
    )
      .select(
        "id, org_mission_id, user_id, child_id, status, payload_json, awarded_acorns, submitted_at, reviewed_at, reject_reason"
      )
      .in("org_mission_id", missionIds)
      .in("status", ["APPROVED", "AUTO_APPROVED"])
      .gte("reviewed_at", todayIso)
      .order("reviewed_at", { ascending: false })
      .limit(30)) as SbResp<SubmissionRow>;

    if (subResp.error) {
      logSbError("loadRecentlyApprovedToday/subs", subResp.error);
      return [];
    }

    const subs = subResp.data ?? [];
    return assembleItems(
      supabase,
      subs,
      missionMap,
      "loadRecentlyApprovedToday",
      false
    );
  } catch (e) {
    logSbError("loadRecentlyApprovedToday throw", e);
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* 3) loadRecentlyRejected                                                    */
/* -------------------------------------------------------------------------- */

export async function loadRecentlyRejected(
  orgId: string,
  limit?: number
): Promise<ReviewSubmissionItem[]> {
  if (!orgId) return [];
  const take = typeof limit === "number" && limit > 0 ? limit : 30;

  try {
    const supabase = await createClient();
    const missionMap = await loadOrgMissionMap(supabase, orgId);
    if (missionMap.size === 0) return [];

    const missionIds = Array.from(missionMap.keys());

    const subResp = (await (
      supabase.from("mission_submissions" as never) as unknown as {
        select: (c: string) => {
          in: (k: string, v: string[]) => {
            eq: (k: string, v: string) => {
              order: (
                c: string,
                o: { ascending: boolean; nullsFirst?: boolean }
              ) => {
                limit: (n: number) => Promise<SbResp<SubmissionRow>>;
              };
            };
          };
        };
      }
    )
      .select(
        "id, org_mission_id, user_id, child_id, status, payload_json, awarded_acorns, submitted_at, reviewed_at, reject_reason"
      )
      .in("org_mission_id", missionIds)
      .eq("status", "REJECTED")
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .limit(take)) as SbResp<SubmissionRow>;

    if (subResp.error) {
      logSbError("loadRecentlyRejected/subs", subResp.error);
      return [];
    }

    const subs = subResp.data ?? [];
    return assembleItems(
      supabase,
      subs,
      missionMap,
      "loadRecentlyRejected",
      false
    );
  } catch (e) {
    logSbError("loadRecentlyRejected throw", e);
    return [];
  }
}
