// server-only: @/lib/supabase/server 참조 → 클라이언트 번들 금지.
// 기관 행사(Event) 데이터 로더들.
//
// 실패 정책: throw 하지 않고 빈 배열/null fallback. resp.error 는 console.error
// 로그만 남긴다. 어디서 호출해도 페이지가 깨지지 않도록.

import { createClient } from "@/lib/supabase/server";
import type {
  OrgEventRow,
  OrgEventSummaryRow,
  OrgEventStatus,
} from "./types";
import type {
  OrgQuestPackRow,
  ToriFmSessionRow,
} from "@/lib/missions/types";

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

type FmSessionLite = {
  id: string;
  title: string | null;
  is_live: boolean;
  scheduled_start: string;
  scheduled_end: string;
};

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 기관의 모든 행사 — status 필터 옵션. created_at DESC.
 */
export async function loadOrgEvents(
  orgId: string,
  status?: OrgEventStatus
): Promise<OrgEventRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  if (status) {
    const resp = (await (
      supabase.from("org_events" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => Promise<SbResp<OrgEventRow>>;
            };
          };
        };
      }
    )
      .select("*")
      .eq("org_id", orgId)
      .eq("status", status)
      .order("created_at", { ascending: false })) as SbResp<OrgEventRow>;

    if (resp.error) {
      console.error("[org-events/loadOrgEvents] error", resp.error);
      return [];
    }
    return resp.data ?? [];
  }

  const resp = (await (
    supabase.from("org_events" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<OrgEventRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })) as SbResp<OrgEventRow>;

  if (resp.error) {
    console.error("[org-events/loadOrgEvents] error", resp.error);
    return [];
  }
  return resp.data ?? [];
}

/**
 * 기관의 행사 + 요약 카운트 — view_org_event_summary 기반.
 * 목록 화면에서 한 번에 카운트까지 가져오고 싶을 때 사용.
 */
export async function loadOrgEventSummaries(
  orgId: string
): Promise<OrgEventSummaryRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("view_org_event_summary" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<OrgEventSummaryRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("org_id", orgId)
    .order("starts_at", { ascending: false })) as SbResp<OrgEventSummaryRow>;

  if (resp.error) {
    console.error("[org-events/loadOrgEventSummaries] error", resp.error);
    return [];
  }
  return resp.data ?? [];
}

/**
 * 단건 요약 조회 — view_org_event_summary 에서 해당 event 1개만.
 * 상세 페이지 개요 탭에서 카운트 한 덩어리만 필요할 때 사용.
 */
export async function loadOrgEventSummaryById(
  eventId: string
): Promise<OrgEventSummaryRow | null> {
  if (!eventId) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("view_org_event_summary" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<OrgEventSummaryRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle()) as SbRespOne<OrgEventSummaryRow>;

  if (resp.error) {
    console.error("[org-events/loadOrgEventSummaryById] error", resp.error);
    return null;
  }
  return resp.data ?? null;
}

/**
 * 초대/참여 페이지용 단건 조회 — org_name 조인.
 * 참가 여부와 무관하게 공개 노출되는 필드만 반환한다.
 *  - 2단계 쿼리 (org_events → partner_orgs) 로 nested select 의존 제거.
 *  - 행사 또는 기관이 없으면 null.
 */
export async function loadOrgEventForJoin(eventId: string): Promise<{
  id: string;
  name: string;
  org_id: string;
  org_name: string;
  starts_at: string | null;
  ends_at: string | null;
  status: OrgEventStatus;
  cover_image_url: string | null;
} | null> {
  if (!eventId) return null;
  const supabase = await createClient();

  type EvtLite = {
    id: string;
    name: string;
    org_id: string;
    starts_at: string | null;
    ends_at: string | null;
    status: OrgEventStatus;
    cover_image_url: string | null;
  };

  const evtResp = (await (
    supabase.from("org_events" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<EvtLite>>;
        };
      };
    }
  )
    .select("id, name, org_id, starts_at, ends_at, status, cover_image_url")
    .eq("id", eventId)
    .maybeSingle()) as SbRespOne<EvtLite>;

  if (evtResp.error) {
    console.error("[org-events/loadOrgEventForJoin] evt error", evtResp.error);
    return null;
  }
  const evt = evtResp.data;
  if (!evt) return null;

  const orgResp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<{ org_name: string | null }>>;
        };
      };
    }
  )
    .select("org_name")
    .eq("id", evt.org_id)
    .maybeSingle()) as SbRespOne<{ org_name: string | null }>;

  if (orgResp.error) {
    console.error("[org-events/loadOrgEventForJoin] org error", orgResp.error);
  }

  return {
    id: evt.id,
    name: evt.name,
    org_id: evt.org_id,
    org_name: orgResp.data?.org_name ?? "",
    starts_at: evt.starts_at,
    ends_at: evt.ends_at,
    status: evt.status,
    cover_image_url: evt.cover_image_url,
  };
}

/**
 * 단건 조회.
 */
export async function loadOrgEventById(
  eventId: string
): Promise<OrgEventRow | null> {
  if (!eventId) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_events" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<OrgEventRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", eventId)
    .maybeSingle()) as SbRespOne<OrgEventRow>;

  if (resp.error) {
    console.error("[org-events/loadOrgEventById] error", resp.error);
    return null;
  }
  return resp.data ?? null;
}

/* -------------------------------------------------------------------------- */
/* Junction tables — ID 배열만 반환 (resource detail 은 호출부가 join)        */
/* -------------------------------------------------------------------------- */

/**
 * 행사에 연결된 스탬프북 ID 들 — sort_order ASC.
 */
export async function loadEventQuestPackIds(
  eventId: string
): Promise<string[]> {
  if (!eventId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_event_quest_packs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<{ quest_pack_id: string }>>;
        };
      };
    }
  )
    .select("quest_pack_id")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })) as SbResp<{
    quest_pack_id: string;
  }>;

  if (resp.error) {
    console.error("[org-events/loadEventQuestPackIds] error", resp.error);
    return [];
  }
  return (resp.data ?? []).map((r) => r.quest_pack_id);
}

/**
 * 행사에 연결된 참가자 user_id 들 — joined_at DESC.
 */
export async function loadEventParticipantIds(
  eventId: string
): Promise<string[]> {
  if (!eventId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<{ user_id: string }>>;
        };
      };
    }
  )
    .select("user_id")
    .eq("event_id", eventId)
    .order("joined_at", { ascending: false })) as SbResp<{ user_id: string }>;

  if (resp.error) {
    console.error("[org-events/loadEventParticipantIds] error", resp.error);
    return [];
  }
  return (resp.data ?? []).map((r) => r.user_id);
}

/**
 * 행사에 연결된 프로그램 ID 들.
 */
export async function loadEventProgramIds(
  eventId: string
): Promise<string[]> {
  if (!eventId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_event_programs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<{ org_program_id: string }>>;
        };
      };
    }
  )
    .select("org_program_id")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })) as SbResp<{
    org_program_id: string;
  }>;

  if (resp.error) {
    console.error("[org-events/loadEventProgramIds] error", resp.error);
    return [];
  }
  return (resp.data ?? []).map((r) => r.org_program_id);
}

/**
 * 행사에 연결된 숲길 ID 들.
 */
export async function loadEventTrailIds(eventId: string): Promise<string[]> {
  if (!eventId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_event_trails" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<{ trail_id: string }>>;
        };
      };
    }
  )
    .select("trail_id")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })) as SbResp<{ trail_id: string }>;

  if (resp.error) {
    console.error("[org-events/loadEventTrailIds] error", resp.error);
    return [];
  }
  return (resp.data ?? []).map((r) => r.trail_id);
}

/**
 * 행사에 연결된 FM 세션들 — tori_fm_sessions.event_id 기준.
 * 요약 필드만 반환해 목록 UI 가 바로 렌더 가능.
 */
export async function loadEventFmSessions(
  eventId: string
): Promise<FmSessionLite[]> {
  if (!eventId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("tori_fm_sessions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<FmSessionLite>>;
        };
      };
    }
  )
    .select("id, title, is_live, scheduled_start, scheduled_end")
    .eq("event_id", eventId)
    .order("scheduled_start", { ascending: false })) as SbResp<FmSessionLite>;

  if (resp.error) {
    console.error("[org-events/loadEventFmSessions] error", resp.error);
    return [];
  }
  return resp.data ?? [];
}

/* -------------------------------------------------------------------------- */
/* Participant-side lookups (Phase 4)                                         */
/* -------------------------------------------------------------------------- */

/**
 * 참가자가 참여 중인 LIVE 행사 목록.
 *  - org_event_participants.user_id = userId
 *  - org_events.status = 'LIVE'
 *  - (starts_at is null OR starts_at <= now) AND (ends_at is null OR ends_at >= now)
 * 2단계 쿼리로 구현 — 첫 쿼리로 event_id 수집, 두 번째 쿼리로 상세 fetch.
 */
export async function loadActiveEventsForUser(
  userId: string
): Promise<OrgEventRow[]> {
  if (!userId) return [];
  const supabase = await createClient();

  // 1단계: 참가자가 들어있는 event_id 수집
  const partResp = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<SbResp<{ event_id: string }>>;
      };
    }
  )
    .select("event_id")
    .eq("user_id", userId)) as SbResp<{ event_id: string }>;

  if (partResp.error) {
    console.error("[org-events/loadActiveEventsForUser] part error", partResp.error);
    return [];
  }
  const eventIds = Array.from(
    new Set((partResp.data ?? []).map((r) => r.event_id).filter(Boolean))
  );
  if (eventIds.length === 0) return [];

  // 2단계: LIVE 상태 행사 fetch
  const evtResp = (await (
    supabase.from("org_events" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => {
          eq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<SbResp<OrgEventRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .in("id", eventIds)
    .eq("status", "LIVE")
    .order("created_at", { ascending: false })) as SbResp<OrgEventRow>;

  if (evtResp.error) {
    console.error("[org-events/loadActiveEventsForUser] evt error", evtResp.error);
    return [];
  }

  // 3단계: starts_at / ends_at 기간 체크 (in-memory)
  const now = Date.now();
  return (evtResp.data ?? []).filter((e) => {
    const startsOk =
      !e.starts_at || new Date(e.starts_at).getTime() <= now;
    const endsOk = !e.ends_at || new Date(e.ends_at).getTime() >= now;
    return startsOk && endsOk;
  });
}

/**
 * 행사에 연결된 LIVE 상태 스탬프북 목록.
 * 2단계 쿼리: quest_pack_id 수집 → org_quest_packs.in + status='LIVE'.
 */
export async function loadLiveQuestPacksForEvent(
  eventId: string
): Promise<OrgQuestPackRow[]> {
  if (!eventId) return [];
  const supabase = await createClient();

  // 1단계: 행사에 묶인 quest_pack_id 수집
  const junctionResp = (await (
    supabase.from("org_event_quest_packs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<{ quest_pack_id: string }>>;
        };
      };
    }
  )
    .select("quest_pack_id")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })) as SbResp<{
    quest_pack_id: string;
  }>;

  if (junctionResp.error) {
    console.error(
      "[org-events/loadLiveQuestPacksForEvent] junction error",
      junctionResp.error
    );
    return [];
  }
  const packIds = (junctionResp.data ?? []).map((r) => r.quest_pack_id);
  if (packIds.length === 0) return [];

  // 2단계: LIVE 상태 pack fetch
  const packResp = (await (
    supabase.from("org_quest_packs" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => {
          eq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<SbResp<OrgQuestPackRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .in("id", packIds)
    .eq("status", "LIVE")
    .order("updated_at", { ascending: false })) as SbResp<OrgQuestPackRow>;

  if (packResp.error) {
    console.error(
      "[org-events/loadLiveQuestPacksForEvent] pack error",
      packResp.error
    );
    return [];
  }
  return packResp.data ?? [];
}

/**
 * 행사의 LIVE FM 세션 단건.
 * tori_fm_sessions.event_id = eventId AND is_live = true, 최신 started_at 하나.
 */
export async function loadLiveFmSessionForEvent(
  eventId: string
): Promise<ToriFmSessionRow | null> {
  if (!eventId) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("tori_fm_sessions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: boolean) => {
            order: (
              c: string,
              o: { ascending: boolean; nullsFirst?: boolean }
            ) => {
              limit: (n: number) => Promise<SbResp<ToriFmSessionRow>>;
            };
          };
        };
      };
    }
  )
    .select("*")
    .eq("event_id", eventId)
    .eq("is_live", true)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)) as SbResp<ToriFmSessionRow>;

  if (resp.error) {
    console.error("[org-events/loadLiveFmSessionForEvent] error", resp.error);
    return null;
  }
  const rows = resp.data ?? [];
  return rows[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Analytics (Phase 5)                                                        */
/* -------------------------------------------------------------------------- */

export interface OrgEventAnalytics {
  // 참가자
  totalParticipants: number;
  activeParticipants: number; // 적어도 1개 제출한 참가자 수
  // 미션
  totalMissions: number; // 이 행사 스탬프북의 총 미션 수
  totalSubmissions: number; // 참가자들의 총 제출 수
  approvedSubmissions: number;
  pendingSubmissions: number;
  rejectedSubmissions: number;
  completionRate: number; // approved / (totalMissions * totalParticipants)
  // 도토리
  totalAcornsAwarded: number;
  avgAcornsPerParticipant: number;
  // FM
  totalFmSessions: number;
  totalFmChatMessages: number;
  totalFmReactions: number;
  // 탑 랭킹
  topParticipants: Array<{
    user_id: string;
    parent_name: string;
    submissions: number;
    acorns: number;
  }>;
  topMissions: Array<{
    mission_id: string;
    title: string;
    icon: string | null;
    kind: string;
    submissionCount: number;
  }>;
}

const EMPTY_ANALYTICS: OrgEventAnalytics = {
  totalParticipants: 0,
  activeParticipants: 0,
  totalMissions: 0,
  totalSubmissions: 0,
  approvedSubmissions: 0,
  pendingSubmissions: 0,
  rejectedSubmissions: 0,
  completionRate: 0,
  totalAcornsAwarded: 0,
  avgAcornsPerParticipant: 0,
  totalFmSessions: 0,
  totalFmChatMessages: 0,
  totalFmReactions: 0,
  topParticipants: [],
  topMissions: [],
};

/**
 * 행사 범위의 성과 집계.
 * "이 행사 참가자 ⋂ 이 행사 스탬프북 미션" 기준으로만 집계.
 * - 참가자 0명: 모든 지표 0, 빈 배열.
 * - 각 하위 쿼리는 개별 fallback(0/빈배열) — 일부 실패해도 나머지 값은 유지.
 */
export async function loadEventAnalytics(
  eventId: string
): Promise<OrgEventAnalytics> {
  if (!eventId) return EMPTY_ANALYTICS;
  const supabase = await createClient();

  // ---- 1) 참가자 IDs ----
  const partResp = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<SbResp<{ user_id: string }>>;
      };
    }
  )
    .select("user_id")
    .eq("event_id", eventId)) as SbResp<{ user_id: string }>;

  if (partResp.error) {
    console.error("[org-events/loadEventAnalytics] part error", partResp.error);
  }
  const userIds = Array.from(
    new Set((partResp.data ?? []).map((r) => r.user_id).filter(Boolean))
  );
  const totalParticipants = userIds.length;

  // ---- 2) 스탬프북 IDs → 미션 IDs ----
  const packIdResp = (await (
    supabase.from("org_event_quest_packs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<SbResp<{ quest_pack_id: string }>>;
      };
    }
  )
    .select("quest_pack_id")
    .eq("event_id", eventId)) as SbResp<{ quest_pack_id: string }>;

  if (packIdResp.error) {
    console.error("[org-events/loadEventAnalytics] pack error", packIdResp.error);
  }
  const packIds = Array.from(
    new Set((packIdResp.data ?? []).map((r) => r.quest_pack_id).filter(Boolean))
  );

  type MissionRow = {
    id: string;
    title: string;
    icon: string | null;
    kind: string;
  };
  let missions: MissionRow[] = [];
  if (packIds.length > 0) {
    const missionsResp = (await (
      supabase.from("org_missions" as never) as unknown as {
        select: (c: string) => {
          in: (k: string, v: string[]) => {
            eq: (k: string, v: boolean) => Promise<SbResp<MissionRow>>;
          };
        };
      }
    )
      .select("id, title, icon, kind")
      .in("quest_pack_id", packIds)
      .eq("is_active", true)) as SbResp<MissionRow>;

    if (missionsResp.error) {
      console.error(
        "[org-events/loadEventAnalytics] missions error",
        missionsResp.error
      );
    } else {
      missions = missionsResp.data ?? [];
    }
  }
  const missionIds = missions.map((m) => m.id);
  const totalMissions = missions.length;
  const missionMap = new Map<string, MissionRow>();
  for (const m of missions) missionMap.set(m.id, m);

  // ---- 3) 제출 조회 (미션 ⋂ 참가자) ----
  type SubRow = {
    org_mission_id: string;
    user_id: string;
    status: string;
    awarded_acorns: number | null;
  };
  let submissions: SubRow[] = [];
  if (missionIds.length > 0 && userIds.length > 0) {
    const subResp = (await (
      supabase.from("mission_submissions" as never) as unknown as {
        select: (c: string) => {
          in: (k: string, v: string[]) => {
            in: (k: string, v: string[]) => Promise<SbResp<SubRow>>;
          };
        };
      }
    )
      .select("org_mission_id, user_id, status, awarded_acorns")
      .in("org_mission_id", missionIds)
      .in("user_id", userIds)) as SbResp<SubRow>;

    if (subResp.error) {
      console.error(
        "[org-events/loadEventAnalytics] submissions error",
        subResp.error
      );
    } else {
      submissions = subResp.data ?? [];
    }
  }

  // ---- 4) 상태별 카운트 / 도토리 집계 (in-memory) ----
  let approvedSubmissions = 0;
  let pendingSubmissions = 0;
  let rejectedSubmissions = 0;
  let totalAcornsAwarded = 0;
  const activeSet = new Set<string>();
  const perUser = new Map<string, { submissions: number; acorns: number }>();
  const perMission = new Map<string, number>();

  for (const s of submissions) {
    activeSet.add(s.user_id);
    // 상태 분류
    if (s.status === "APPROVED" || s.status === "AUTO_APPROVED") {
      approvedSubmissions += 1;
    } else if (s.status === "SUBMITTED" || s.status === "PENDING_REVIEW") {
      pendingSubmissions += 1;
    } else if (s.status === "REJECTED" || s.status === "REVOKED") {
      rejectedSubmissions += 1;
    }
    // 도토리 — awarded_acorns 는 승인 시점에 기록됨
    if (typeof s.awarded_acorns === "number") {
      totalAcornsAwarded += s.awarded_acorns;
    }
    // 탑 랭킹 준비
    const u = perUser.get(s.user_id) ?? { submissions: 0, acorns: 0 };
    u.submissions += 1;
    if (typeof s.awarded_acorns === "number") u.acorns += s.awarded_acorns;
    perUser.set(s.user_id, u);

    perMission.set(s.org_mission_id, (perMission.get(s.org_mission_id) ?? 0) + 1);
  }

  const totalSubmissions = submissions.length;
  const activeParticipants = activeSet.size;
  const completionDenom = totalMissions * totalParticipants;
  const completionRate =
    completionDenom > 0 ? approvedSubmissions / completionDenom : 0;
  const avgAcornsPerParticipant =
    totalParticipants > 0 ? totalAcornsAwarded / totalParticipants : 0;

  // ---- 5) 참가자 이름 맵 (top 5 에 필요한 만큼만 조회) ----
  const topUserIds = [...perUser.entries()]
    .sort((a, b) => {
      if (b[1].submissions !== a[1].submissions) {
        return b[1].submissions - a[1].submissions;
      }
      return b[1].acorns - a[1].acorns;
    })
    .slice(0, 5)
    .map(([id]) => id);

  const nameMap = new Map<string, string>();
  if (topUserIds.length > 0) {
    const usersResp = (await (
      supabase.from("app_users" as never) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<SbResp<{ id: string; parent_name: string }>>;
        };
      }
    )
      .select("id, parent_name")
      .in("id", topUserIds)) as SbResp<{ id: string; parent_name: string }>;

    if (usersResp.error) {
      console.error(
        "[org-events/loadEventAnalytics] users error",
        usersResp.error
      );
    } else {
      for (const u of usersResp.data ?? []) {
        nameMap.set(u.id, u.parent_name);
      }
    }
  }

  const topParticipants = topUserIds.map((id) => {
    const stat = perUser.get(id)!;
    return {
      user_id: id,
      parent_name: nameMap.get(id) ?? "이름 없음",
      submissions: stat.submissions,
      acorns: stat.acorns,
    };
  });

  // ---- 6) 탑 미션 ----
  const topMissions = [...perMission.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([mission_id, submissionCount]) => {
      const m = missionMap.get(mission_id);
      return {
        mission_id,
        title: m?.title ?? "(삭제된 미션)",
        icon: m?.icon ?? null,
        kind: m?.kind ?? "",
        submissionCount,
      };
    });

  // ---- 7) FM 집계 ----
  let totalFmSessions = 0;
  let totalFmChatMessages = 0;
  let totalFmReactions = 0;

  const fmResp = (await (
    supabase.from("tori_fm_sessions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<SbResp<{ id: string }>>;
      };
    }
  )
    .select("id")
    .eq("event_id", eventId)) as SbResp<{ id: string }>;

  if (fmResp.error) {
    console.error("[org-events/loadEventAnalytics] fm error", fmResp.error);
  }
  const sessionIds = (fmResp.data ?? []).map((r) => r.id);
  totalFmSessions = sessionIds.length;

  if (sessionIds.length > 0) {
    // 채팅 — is_deleted=false
    const chatResp = (await (
      supabase.from("tori_fm_chat_messages" as never) as unknown as {
        select: (c: string, opts: { count: "exact"; head: true }) => {
          in: (k: string, v: string[]) => {
            eq: (
              k: string,
              v: boolean
            ) => Promise<{ count: number | null; error: unknown }>;
          };
        };
      }
    )
      .select("id", { count: "exact", head: true })
      .in("session_id", sessionIds)
      .eq("is_deleted", false)) as {
      count: number | null;
      error: unknown;
    };
    if (chatResp.error) {
      console.error(
        "[org-events/loadEventAnalytics] chat error",
        chatResp.error
      );
    }
    totalFmChatMessages = chatResp.count ?? 0;

    // 리액션
    const reactResp = (await (
      supabase.from("tori_fm_reactions" as never) as unknown as {
        select: (c: string, opts: { count: "exact"; head: true }) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<{ count: number | null; error: unknown }>;
        };
      }
    )
      .select("id", { count: "exact", head: true })
      .in("session_id", sessionIds)) as {
      count: number | null;
      error: unknown;
    };
    if (reactResp.error) {
      console.error(
        "[org-events/loadEventAnalytics] react error",
        reactResp.error
      );
    }
    totalFmReactions = reactResp.count ?? 0;
  }

  return {
    totalParticipants,
    activeParticipants,
    totalMissions,
    totalSubmissions,
    approvedSubmissions,
    pendingSubmissions,
    rejectedSubmissions,
    completionRate,
    totalAcornsAwarded,
    avgAcornsPerParticipant,
    totalFmSessions,
    totalFmChatMessages,
    totalFmReactions,
    topParticipants,
    topMissions,
  };
}
