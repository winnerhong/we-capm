// server-only: @/lib/supabase/server 참조 → 클라이언트 번들 금지.
// 기관 포털 홈(`/org/[orgId]`) 대시보드 스냅샷 로더.
//
// 설계 원칙:
//   - 기존 로더 최대 재활용 (control-room snapshot 은 1회만 호출, 결과를 여러 필드가 공유).
//   - 각 서브쿼리는 try/catch 로 실패 격리 — 어느 하나가 터져도 나머지는 정상값 유지.
//   - 새 migration / view 절대 금지. 기존 스키마에서만 집계.

import { createClient } from "@/lib/supabase/server";
import { startOfTodayKstIso } from "@/lib/time/kst";
import { loadControlRoomSnapshot } from "@/lib/control-room/queries";
import { loadOrgEvents, loadOrgEventSummaryById } from "@/lib/org-events/queries";
import { loadOrgQuestPacks } from "@/lib/missions/queries";
import { loadTrailsAssignedToOrg } from "@/lib/trails/queries";
import { loadOrgProfileSnapshot } from "@/lib/profile-completeness/queries";
import { buildOrgProfileSchema } from "@/lib/profile-completeness/schemas/org";
import { calcCompleteness } from "@/lib/profile-completeness/calculator";
import { loadPartnerDisplayNameForOrg } from "@/lib/org-partner";
import type {
  NextActionKind,
  OrgHomeDashboard,
  OrgHomeLiveEvent,
  OrgHomeNextAction,
  OrgHomeRecentParticipant,
} from "./types";

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

/* -------------------------------------------------------------------------- */
/* 시간 경계 헬퍼                                                              */
/*   - "오늘 00:00" 같은 절대 기준점은 정확한 KST 자정을 쓴다 (@/lib/time/kst).  */
/*   - "7일 전" 같은 상대 기준은 now - 7d 가 그대로 정확하므로 유지.            */
/* -------------------------------------------------------------------------- */

function sevenDaysAgoIso(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

const APPROVED_STATUSES = ["APPROVED", "AUTO_APPROVED"] as const;

/* -------------------------------------------------------------------------- */
/* 빈 기본값 (에러 fallback)                                                  */
/* -------------------------------------------------------------------------- */

function emptyDashboard(orgName: string, managerName: string): OrgHomeDashboard {
  return {
    orgName,
    managerName,
    todayStats: {
      participantsTotal: 0,
      participantsAddedToday: 0,
      stampsToday: 0,
      pendingReview: 0,
    },
    profileCompleteness: { percent: 0, done: 0, total: 0 },
    nextAction: null,
    liveEvent: null,
    recentParticipants: [],
    thisWeekSubmissions: 0,
    controlRoomPreview: { fmLive: false, todayActive: 0, todayStamps: 0 },
    resources: {
      stampbooks: { total: 0, live: 0, draft: 0 },
      programs: { total: 0, active: 0 },
      trails: 0,
      partnerMissionCatalog: { total: 0, newThisWeek: 0 },
    },
    fm: {
      mode: "NONE",
      sessionName: null,
      scheduledStart: null,
      scheduledEnd: null,
    },
    partnerNew: {
      partnerName: "지사",
      newPresetsThisWeek: 0,
      newMissionsThisWeek: 0,
    },
    documents: { submitted: 0, required: 5, overdue: 5 },
  };
}

/* -------------------------------------------------------------------------- */
/* 메인 로더                                                                  */
/* -------------------------------------------------------------------------- */

export async function loadOrgHomeDashboard(
  orgId: string,
  orgName: string,
  managerId: string
): Promise<OrgHomeDashboard> {
  if (!orgId) return emptyDashboard(orgName, "운영자");

  // 1) control-room snapshot 1회 호출 (여러 필드 공유 — 중복 호출 금지).
  //    todayStats / controlRoomPreview / liveEvent activityRate / fm 에서 재사용.
  let snapshot: Awaited<ReturnType<typeof loadControlRoomSnapshot>> | null = null;
  try {
    snapshot = await loadControlRoomSnapshot(orgId, orgName);
  } catch (e) {
    console.error("[org-home/loadOrgHomeDashboard] snapshot throw", e);
  }

  // 2) 나머지 병렬 로드.
  const [
    managerName,
    partnerName,
    partnerId,
    events,
    profileResult,
    questPacks,
    programResources,
    trails,
    recentParticipantsData,
    weeklySubmissions,
    documentsInfo,
  ] = await Promise.all([
    loadManagerName(managerId),
    loadPartnerDisplayNameForOrg(orgId).catch(() => "지사"),
    loadPartnerIdForOrg(orgId),
    loadOrgEvents(orgId).catch(() => []),
    loadProfileCompleteness(orgId),
    loadOrgQuestPacks(orgId).catch(() => []),
    loadProgramCounts(orgId),
    loadTrailsAssignedToOrg(orgId).catch(() => []),
    loadRecentParticipantsAndTodayCount(orgId),
    loadWeeklySubmissionsCount(orgId),
    loadDocumentsInfo(orgId),
  ]);

  // 3) partner_id 기반 카탈로그/프리셋 카운트.
  const [catalogCounts, presetCounts] = await Promise.all([
    loadPartnerMissionCatalogCounts(partnerId, orgId),
    loadPartnerPresetCounts(partnerId),
  ]);

  // 4) stampbook 집계.
  const stampbooks = reduceStampbookCounts(questPacks);

  // 5) liveEvent — 첫 LIVE 행사 + 요약.
  const liveEvent = await buildLiveEventFromSnapshot(
    events,
    snapshot?.stamps.participantsSubmittedToday ?? 0
  );

  // 6) FM 요약.
  const fm = buildFmSummary(snapshot);

  // 7) Today stats.
  const pendingReview = snapshot?.pending.total ?? 0;
  const stampsToday = snapshot?.stamps.submissionsToday ?? 0;

  // 8) nextAction 우선순위.
  const nextAction = buildNextAction({
    orgId,
    pendingCount: pendingReview,
    pendingOldestWaitingMinutes: snapshot?.pending.oldestWaitingMinutes ?? null,
    profilePercent: profileResult.percent,
    profileDone: profileResult.done,
    profileTotal: profileResult.total,
    draftEvents: events.filter((e) => e.status === "DRAFT"),
    totalParticipants: snapshot?.totalParticipants ?? 0,
    documentsOverdue: documentsInfo.overdue,
  });

  return {
    orgName,
    managerName,
    todayStats: {
      participantsTotal: snapshot?.totalParticipants ?? 0,
      participantsAddedToday: recentParticipantsData.addedToday,
      stampsToday,
      pendingReview,
    },
    profileCompleteness: {
      percent: profileResult.percent,
      done: profileResult.done,
      total: profileResult.total,
    },
    nextAction,
    liveEvent,
    recentParticipants: recentParticipantsData.recent,
    thisWeekSubmissions: weeklySubmissions,
    controlRoomPreview: {
      fmLive: snapshot?.fm.session?.isLive === true,
      todayActive: snapshot?.todayActiveParticipants ?? 0,
      todayStamps: stampsToday,
    },
    resources: {
      stampbooks,
      programs: programResources,
      trails: trails.length,
      partnerMissionCatalog: catalogCounts,
    },
    fm,
    partnerNew: {
      partnerName,
      newPresetsThisWeek: presetCounts.newThisWeek,
      newMissionsThisWeek: catalogCounts.newThisWeek,
    },
    documents: documentsInfo,
  };
}

/* -------------------------------------------------------------------------- */
/* managerName — partner_orgs.representative_name                             */
/*   managerId 는 partner_orgs.auto_username (text), uuid 아님.                */
/* -------------------------------------------------------------------------- */

async function loadManagerName(managerId: string): Promise<string> {
  if (!managerId) return "운영자";
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("partner_orgs" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<
              SbRespOne<{ representative_name: string | null }>
            >;
          };
        };
      }
    )
      .select("representative_name")
      .eq("auto_username", managerId)
      .maybeSingle()) as SbRespOne<{ representative_name: string | null }>;

    if (resp.error) {
      // Supabase 에러는 non-enumerable 이라 그대로 찍으면 {} 로만 보임 → 명시 추출
      const err = resp.error as {
        message?: string;
        code?: string;
        details?: string;
        hint?: string;
      };
      console.error("[org-home/loadManagerName] error", {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
      });
      return "운영자";
    }
    return resp.data?.representative_name?.trim() || "운영자";
  } catch (e) {
    console.error(
      "[org-home/loadManagerName] throw",
      e instanceof Error ? e.message : e
    );
    return "운영자";
  }
}

/* -------------------------------------------------------------------------- */
/* partner_orgs.partner_id                                                    */
/* -------------------------------------------------------------------------- */

async function loadPartnerIdForOrg(orgId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("partner_orgs" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<
              SbRespOne<{ partner_id: string | null }>
            >;
          };
        };
      }
    )
      .select("partner_id")
      .eq("id", orgId)
      .maybeSingle()) as SbRespOne<{ partner_id: string | null }>;

    if (resp.error) {
      console.error("[org-home/loadPartnerIdForOrg] error", resp.error);
      return null;
    }
    return resp.data?.partner_id ?? null;
  } catch (e) {
    console.error("[org-home/loadPartnerIdForOrg] throw", e);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* 프로필 완성도                                                              */
/* -------------------------------------------------------------------------- */

async function loadProfileCompleteness(
  orgId: string
): Promise<{ percent: number; done: number; total: number }> {
  try {
    const snap = await loadOrgProfileSnapshot(orgId);
    const schema = buildOrgProfileSchema(orgId);
    const result = calcCompleteness(schema, snap);
    return {
      percent: result.percent,
      done: result.completedCount,
      total: result.totalCount,
    };
  } catch (e) {
    console.error("[org-home/loadProfileCompleteness] throw", e);
    return { percent: 0, done: 0, total: 0 };
  }
}

/* -------------------------------------------------------------------------- */
/* 스탬프북 상태 카운트                                                        */
/* -------------------------------------------------------------------------- */

function reduceStampbookCounts(
  packs: Array<{ status: string }>
): { total: number; live: number; draft: number } {
  let live = 0;
  let draft = 0;
  for (const p of packs) {
    if (p.status === "LIVE") live += 1;
    else if (p.status === "DRAFT") draft += 1;
  }
  return { total: packs.length, live, draft };
}

/* -------------------------------------------------------------------------- */
/* 프로그램 카운트 — total + (status != ARCHIVED) count                        */
/* -------------------------------------------------------------------------- */

async function loadProgramCounts(
  orgId: string
): Promise<{ total: number; active: number }> {
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("org_programs" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<SbResp<{ status: string }>>;
        };
      }
    )
      .select("status")
      .eq("org_id", orgId)) as SbResp<{ status: string }>;

    if (resp.error) {
      console.error("[org-home/loadProgramCounts] error", resp.error);
      return { total: 0, active: 0 };
    }
    const rows = resp.data ?? [];
    const active = rows.filter((r) => r.status !== "ARCHIVED").length;
    return { total: rows.length, active };
  } catch (e) {
    console.error("[org-home/loadProgramCounts] throw", e);
    return { total: 0, active: 0 };
  }
}

/* -------------------------------------------------------------------------- */
/* 최근 참가자 5명 + 오늘 가입자 수                                             */
/* -------------------------------------------------------------------------- */

async function loadRecentParticipantsAndTodayCount(
  orgId: string
): Promise<{ recent: OrgHomeRecentParticipant[]; addedToday: number }> {
  try {
    const supabase = await createClient();

    // 1) org 의 event_id 목록
    const evtResp = (await (
      supabase.from("org_events" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<SbResp<{ id: string }>>;
        };
      }
    )
      .select("id")
      .eq("org_id", orgId)) as SbResp<{ id: string }>;

    if (evtResp.error) {
      console.error(
        "[org-home/loadRecentParticipants] events error",
        evtResp.error
      );
      return { recent: [], addedToday: 0 };
    }
    const eventIds = (evtResp.data ?? []).map((r) => r.id);
    if (eventIds.length === 0) return { recent: [], addedToday: 0 };

    // 2) 참가자 joined_at DESC
    const partResp = (await (
      supabase.from("org_event_participants" as never) as unknown as {
        select: (c: string) => {
          in: (k: string, v: string[]) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<
              SbResp<{ user_id: string; joined_at: string }>
            >;
          };
        };
      }
    )
      .select("user_id, joined_at")
      .in("event_id", eventIds)
      .order("joined_at", { ascending: false })) as SbResp<{
      user_id: string;
      joined_at: string;
    }>;

    if (partResp.error) {
      console.error(
        "[org-home/loadRecentParticipants] parts error",
        partResp.error
      );
      return { recent: [], addedToday: 0 };
    }

    const rows = partResp.data ?? [];
    // 정확한 KST 자정 — 새벽 구간에도 "오늘 가입자" 판정이 정확.
    const todayIso = startOfTodayKstIso();

    const todaySet = new Set<string>();
    const seen = new Set<string>();
    const recentCandidates: Array<{ userId: string; joinedAt: string }> = [];

    for (const r of rows) {
      if (!r.user_id) continue;
      if (r.joined_at && r.joined_at >= todayIso) todaySet.add(r.user_id);
      if (!seen.has(r.user_id)) {
        seen.add(r.user_id);
        if (recentCandidates.length < 5) {
          recentCandidates.push({ userId: r.user_id, joinedAt: r.joined_at });
        }
      }
    }

    if (recentCandidates.length === 0) {
      return { recent: [], addedToday: todaySet.size };
    }

    // 3) app_users.parent_name 조인
    const userIds = recentCandidates.map((c) => c.userId);
    const usersResp = (await (
      supabase.from("app_users" as never) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<
            SbResp<{ id: string; parent_name: string | null }>
          >;
        };
      }
    )
      .select("id, parent_name")
      .in("id", userIds)) as SbResp<{
      id: string;
      parent_name: string | null;
    }>;

    const nameMap = new Map<string, string>();
    if (!usersResp.error) {
      for (const u of usersResp.data ?? []) {
        if (u.parent_name) nameMap.set(u.id, u.parent_name);
      }
    } else {
      console.error(
        "[org-home/loadRecentParticipants] users error",
        usersResp.error
      );
    }

    const recent: OrgHomeRecentParticipant[] = recentCandidates.map((c) => {
      const parentName = nameMap.get(c.userId);
      const trimmed = parentName?.trim() || "";
      return {
        userId: c.userId,
        displayName: trimmed ? `${trimmed} 가족` : "보호자 가족",
        joinedAt: c.joinedAt,
        avatarInitial: trimmed ? trimmed.charAt(0) : "🌱",
      };
    });

    return { recent, addedToday: todaySet.size };
  } catch (e) {
    console.error("[org-home/loadRecentParticipants] throw", e);
    return { recent: [], addedToday: 0 };
  }
}

/* -------------------------------------------------------------------------- */
/* 최근 7일 승인 제출 건수                                                      */
/* -------------------------------------------------------------------------- */

async function loadWeeklySubmissionsCount(orgId: string): Promise<number> {
  try {
    const supabase = await createClient();

    // 1) org_missions.id 목록
    const missionsResp = (await (
      supabase.from("org_missions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<SbResp<{ id: string }>>;
        };
      }
    )
      .select("id")
      .eq("org_id", orgId)) as SbResp<{ id: string }>;

    if (missionsResp.error) {
      console.error(
        "[org-home/loadWeeklySubmissions] missions error",
        missionsResp.error
      );
      return 0;
    }
    const missionIds = (missionsResp.data ?? []).map((r) => r.id);
    if (missionIds.length === 0) return 0;

    const sevenDays = sevenDaysAgoIso();

    const subResp = (await (
      supabase.from("mission_submissions" as never) as unknown as {
        select: (c: string) => {
          in: (k: string, v: string[]) => {
            in: (k: string, v: string[]) => {
              gte: (
                k: string,
                v: string
              ) => Promise<SbResp<{ id: string }>>;
            };
          };
        };
      }
    )
      .select("id")
      .in("org_mission_id", missionIds)
      .in("status", APPROVED_STATUSES as unknown as string[])
      .gte("submitted_at", sevenDays)) as SbResp<{ id: string }>;

    if (subResp.error) {
      console.error(
        "[org-home/loadWeeklySubmissions] sub error",
        subResp.error
      );
      return 0;
    }
    return (subResp.data ?? []).length;
  } catch (e) {
    console.error("[org-home/loadWeeklySubmissions] throw", e);
    return 0;
  }
}

/* -------------------------------------------------------------------------- */
/* 파트너 미션 카탈로그 카운트 — visibility=ALL OR (SELECTED+assigned to org)  */
/*   둘 다 status='PUBLISHED' 기준. newThisWeek: created_at >= 7일전.           */
/* -------------------------------------------------------------------------- */

async function loadPartnerMissionCatalogCounts(
  partnerId: string | null,
  orgId: string
): Promise<{ total: number; newThisWeek: number }> {
  if (!partnerId) return { total: 0, newThisWeek: 0 };

  try {
    const supabase = await createClient();

    // 1) ALL visibility
    const allResp = (await (
      supabase.from("partner_missions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              eq: (
                k: string,
                v: string
              ) => Promise<
                SbResp<{ id: string; created_at: string }>
              >;
            };
          };
        };
      }
    )
      .select("id, created_at")
      .eq("partner_id", partnerId)
      .eq("status", "PUBLISHED")
      .eq("visibility", "ALL")) as SbResp<{
      id: string;
      created_at: string;
    }>;

    if (allResp.error) {
      console.error(
        "[org-home/loadCatalog] all visibility error",
        allResp.error
      );
    }
    const allRows = allResp.data ?? [];

    // 2) SELECTED visibility — 이 org 에 할당된 mission_id
    const assignResp = (await (
      supabase.from("partner_mission_assignments" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<
            SbResp<{ mission_id: string }>
          >;
        };
      }
    )
      .select("mission_id")
      .eq("org_id", orgId)) as SbResp<{ mission_id: string }>;

    let selectedRows: Array<{ id: string; created_at: string }> = [];
    if (!assignResp.error) {
      const assignedIds = (assignResp.data ?? [])
        .map((r) => r.mission_id)
        .filter(Boolean);
      if (assignedIds.length > 0) {
        const selResp = (await (
          supabase.from("partner_missions" as never) as unknown as {
            select: (c: string) => {
              eq: (k: string, v: string) => {
                eq: (k: string, v: string) => {
                  eq: (k: string, v: string) => {
                    in: (
                      k: string,
                      v: string[]
                    ) => Promise<
                      SbResp<{ id: string; created_at: string }>
                    >;
                  };
                };
              };
            };
          }
        )
          .select("id, created_at")
          .eq("partner_id", partnerId)
          .eq("status", "PUBLISHED")
          .eq("visibility", "SELECTED")
          .in("id", assignedIds)) as SbResp<{
          id: string;
          created_at: string;
        }>;

        if (selResp.error) {
          console.error(
            "[org-home/loadCatalog] selected error",
            selResp.error
          );
        } else {
          selectedRows = selResp.data ?? [];
        }
      }
    } else {
      console.error("[org-home/loadCatalog] assign error", assignResp.error);
    }

    // 3) 머지 + dedupe (id 단위)
    const idMap = new Map<string, string>(); // id → created_at
    for (const r of allRows) idMap.set(r.id, r.created_at);
    for (const r of selectedRows) idMap.set(r.id, r.created_at);

    const sevenDays = sevenDaysAgoIso();
    let newThisWeek = 0;
    for (const createdAt of idMap.values()) {
      if (createdAt && createdAt >= sevenDays) newThisWeek += 1;
    }

    return { total: idMap.size, newThisWeek };
  } catch (e) {
    console.error("[org-home/loadCatalog] throw", e);
    return { total: 0, newThisWeek: 0 };
  }
}

/* -------------------------------------------------------------------------- */
/* 파트너 프리셋 신규 (근사치)                                                 */
/*   정확한 조건: visibility ∈ (ALL_ORGS, SELECTED_ORGS) AND                  */
/*   (visibility=ALL_ORGS OR grants 에 이 org 존재). 구현 복잡도 감안,         */
/*   MVP 는 partner_id + is_published=true + 7일 내 created_at 로 근사.         */
/*   (공개 의도가 있는 프리셋 범주로 약한 상한.)                                */
/* -------------------------------------------------------------------------- */

async function loadPartnerPresetCounts(
  partnerId: string | null
): Promise<{ newThisWeek: number }> {
  if (!partnerId) return { newThisWeek: 0 };
  try {
    const supabase = await createClient();
    const sevenDays = sevenDaysAgoIso();

    const resp = (await (
      supabase.from("partner_stampbook_presets" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: boolean) => {
              gte: (
                k: string,
                v: string
              ) => Promise<SbResp<{ id: string }>>;
            };
          };
        };
      }
    )
      .select("id")
      .eq("partner_id", partnerId)
      .eq("is_published", true)
      .gte("created_at", sevenDays)) as SbResp<{ id: string }>;

    if (resp.error) {
      console.error("[org-home/loadPresetCounts] error", resp.error);
      return { newThisWeek: 0 };
    }
    return { newThisWeek: (resp.data ?? []).length };
  } catch (e) {
    console.error("[org-home/loadPresetCounts] throw", e);
    return { newThisWeek: 0 };
  }
}

/* -------------------------------------------------------------------------- */
/* 서류 집계                                                                   */
/*   required=5: 기관 프로필 필수 서류 5종 (profile-completeness/schemas/org).  */
/*   submitted: org_documents 에서 status ∈ (APPROVED, PENDING) 인 distinct     */
/*              doc_type 개수 (어떤 상태든 "제출"은 된 상태).                    */
/*   overdue: required - submitted (하한 0).                                   */
/* -------------------------------------------------------------------------- */

async function loadDocumentsInfo(
  orgId: string
): Promise<{ submitted: number; required: number; overdue: number }> {
  const REQUIRED = 5;
  try {
    const supabase = await createClient();

    const resp = (await (
      supabase.from("org_documents" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            in: (
              k: string,
              v: string[]
            ) => Promise<
              SbResp<{ doc_type: string; status: string }>
            >;
          };
        };
      }
    )
      .select("doc_type, status")
      .eq("org_id", orgId)
      .in("status", ["APPROVED", "PENDING"])) as SbResp<{
      doc_type: string;
      status: string;
    }>;

    if (resp.error) {
      console.error("[org-home/loadDocumentsInfo] error", resp.error);
      return { submitted: 0, required: REQUIRED, overdue: REQUIRED };
    }

    const types = new Set<string>();
    for (const row of resp.data ?? []) {
      if (row.doc_type) types.add(row.doc_type);
    }
    const submitted = types.size;
    const overdue = Math.max(0, REQUIRED - submitted);
    return { submitted, required: REQUIRED, overdue };
  } catch (e) {
    console.error("[org-home/loadDocumentsInfo] throw", e);
    return { submitted: 0, required: REQUIRED, overdue: REQUIRED };
  }
}

/* -------------------------------------------------------------------------- */
/* liveEvent — events 중 status='LIVE' 첫 1건 + summary                        */
/* -------------------------------------------------------------------------- */

async function buildLiveEventFromSnapshot(
  events: Array<{
    id: string;
    name: string;
    status: string;
    starts_at: string | null;
    ends_at: string | null;
  }>,
  participantsSubmittedToday: number
): Promise<OrgHomeLiveEvent | null> {
  const live = events.find((e) => e.status === "LIVE");
  if (!live) return null;

  try {
    const summary = await loadOrgEventSummaryById(live.id);

    const participantCount = summary?.participant_count ?? 0;
    // activityRatePct 근사: 오늘 제출 참가자(org 전체) / 해당 행사 참가자 × 100.
    //   - snapshot.stamps.participantsSubmittedToday 는 org 범위 전체라 엄밀한
    //     "해당 행사 참가자" 기준과 다르지만, LIVE 행사 1건 시나리오에서
    //     근사치로 충분. 참가자 0 → 0% 반환.
    const activityRatePct =
      participantCount > 0
        ? Math.min(
            100,
            Math.round((participantsSubmittedToday / participantCount) * 100)
          )
        : 0;

    return {
      id: live.id,
      name: live.name,
      startsAt: live.starts_at ?? summary?.starts_at ?? null,
      endsAt: live.ends_at ?? summary?.ends_at ?? null,
      participantCount,
      questPackCount: summary?.quest_pack_count ?? 0,
      programCount: summary?.program_count ?? 0,
      fmSessionCount: summary?.fm_session_count ?? 0,
      activityRatePct,
    };
  } catch (e) {
    console.error("[org-home/buildLiveEvent] throw", e);
    return {
      id: live.id,
      name: live.name,
      startsAt: live.starts_at,
      endsAt: live.ends_at,
      participantCount: 0,
      questPackCount: 0,
      programCount: 0,
      fmSessionCount: 0,
      activityRatePct: 0,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* FM 요약 — snapshot.fm 재사용                                                */
/* -------------------------------------------------------------------------- */

function buildFmSummary(
  snapshot: Awaited<ReturnType<typeof loadControlRoomSnapshot>> | null
): OrgHomeDashboard["fm"] {
  const session = snapshot?.fm.session ?? null;
  if (!session) {
    return {
      mode: "NONE",
      sessionName: null,
      scheduledStart: null,
      scheduledEnd: null,
    };
  }
  const mode: "LIVE" | "UPCOMING" = session.isLive ? "LIVE" : "UPCOMING";
  return {
    mode,
    sessionName: session.name,
    scheduledStart: session.scheduledStart,
    scheduledEnd: session.scheduledEnd,
  };
}

/* -------------------------------------------------------------------------- */
/* nextAction 우선순위 로직                                                    */
/*   1) PENDING_OLD — 검토 대기 > 0 AND oldest >= 10분                          */
/*   2) PROFILE — 완성도 < 80                                                  */
/*   3) DRAFT_EVENT — DRAFT 행사 1건 이상                                       */
/*   4) NO_PARTICIPANTS — 전체 참가자 0                                         */
/*   5) DOCUMENTS — overdue > 0                                                */
/*   6) else null                                                              */
/*   (BROADCAST_READY 는 MVP 에서 생략 — NextActionKind 에만 유지.)             */
/* -------------------------------------------------------------------------- */

function buildNextAction(ctx: {
  orgId: string;
  pendingCount: number;
  pendingOldestWaitingMinutes: number | null;
  profilePercent: number;
  profileDone: number;
  profileTotal: number;
  draftEvents: Array<{ id: string; name: string }>;
  totalParticipants: number;
  documentsOverdue: number;
}): OrgHomeNextAction | null {
  const base = `/org/${ctx.orgId}`;

  if (
    ctx.pendingCount > 0 &&
    ctx.pendingOldestWaitingMinutes !== null &&
    ctx.pendingOldestWaitingMinutes >= 10
  ) {
    return {
      kind: "PENDING_OLD" as NextActionKind,
      title: `검토 대기 ${ctx.pendingCount}건`,
      description: `가장 오래된 건 ${ctx.pendingOldestWaitingMinutes}분째 기다리는 중`,
      ctaLabel: "검토하기",
      ctaHref: `${base}/missions/review`,
      accent: "amber",
    };
  }

  if (ctx.profilePercent < 80) {
    return {
      kind: "PROFILE" as NextActionKind,
      title: `프로필 완성도 ${ctx.profilePercent}%`,
      description: `${ctx.profileDone}/${ctx.profileTotal} 완료 · 조금만 더!`,
      ctaLabel: "이어서 완성",
      ctaHref: `${base}/settings`,
      accent: "pink",
      progressPct: ctx.profilePercent,
    };
  }

  if (ctx.draftEvents.length > 0) {
    const first = ctx.draftEvents[0];
    return {
      kind: "DRAFT_EVENT" as NextActionKind,
      title: `'${first.name}' 시작 준비 완료`,
      description: "체크리스트를 확인하고 공개해 보세요",
      ctaLabel: "행사 관리",
      ctaHref: `${base}/events/${first.id}`,
      accent: "green",
    };
  }

  if (ctx.totalParticipants === 0) {
    return {
      kind: "NO_PARTICIPANTS" as NextActionKind,
      title: "첫 참가자 초대하기",
      description: "링크만 공유하면 바로 참여할 수 있어요",
      ctaLabel: "참가자 관리",
      ctaHref: `${base}/users`,
      accent: "violet",
    };
  }

  if (ctx.documentsOverdue > 0) {
    return {
      kind: "DOCUMENTS" as NextActionKind,
      title: `제출 안 한 서류 ${ctx.documentsOverdue}건`,
      description: "지사 요구 서류가 남아있어요",
      ctaLabel: "서류함",
      ctaHref: `${base}/documents`,
      accent: "zinc",
    };
  }

  return null;
}
