// server-only: @/lib/supabase/server 참조 → 클라이언트 번들 금지.
// 어린이집(조직) 가족 명단 + 가족 상세 조회.
//
// 핵심 테이블:
//   app_users        : 보호자 (org_id, phone, parent_name, acorn_balance ...)
//   app_children     : 자녀 (user_id, name, class_name, is_enrolled, birth_date)
//   mission_submissions : 미션 제출 (user_id, submitted_at, status)
//   user_acorn_transactions : 도토리 원장
//   event_participants → events : 참여 행사

import "server-only";
import { createClient } from "@/lib/supabase/server";

type SbResp<T> = { data: T[] | null; error: { message: string } | null };

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

export interface OrgMemberChild {
  id: string;
  name: string;
  className: string | null;
  isEnrolled: boolean;
  birthDate: string | null;
}

export interface OrgMemberFamily {
  userId: string;
  parentName: string;
  parentPhone: string;
  status: string; // ACTIVE | SUSPENDED | CLOSED
  createdAt: string;
  lastLoginAt: string | null;
  acornBalance: number;
  children: OrgMemberChild[];
  /** 마지막 미션 제출 시각 — null 이면 활동 없음 */
  lastActivityAt: string | null;
  /** 누적 미션 제출 수 (REVOKED 제외) */
  submissionCount: number;
}

export interface OrgMembersResult {
  families: OrgMemberFamily[];
  /** 필터 칩 — 자녀 class_name 유니크 (빈 값 제외) */
  classOptions: string[];
  totalFamilies: number;
  totalChildren: number;
  totalEnrolled: number;
}

export interface OrgMemberSubmissionLite {
  id: string;
  missionTitle: string;
  missionIcon: string | null;
  status: string;
  awardedAcorns: number | null;
  submittedAt: string;
}

export interface OrgMemberEventLite {
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  joinedAt: string | null;
}

export interface OrgMemberAcornTx {
  id: string;
  amount: number;
  reason: string;
  memo: string | null;
  createdAt: string;
}

export interface OrgMemberDetail {
  userId: string;
  parentName: string;
  parentPhone: string;
  status: string;
  acornBalance: number;
  createdAt: string;
  lastLoginAt: string | null;
  children: OrgMemberChild[];
  recentSubmissions: OrgMemberSubmissionLite[];
  participatedEvents: OrgMemberEventLite[];
  recentAcornTx: OrgMemberAcornTx[];
}

/* -------------------------------------------------------------------------- */
/* loadOrgMembers — 명단 페이지용                                              */
/* -------------------------------------------------------------------------- */

type AppUserRow = {
  id: string;
  phone: string;
  parent_name: string;
  status: string;
  acorn_balance: number | null;
  last_login_at: string | null;
  created_at: string;
};

type AppChildRow = {
  id: string;
  user_id: string;
  name: string;
  class_name: string | null;
  is_enrolled: boolean | null;
  birth_date: string | null;
  created_at: string;
};

type SubmissionLiteRow = {
  user_id: string;
  submitted_at: string;
};

/**
 * 조직의 모든 가족 (보호자 + 자녀들) 로드.
 * 검색/필터는 클라이언트에서 처리 — 데이터량 수십~수백 단위 가정.
 */
export async function loadOrgMembers(
  orgId: string
): Promise<OrgMembersResult> {
  const empty: OrgMembersResult = {
    families: [],
    classOptions: [],
    totalFamilies: 0,
    totalChildren: 0,
    totalEnrolled: 0,
  };
  if (!orgId) return empty;

  const supabase = await createClient();

  // 1) 보호자 목록
  const usersResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<AppUserRow>>;
        };
      };
    }
  )
    .select(
      "id, phone, parent_name, status, acorn_balance, last_login_at, created_at"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })) as SbResp<AppUserRow>;

  if (usersResp.error) {
    console.error("[org-members/loadMembers] users err", usersResp.error);
    return empty;
  }
  const users = usersResp.data ?? [];
  if (users.length === 0) return empty;

  const userIds = users.map((u) => u.id);

  // 2) 자녀들 (보호자 chip 표시용) — 한 번에 IN 조회
  const childrenResp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        in: (
          k: string,
          v: string[]
        ) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<AppChildRow>>;
        };
      };
    }
  )
    .select(
      "id, user_id, name, class_name, is_enrolled, birth_date, created_at"
    )
    .in("user_id", userIds)
    .order("created_at", { ascending: true })) as SbResp<AppChildRow>;

  const allChildren = childrenResp.data ?? [];
  const childrenByUser = new Map<string, OrgMemberChild[]>();
  for (const c of allChildren) {
    const arr = childrenByUser.get(c.user_id) ?? [];
    arr.push({
      id: c.id,
      name: c.name,
      className: (c.class_name ?? "").trim() || null,
      isEnrolled: !!c.is_enrolled,
      birthDate: c.birth_date,
    });
    childrenByUser.set(c.user_id, arr);
  }

  // 3) 마지막 활동 시각 + 제출 수 — mission_submissions (REVOKED 제외) batch
  const submissionsResp = (await (
    supabase.from("mission_submissions" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => {
          neq: (
            k: string,
            v: string
          ) => Promise<SbResp<SubmissionLiteRow>>;
        };
      };
    }
  )
    .select("user_id, submitted_at")
    .in("user_id", userIds)
    .neq("status", "REVOKED")) as SbResp<SubmissionLiteRow>;

  const lastActivityByUser = new Map<string, string>();
  const submissionCountByUser = new Map<string, number>();
  for (const s of submissionsResp.data ?? []) {
    const prev = lastActivityByUser.get(s.user_id);
    if (!prev || s.submitted_at > prev) {
      lastActivityByUser.set(s.user_id, s.submitted_at);
    }
    submissionCountByUser.set(
      s.user_id,
      (submissionCountByUser.get(s.user_id) ?? 0) + 1
    );
  }

  // 4) 조립
  const families: OrgMemberFamily[] = users.map((u) => ({
    userId: u.id,
    parentName: u.parent_name,
    parentPhone: u.phone,
    status: u.status,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
    acornBalance: u.acorn_balance ?? 0,
    children: childrenByUser.get(u.id) ?? [],
    lastActivityAt: lastActivityByUser.get(u.id) ?? null,
    submissionCount: submissionCountByUser.get(u.id) ?? 0,
  }));

  // 5) 통계
  let totalChildren = 0;
  let totalEnrolled = 0;
  const classSet = new Set<string>();
  for (const f of families) {
    totalChildren += f.children.length;
    for (const c of f.children) {
      if (c.isEnrolled) totalEnrolled += 1;
      if (c.className) classSet.add(c.className);
    }
  }

  return {
    families,
    classOptions: Array.from(classSet).sort(),
    totalFamilies: families.length,
    totalChildren,
    totalEnrolled,
  };
}

/* -------------------------------------------------------------------------- */
/* loadOrgMemberDetail — 가족 상세 Drawer 용                                   */
/* -------------------------------------------------------------------------- */

type SubmissionDetailRow = {
  id: string;
  org_mission_id: string;
  status: string;
  awarded_acorns: number | null;
  submitted_at: string;
};

type MissionLiteRow = {
  id: string;
  title: string;
  icon: string | null;
};

type AcornTxRow = {
  id: string;
  amount: number;
  reason: string;
  memo: string | null;
  created_at: string;
};

type EventRow = {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
};

type EventParticipantRow = {
  user_id: string;
  event_id: string;
  joined_at: string | null;
};

/**
 * 가족 상세 — Drawer 패널 우측에 보여줄 정보.
 * orgId 검증으로 다른 기관 데이터 접근 차단.
 */
export async function loadOrgMemberDetail(
  orgId: string,
  userId: string
): Promise<OrgMemberDetail | null> {
  if (!orgId || !userId) return null;

  const supabase = await createClient();

  // 1) user — orgId 검증 포함
  const userResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: AppUserRow | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .select(
      "id, phone, parent_name, status, acorn_balance, last_login_at, created_at"
    )
    .eq("id", userId)
    .eq("org_id", orgId)
    .maybeSingle()) as {
    data: AppUserRow | null;
    error: { message: string } | null;
  };

  if (userResp.error) {
    console.error("[org-members/loadDetail] user err", userResp.error);
    return null;
  }
  if (!userResp.data) return null;
  const u = userResp.data;

  // 2) 자녀 + 3) 최근 제출 + 4) 참여 행사 + 5) 도토리 거래 병렬 로드
  const [childrenP, submissionsP, eventsP, acornTxP] = await Promise.all([
    loadChildrenForDetail(supabase, userId),
    loadRecentSubmissionsForDetail(supabase, userId),
    loadParticipatedEventsForDetail(supabase, userId),
    loadRecentAcornTxForDetail(supabase, userId),
  ]);

  return {
    userId: u.id,
    parentName: u.parent_name,
    parentPhone: u.phone,
    status: u.status,
    acornBalance: u.acorn_balance ?? 0,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
    children: childrenP,
    recentSubmissions: submissionsP,
    participatedEvents: eventsP,
    recentAcornTx: acornTxP,
  };
}

async function loadChildrenForDetail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<OrgMemberChild[]> {
  const resp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<AppChildRow>>;
        };
      };
    }
  )
    .select("id, user_id, name, class_name, is_enrolled, birth_date, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })) as SbResp<AppChildRow>;
  const rows = resp.data ?? [];
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    className: (c.class_name ?? "").trim() || null,
    isEnrolled: !!c.is_enrolled,
    birthDate: c.birth_date,
  }));
}

async function loadRecentSubmissionsForDetail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<OrgMemberSubmissionLite[]> {
  const resp = (await (
    supabase.from("mission_submissions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          neq: (
            k: string,
            v: string
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => {
              limit: (n: number) => Promise<SbResp<SubmissionDetailRow>>;
            };
          };
        };
      };
    }
  )
    .select("id, org_mission_id, status, awarded_acorns, submitted_at")
    .eq("user_id", userId)
    .neq("status", "REVOKED")
    .order("submitted_at", { ascending: false })
    .limit(10)) as SbResp<SubmissionDetailRow>;
  const subs = resp.data ?? [];
  if (subs.length === 0) return [];

  // 미션 메타 조회
  const missionIds = Array.from(new Set(subs.map((s) => s.org_mission_id)));
  const missionResp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        in: (
          k: string,
          v: string[]
        ) => Promise<SbResp<MissionLiteRow>>;
      };
    }
  )
    .select("id, title, icon")
    .in("id", missionIds)) as SbResp<MissionLiteRow>;
  const missionMap = new Map<string, MissionLiteRow>();
  for (const m of missionResp.data ?? []) missionMap.set(m.id, m);

  return subs.map((s) => {
    const m = missionMap.get(s.org_mission_id);
    return {
      id: s.id,
      missionTitle: m?.title ?? "(미션)",
      missionIcon: m?.icon ?? null,
      status: s.status,
      awardedAcorns: s.awarded_acorns,
      submittedAt: s.submitted_at,
    };
  });
}

async function loadParticipatedEventsForDetail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<OrgMemberEventLite[]> {
  const partResp = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => Promise<SbResp<EventParticipantRow>>;
      };
    }
  )
    .select("user_id, event_id, joined_at")
    .eq("user_id", userId)) as SbResp<EventParticipantRow>;
  const parts = partResp.data ?? [];
  if (parts.length === 0) return [];

  const eventIds = parts.map((p) => p.event_id);
  const eventResp = (await (
    supabase.from("org_events" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<SbResp<EventRow>>;
      };
    }
  )
    .select("id, name, starts_at, ends_at, status")
    .in("id", eventIds)) as SbResp<EventRow>;
  const eventMap = new Map<string, EventRow>();
  for (const e of eventResp.data ?? []) eventMap.set(e.id, e);

  const out: OrgMemberEventLite[] = [];
  for (const p of parts) {
    const e = eventMap.get(p.event_id);
    if (!e) continue;
    out.push({
      id: e.id,
      name: e.name,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      status: e.status,
      joinedAt: p.joined_at,
    });
  }
  // joinedAt DESC
  out.sort((a, b) => (b.joinedAt ?? "").localeCompare(a.joinedAt ?? ""));
  return out;
}

async function loadRecentAcornTxForDetail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<OrgMemberAcornTx[]> {
  const resp = (await (
    supabase.from("user_acorn_transactions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => {
            limit: (n: number) => Promise<SbResp<AcornTxRow>>;
          };
        };
      };
    }
  )
    .select("id, amount, reason, memo, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(15)) as SbResp<AcornTxRow>;
  return (resp.data ?? []).map((t) => ({
    id: t.id,
    amount: t.amount,
    reason: t.reason,
    memo: t.memo,
    createdAt: t.created_at,
  }));
}
