// server-only: @/lib/supabase/server 참조 → 클라이언트 번들 금지.
// 기관 관제실(Control Room) 대시보드 스냅샷 로더.
//
// 실패 정책: 6개 서브쿼리를 Promise.all 로 병렬 실행하되, 각각 try/catch 로 감싸
// 어느 하나가 실패해도 나머지 필드는 정상값을 유지한다. 에러는 console.error 로만.

import { createClient } from "@/lib/supabase/server";
import { startOfTodayKstIso } from "@/lib/time/kst";
import type {
  ControlRoomAcorns,
  ControlRoomActivityItem,
  ControlRoomBroadcastStat,
  ControlRoomChatMessage,
  ControlRoomFmRequest,
  ControlRoomFmSessionSummary,
  ControlRoomHeatmap,
  ControlRoomHeatmapHour,
  ControlRoomLeaderItem,
  ControlRoomPendingItem,
  ControlRoomSnapshot,
  ControlRoomStamps,
} from "./types";

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

/* -------------------------------------------------------------------------- */
/* 서브쿼리 로컬 타입 (Row shape)                                             */
/* -------------------------------------------------------------------------- */

type OrgEventLiteRow = {
  id: string;
  name: string;
  status: string;
  org_id: string;
};

type ParticipantRow = {
  event_id: string;
  user_id: string;
  joined_at: string;
};

type FmSessionRow = {
  id: string;
  org_id: string;
  name: string;
  scheduled_start: string;
  scheduled_end: string;
  is_live: boolean;
  started_at: string | null;
  ended_at: string | null;
};

type FmRequestRow = {
  id: string;
  session_id: string;
  song_title: string;
  artist: string | null;
  child_name: string | null;
  heart_count: number;
  status: string;
  created_at: string;
};

type FmReactionRow = {
  id: string;
  session_id: string;
  created_at: string;
};

type ChatRoomRow = {
  id: string;
  event_id: string;
  name: string | null;
};

type ChatMessageRow = {
  id: string;
  room_id: string;
  sender_name: string;
  content: string | null;
  is_deleted: boolean;
  created_at: string;
};

type OrgMissionLiteRow = {
  id: string;
  title: string;
  quest_pack_id: string | null;
};

type PendingSubmissionRow = {
  id: string;
  org_mission_id: string;
  user_id: string;
  status: string;
  submitted_at: string;
};

type OrgQuestPackLiteRow = {
  id: string;
  name: string;
};

type AppUserLiteRow = {
  id: string;
  parent_name: string;
};

type OrgMissionFullRow = {
  id: string;
  title: string;
  icon: string | null;
  quest_pack_id: string | null;
};

type OrgQuestPackRow = {
  id: string;
  status: string;
};

type SubmissionRow = {
  id: string;
  org_mission_id: string;
  user_id: string;
  status: string;
  awarded_acorns: number | null;
  submitted_at: string;
};

type AcornTxRow = {
  user_id: string;
  amount: number;
  created_at: string;
};

type AppChildLiteRow = {
  user_id: string;
  name: string;
  created_at: string;
};

type MissionBroadcastLiteRow = {
  id: string;
  org_mission_id: string;
  fires_at: string;
  expires_at: string;
  duration_sec: number;
  cancelled_at: string | null;
};

type BroadcastSubmissionRow = {
  id: string;
  user_id: string;
  submitted_at: string;
  payload_json: Record<string, unknown> | null;
};

/* -------------------------------------------------------------------------- */
/* 공통 헬퍼                                                                  */
/* -------------------------------------------------------------------------- */

// 정확한 KST 자정 경계는 `@/lib/time/kst` 의 startOfTodayKstIso 를 사용한다.
// 과거엔 `now - 24h` 로 근사했으나 자정 직후~새벽 구간에 "오늘" 판정이 어긋나
// 어제 23시 이후 데이터가 오늘로 섞이는 버그가 있었다.

const EMPTY_SNAPSHOT_BASE = {
  liveEventCount: 0,
  liveEventNames: [] as string[],
  todayActiveParticipants: 0,
  totalParticipants: 0,
  fm: {
    session: null as ControlRoomFmSessionSummary | null,
    recentRequests: [] as ControlRoomFmRequest[],
    totalHeartsToday: 0,
    listenersPresence: null as number | null,
  },
  chat: [] as ControlRoomChatMessage[],
  pending: {
    total: 0,
    oldestWaitingMinutes: null as number | null,
    items: [] as ControlRoomPendingItem[],
  },
  stamps: {
    submissionsToday: 0,
    avgPackCompletePct: 0,
    participantsSubmittedToday: 0,
  } as ControlRoomStamps,
  acorns: {
    awardedToday: 0,
    awardedAllTime: 0,
    perHourLast6h: 0,
  } as ControlRoomAcorns,
  activityFeed: [] as ControlRoomActivityItem[],
  leaderboard: [] as ControlRoomLeaderItem[],
  broadcast: {
    sentLast24h: 0,
    avgResponseRatePct: 0,
    avgResponseTimeMinutes: null,
    lastSentAt: null,
    lastSentTitle: null,
  } as ControlRoomBroadcastStat,
  // heatmap 은 호출 시점 기준 24칸을 만들어야 하므로 이 상수엔 포함하지 않는다.
  // 사용부에서 `emptyHeatmap()` 을 호출해 덮어씌운다.
};

const APPROVED_STATUSES = ["APPROVED", "AUTO_APPROVED"] as const;

/* -------------------------------------------------------------------------- */
/* 메인 진입점                                                                */
/* -------------------------------------------------------------------------- */

/**
 * 관제실 스냅샷 로드 — 6개 서브쿼리 병렬 실행.
 * 각 서브쿼리는 독립적으로 실패 격리된다 (어느 하나 실패해도 전체 반환).
 */
export async function loadControlRoomSnapshot(
  orgId: string,
  orgName: string
): Promise<ControlRoomSnapshot> {
  const serverNowIso = new Date().toISOString();

  if (!orgId) {
    return {
      orgName,
      serverNowIso,
      ...EMPTY_SNAPSHOT_BASE,
      heatmap: emptyHeatmap(),
    };
  }

  const supabase = await createClient();
  // 정확한 KST 자정 (새벽 구간에도 "오늘" 판정이 올바름).
  const todayIso = startOfTodayKstIso();
  // 상대 시간(6시간 전, 30일 전)은 그대로 now 기준 뺄셈이 정확.
  const last6hIso = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const last30dIso = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  // 히트맵 윈도우: 지난 24시간(상대 기준, 정확).
  const last24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // participant user_id 목록은 acorns + leaderboard 가 공유 → 1회만 조회.
  // (stamps 의 avgPackCompletePct 계산 시 분모로도 재사용.)
  const participantUserIds = await loadParticipantUserIds(supabase, orgId);

  // 11개 서브쿼리 병렬 실행 — 각각 내부에서 try/catch 로 실패 격리.
  const [
    liveEvents,
    participants,
    fm,
    chat,
    pending,
    stamps,
    acorns,
    activityFeed,
    leaderboard,
    broadcastStats,
    heatmap,
  ] = await Promise.all([
    loadLiveEvents(supabase, orgId),
    loadParticipants(supabase, orgId, todayIso),
    loadFm(supabase, orgId, todayIso),
    loadChat(supabase, orgId),
    loadPending(supabase, orgId),
    loadStamps(supabase, orgId, todayIso, participantUserIds.length),
    loadAcorns(supabase, participantUserIds, todayIso, last6hIso),
    loadActivityFeed(supabase, orgId),
    loadLeaderboard(supabase, participantUserIds, last30dIso),
    loadBroadcastStats(supabase, orgId, todayIso, participantUserIds.length),
    loadHeatmap(supabase, orgId, last24hIso),
  ]);

  return {
    orgName,
    serverNowIso,
    liveEventCount: liveEvents.count,
    liveEventNames: liveEvents.names,
    todayActiveParticipants: participants.todayActive,
    totalParticipants: participants.total,
    fm,
    chat,
    pending,
    stamps,
    acorns,
    activityFeed,
    leaderboard,
    broadcast: broadcastStats,
    heatmap,
  };
}

/* -------------------------------------------------------------------------- */
/* 공용: org 참가자 distinct user_id 전체 (acorns + leaderboard 공유)         */
/* -------------------------------------------------------------------------- */

async function loadParticipantUserIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<string[]> {
  try {
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
        "[control-room/loadParticipantUserIds] events error",
        evtResp.error
      );
      return [];
    }
    const eventIds = (evtResp.data ?? []).map((r) => r.id);
    if (eventIds.length === 0) return [];

    const partResp = (await (
      supabase.from("org_event_participants" as never) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<SbResp<{ user_id: string }>>;
        };
      }
    )
      .select("user_id")
      .in("event_id", eventIds)) as SbResp<{ user_id: string }>;

    if (partResp.error) {
      console.error(
        "[control-room/loadParticipantUserIds] part error",
        partResp.error
      );
      return [];
    }
    const set = new Set<string>();
    for (const r of partResp.data ?? []) {
      if (r.user_id) set.add(r.user_id);
    }
    return Array.from(set);
  } catch (e) {
    console.error("[control-room/loadParticipantUserIds] throw", e);
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* 1) LIVE 행사 카운트 + top 3 이름                                            */
/* -------------------------------------------------------------------------- */

async function loadLiveEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<{ count: number; names: string[] }> {
  try {
    const resp = (await (
      supabase.from("org_events" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => Promise<SbResp<OrgEventLiteRow>>;
            };
          };
        };
      }
    )
      .select("id, name, status, org_id")
      .eq("org_id", orgId)
      .eq("status", "LIVE")
      .order("created_at", { ascending: false })) as SbResp<OrgEventLiteRow>;

    if (resp.error) {
      console.error("[control-room/loadLiveEvents] error", resp.error);
      return { count: 0, names: [] };
    }

    const rows = resp.data ?? [];
    return {
      count: rows.length,
      names: rows.slice(0, 3).map((r) => r.name),
    };
  } catch (e) {
    console.error("[control-room/loadLiveEvents] throw", e);
    return { count: 0, names: [] };
  }
}

/* -------------------------------------------------------------------------- */
/* 2+3) 오늘 활성 참가자 + 전체 참가자 (한 번의 쿼리로 묶음)                    */
/* -------------------------------------------------------------------------- */

async function loadParticipants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  todayIso: string
): Promise<{ todayActive: number; total: number }> {
  try {
    // 1단계: org 에 속한 event_id 목록 (status 무관)
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
      console.error("[control-room/loadParticipants] events error", evtResp.error);
      return { todayActive: 0, total: 0 };
    }
    const eventIds = (evtResp.data ?? []).map((r) => r.id);
    if (eventIds.length === 0) return { todayActive: 0, total: 0 };

    // 2단계: 참가자 전체 로드 (joined_at 까지) — event 필터는 in().
    const partResp = (await (
      supabase.from("org_event_participants" as never) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<SbResp<ParticipantRow>>;
        };
      }
    )
      .select("event_id, user_id, joined_at")
      .in("event_id", eventIds)) as SbResp<ParticipantRow>;

    if (partResp.error) {
      console.error("[control-room/loadParticipants] part error", partResp.error);
      return { todayActive: 0, total: 0 };
    }

    const rows = partResp.data ?? [];
    const totalSet = new Set<string>();
    const todaySet = new Set<string>();
    const todayCutoff = todayIso;

    for (const r of rows) {
      if (!r.user_id) continue;
      totalSet.add(r.user_id);
      if (r.joined_at && r.joined_at >= todayCutoff) {
        todaySet.add(r.user_id);
      }
    }

    return {
      total: totalSet.size,
      todayActive: todaySet.size,
    };
  } catch (e) {
    console.error("[control-room/loadParticipants] throw", e);
    return { todayActive: 0, total: 0 };
  }
}

/* -------------------------------------------------------------------------- */
/* 4) 토리FM 세션 + 신청곡 + 오늘 하트 수                                       */
/* -------------------------------------------------------------------------- */

async function loadFm(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  todayIso: string
): Promise<ControlRoomSnapshot["fm"]> {
  const empty: ControlRoomSnapshot["fm"] = {
    session: null,
    recentRequests: [],
    totalHeartsToday: 0,
    listenersPresence: null,
  };

  try {
    // 4-a) LIVE 세션 우선, 없으면 scheduled_start DESC 최신 1건.
    let session: FmSessionRow | null = null;

    const liveResp = (await (
      supabase.from("tori_fm_sessions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: boolean) => {
              order: (
                c: string,
                o: { ascending: boolean; nullsFirst?: boolean }
              ) => {
                limit: (n: number) => Promise<SbResp<FmSessionRow>>;
              };
            };
          };
        };
      }
    )
      .select(
        "id, org_id, name, scheduled_start, scheduled_end, is_live, started_at, ended_at"
      )
      .eq("org_id", orgId)
      .eq("is_live", true)
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(1)) as SbResp<FmSessionRow>;

    if (liveResp.error) {
      console.error("[control-room/loadFm] live session error", liveResp.error);
    } else {
      session = (liveResp.data ?? [])[0] ?? null;
    }

    if (!session) {
      // fallback: 가장 최근 scheduled_start (예정/종료 어느쪽이든)
      const recentResp = (await (
        supabase.from("tori_fm_sessions" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (n: number) => Promise<SbResp<FmSessionRow>>;
              };
            };
          };
        }
      )
        .select(
          "id, org_id, name, scheduled_start, scheduled_end, is_live, started_at, ended_at"
        )
        .eq("org_id", orgId)
        .order("scheduled_start", { ascending: false })
        .limit(1)) as SbResp<FmSessionRow>;

      if (recentResp.error) {
        console.error(
          "[control-room/loadFm] recent session error",
          recentResp.error
        );
      } else {
        session = (recentResp.data ?? [])[0] ?? null;
      }
    }

    if (!session) return empty;

    const sessionSummary: ControlRoomFmSessionSummary = {
      id: session.id,
      name: session.name,
      isLive: session.is_live,
      scheduledStart: session.scheduled_start,
      scheduledEnd: session.scheduled_end,
    };

    // 4-b) 신청곡 최신 8개
    let recentRequests: ControlRoomFmRequest[] = [];
    try {
      const reqResp = (await (
        supabase.from("tori_fm_requests" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (n: number) => Promise<SbResp<FmRequestRow>>;
              };
            };
          };
        }
      )
        .select(
          "id, session_id, song_title, artist, child_name, heart_count, status, created_at"
        )
        .eq("session_id", session.id)
        .order("created_at", { ascending: false })
        .limit(8)) as SbResp<FmRequestRow>;

      if (reqResp.error) {
        console.error("[control-room/loadFm] requests error", reqResp.error);
      } else {
        recentRequests = (reqResp.data ?? []).map((r) => ({
          id: r.id,
          songTitle: r.song_title,
          artist: r.artist,
          childName: r.child_name,
          heartCount: r.heart_count ?? 0,
          status: r.status,
          createdAt: r.created_at,
        }));
      }
    } catch (e) {
      console.error("[control-room/loadFm] requests throw", e);
    }

    // 4-c) 오늘 하트 (tori_fm_reactions, session_id 매치, created_at >= 오늘)
    let totalHeartsToday = 0;
    try {
      const reactResp = (await (
        supabase.from("tori_fm_reactions" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              gte: (
                k: string,
                v: string
              ) => Promise<SbResp<FmReactionRow>>;
            };
          };
        }
      )
        .select("id, session_id, created_at")
        .eq("session_id", session.id)
        .gte("created_at", todayIso)) as SbResp<FmReactionRow>;

      if (reactResp.error) {
        console.error("[control-room/loadFm] reactions error", reactResp.error);
      } else {
        totalHeartsToday = (reactResp.data ?? []).length;
      }
    } catch (e) {
      console.error("[control-room/loadFm] reactions throw", e);
    }

    return {
      session: sessionSummary,
      recentRequests,
      totalHeartsToday,
      listenersPresence: null, // MVP
    };
  } catch (e) {
    console.error("[control-room/loadFm] throw", e);
    return empty;
  }
}

/* -------------------------------------------------------------------------- */
/* 5) 채팅 최근 20개 — 3단계 조인                                              */
/* -------------------------------------------------------------------------- */

async function loadChat(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<ControlRoomChatMessage[]> {
  try {
    // 1단계: org 소속 event id + name 확보
    const evtResp = (await (
      supabase.from("org_events" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => Promise<SbResp<{ id: string; name: string }>>;
        };
      }
    )
      .select("id, name")
      .eq("org_id", orgId)) as SbResp<{ id: string; name: string }>;

    if (evtResp.error) {
      console.error("[control-room/loadChat] events error", evtResp.error);
      return [];
    }
    const events = evtResp.data ?? [];
    if (events.length === 0) return [];
    const eventIds = events.map((e) => e.id);
    const eventNameMap = new Map<string, string>();
    for (const e of events) eventNameMap.set(e.id, e.name);

    // 2단계: chat_rooms.event_id IN (...) → room 목록
    const roomResp = (await (
      supabase.from("chat_rooms" as never) as unknown as {
        select: (c: string) => {
          in: (k: string, v: string[]) => Promise<SbResp<ChatRoomRow>>;
        };
      }
    )
      .select("id, event_id, name")
      .in("event_id", eventIds)) as SbResp<ChatRoomRow>;

    if (roomResp.error) {
      console.error("[control-room/loadChat] rooms error", roomResp.error);
      return [];
    }
    const rooms = roomResp.data ?? [];
    if (rooms.length === 0) return [];
    const roomIds = rooms.map((r) => r.id);
    const roomMap = new Map<string, ChatRoomRow>();
    for (const r of rooms) roomMap.set(r.id, r);

    // 3단계: chat_messages.room_id IN (...) — 최근 20개, is_deleted=false
    const msgResp = (await (
      supabase.from("chat_messages" as never) as unknown as {
        select: (c: string) => {
          in: (k: string, v: string[]) => {
            eq: (k: string, v: boolean) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (n: number) => Promise<SbResp<ChatMessageRow>>;
              };
            };
          };
        };
      }
    )
      .select("id, room_id, sender_name, content, is_deleted, created_at")
      .in("room_id", roomIds)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(20)) as SbResp<ChatMessageRow>;

    if (msgResp.error) {
      console.error("[control-room/loadChat] messages error", msgResp.error);
      return [];
    }

    const msgs = msgResp.data ?? [];
    return msgs.map((m) => {
      const room = roomMap.get(m.room_id);
      const roomName = room?.name ?? "";
      const eventName = room ? (eventNameMap.get(room.event_id) ?? "") : "";
      return {
        id: m.id,
        roomName,
        eventName,
        senderName: m.sender_name,
        content: m.content ?? "",
        createdAt: m.created_at,
      };
    });
  } catch (e) {
    console.error("[control-room/loadChat] throw", e);
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* 6) 승인 대기 — mission_submissions PENDING_REVIEW                          */
/* -------------------------------------------------------------------------- */

async function loadPending(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<ControlRoomSnapshot["pending"]> {
  try {
    // 1단계: org_missions 의 id / title / quest_pack_id 확보
    const missionsResp = (await (
      supabase.from("org_missions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<SbResp<OrgMissionLiteRow>>;
        };
      }
    )
      .select("id, title, quest_pack_id")
      .eq("org_id", orgId)) as SbResp<OrgMissionLiteRow>;

    if (missionsResp.error) {
      console.error(
        "[control-room/loadPending] missions error",
        missionsResp.error
      );
      return { total: 0, oldestWaitingMinutes: null, items: [] };
    }

    const missions = missionsResp.data ?? [];
    if (missions.length === 0) {
      return { total: 0, oldestWaitingMinutes: null, items: [] };
    }
    const missionIds = missions.map((m) => m.id);
    const missionMap = new Map<string, OrgMissionLiteRow>();
    for (const m of missions) missionMap.set(m.id, m);

    // 2단계: mission_submissions status=PENDING_REVIEW AND org_mission_id IN (...)
    const subResp = (await (
      supabase.from("mission_submissions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            in: (k: string, v: string[]) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => Promise<SbResp<PendingSubmissionRow>>;
            };
          };
        };
      }
    )
      .select("id, org_mission_id, user_id, status, submitted_at")
      .eq("status", "PENDING_REVIEW")
      .in("org_mission_id", missionIds)
      .order("submitted_at", { ascending: true })) as SbResp<PendingSubmissionRow>;

    if (subResp.error) {
      console.error("[control-room/loadPending] subs error", subResp.error);
      return { total: 0, oldestWaitingMinutes: null, items: [] };
    }

    const subs = subResp.data ?? [];
    const total = subs.length;
    const topItems = subs.slice(0, 10);

    // 3단계: 제출자 이름 + 팩 이름 맵 일괄 조회
    const userIds = Array.from(new Set(topItems.map((s) => s.user_id)));
    const packIds = Array.from(
      new Set(
        topItems
          .map((s) => missionMap.get(s.org_mission_id)?.quest_pack_id ?? null)
          .filter((v): v is string => !!v)
      )
    );

    const nameMap = new Map<string, string>();
    const packNameMap = new Map<string, string>();

    await Promise.all([
      (async () => {
        if (userIds.length === 0) return;
        try {
          const usersResp = (await (
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

          if (usersResp.error) {
            console.error(
              "[control-room/loadPending] users error",
              usersResp.error
            );
            return;
          }
          for (const u of usersResp.data ?? []) nameMap.set(u.id, u.parent_name);
        } catch (e) {
          console.error("[control-room/loadPending] users throw", e);
        }
      })(),
      (async () => {
        if (packIds.length === 0) return;
        try {
          const packsResp = (await (
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

          if (packsResp.error) {
            console.error(
              "[control-room/loadPending] packs error",
              packsResp.error
            );
            return;
          }
          for (const p of packsResp.data ?? []) packNameMap.set(p.id, p.name);
        } catch (e) {
          console.error("[control-room/loadPending] packs throw", e);
        }
      })(),
    ]);

    const items: ControlRoomPendingItem[] = topItems.map((s) => {
      const mission = missionMap.get(s.org_mission_id);
      const packId = mission?.quest_pack_id ?? null;
      return {
        id: s.id,
        missionTitle: mission?.title ?? "(삭제된 미션)",
        submitterName: nameMap.get(s.user_id) ?? "",
        submittedAt: s.submitted_at,
        packName: packId ? (packNameMap.get(packId) ?? null) : null,
      };
    });

    const oldestWaitingMinutes =
      items.length > 0
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(items[0].submittedAt).getTime()) / 60000
            )
          )
        : null;

    return { total, oldestWaitingMinutes, items };
  } catch (e) {
    console.error("[control-room/loadPending] throw", e);
    return { total: 0, oldestWaitingMinutes: null, items: [] };
  }
}

/* -------------------------------------------------------------------------- */
/* 7) 스탬프 진행률 (C) — 오늘 승인 제출 수 + 오늘 제출 유저 수 + 평균 완료%   */
/* -------------------------------------------------------------------------- */

async function loadStamps(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  todayIso: string,
  participantCount: number
): Promise<ControlRoomStamps> {
  try {
    // 1) org_missions — 전체 미션 (avgPackCompletePct 분모에 총 미션 수 필요)
    const missionsResp = (await (
      supabase.from("org_missions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<SbResp<OrgMissionFullRow>>;
        };
      }
    )
      .select("id, title, icon, quest_pack_id")
      .eq("org_id", orgId)) as SbResp<OrgMissionFullRow>;

    if (missionsResp.error) {
      console.error(
        "[control-room/loadStamps] missions error",
        missionsResp.error
      );
      return {
        submissionsToday: 0,
        avgPackCompletePct: 0,
        participantsSubmittedToday: 0,
      };
    }
    const missions = missionsResp.data ?? [];
    if (missions.length === 0) {
      return {
        submissionsToday: 0,
        avgPackCompletePct: 0,
        participantsSubmittedToday: 0,
      };
    }
    const missionIds = missions.map((m) => m.id);

    // 2) LIVE pack 목록 — avgPackCompletePct 는 LIVE pack 의 미션들 한정
    const packsResp = (await (
      supabase.from("org_quest_packs" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => Promise<SbResp<OrgQuestPackRow>>;
          };
        };
      }
    )
      .select("id, status")
      .eq("org_id", orgId)
      .eq("status", "LIVE")) as SbResp<OrgQuestPackRow>;

    const livePackIds = new Set(
      (packsResp.data ?? []).map((p) => p.id)
    );
    const livePackMissionIds = missions
      .filter(
        (m) => m.quest_pack_id && livePackIds.has(m.quest_pack_id)
      )
      .map((m) => m.id);

    // 3) 제출 한 번에 로드 — 오늘 APPROVED 제출 + LIVE pack 전체 APPROVED
    //    오늘 제출은 org_mission_id IN missionIds AND status IN APPROVED AND submitted_at >= todayIso
    //    LIVE pack 전체는 org_mission_id IN livePackMissionIds AND status IN APPROVED (기간 제한 없음)
    //    → 두 쿼리로 분리. (in + in 교집합 표현이 Supabase JS 에 없기 때문)

    let submissionsToday = 0;
    let participantsSubmittedToday = 0;

    try {
      const todayResp = (await (
        supabase.from("mission_submissions" as never) as unknown as {
          select: (c: string) => {
            in: (k: string, v: string[]) => {
              in: (k: string, v: string[]) => {
                gte: (
                  k: string,
                  v: string
                ) => Promise<SbResp<SubmissionRow>>;
              };
            };
          };
        }
      )
        .select(
          "id, org_mission_id, user_id, status, awarded_acorns, submitted_at"
        )
        .in("org_mission_id", missionIds)
        .in("status", APPROVED_STATUSES as unknown as string[])
        .gte("submitted_at", todayIso)) as SbResp<SubmissionRow>;

      if (todayResp.error) {
        console.error(
          "[control-room/loadStamps] today subs error",
          todayResp.error
        );
      } else {
        const todaySubs = todayResp.data ?? [];
        submissionsToday = todaySubs.length;
        const userSet = new Set<string>();
        for (const s of todaySubs) {
          if (s.user_id) userSet.add(s.user_id);
        }
        participantsSubmittedToday = userSet.size;
      }
    } catch (e) {
      console.error("[control-room/loadStamps] today throw", e);
    }

    // 4) avgPackCompletePct — 단순화 공식 (주석 참조):
    //    분자: LIVE pack 내 APPROVED 제출 수
    //    분모: 참가자 수 × LIVE pack 의 미션 수
    //    참가자/미션 중 0 이면 0 반환. 대략치.
    let avgPackCompletePct = 0;
    if (
      livePackMissionIds.length > 0 &&
      participantCount > 0
    ) {
      try {
        const liveApprovedResp = (await (
          supabase.from("mission_submissions" as never) as unknown as {
            select: (c: string) => {
              in: (k: string, v: string[]) => {
                in: (
                  k: string,
                  v: string[]
                ) => Promise<SbResp<{ id: string }>>;
              };
            };
          }
        )
          .select("id")
          .in("org_mission_id", livePackMissionIds)
          .in(
            "status",
            APPROVED_STATUSES as unknown as string[]
          )) as SbResp<{ id: string }>;

        if (liveApprovedResp.error) {
          console.error(
            "[control-room/loadStamps] live approved error",
            liveApprovedResp.error
          );
        } else {
          const approvedCount = (liveApprovedResp.data ?? []).length;
          const denom = participantCount * livePackMissionIds.length;
          avgPackCompletePct =
            denom > 0
              ? Math.min(100, Math.round((approvedCount / denom) * 100))
              : 0;
        }
      } catch (e) {
        console.error("[control-room/loadStamps] live approved throw", e);
      }
    }

    return {
      submissionsToday,
      avgPackCompletePct,
      participantsSubmittedToday,
    };
  } catch (e) {
    console.error("[control-room/loadStamps] throw", e);
    return {
      submissionsToday: 0,
      avgPackCompletePct: 0,
      participantsSubmittedToday: 0,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* 8) 도토리 지급 (D) — user_acorn_transactions 집계                           */
/* -------------------------------------------------------------------------- */

async function loadAcorns(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
  todayIso: string,
  last6hIso: string
): Promise<ControlRoomAcorns> {
  const empty: ControlRoomAcorns = {
    awardedToday: 0,
    awardedAllTime: 0,
    perHourLast6h: 0,
  };
  if (userIds.length === 0) return empty;

  try {
    // amount > 0 인 tx 모두 로드 → in-memory 로 세 구간 합산.
    // user_id IN (...) 리스트가 크면 부분적으로 끊어서 호출. (수백~수천 OK)
    const chunkSize = 500;
    const allRows: AcornTxRow[] = [];
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      const resp = (await (
        supabase.from("user_acorn_transactions" as never) as unknown as {
          select: (c: string) => {
            in: (k: string, v: string[]) => {
              gt: (k: string, v: number) => Promise<SbResp<AcornTxRow>>;
            };
          };
        }
      )
        .select("user_id, amount, created_at")
        .in("user_id", chunk)
        .gt("amount", 0)) as SbResp<AcornTxRow>;

      if (resp.error) {
        console.error("[control-room/loadAcorns] chunk error", resp.error);
        continue;
      }
      for (const r of resp.data ?? []) allRows.push(r);
    }

    let awardedToday = 0;
    let awardedAllTime = 0;
    let sumLast6h = 0;
    for (const r of allRows) {
      const amount = r.amount ?? 0;
      if (amount <= 0) continue;
      awardedAllTime += amount;
      if (r.created_at >= todayIso) awardedToday += amount;
      if (r.created_at >= last6hIso) sumLast6h += amount;
    }

    return {
      awardedToday,
      awardedAllTime,
      perHourLast6h: Math.round(sumLast6h / 6),
    };
  } catch (e) {
    console.error("[control-room/loadAcorns] throw", e);
    return empty;
  }
}

/* -------------------------------------------------------------------------- */
/* 9) 활동 피드 (F) — mission_submissions APPROVED 최신 30건                   */
/* -------------------------------------------------------------------------- */

async function loadActivityFeed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<ControlRoomActivityItem[]> {
  try {
    // 1) org_missions id / title / icon 맵
    const missionsResp = (await (
      supabase.from("org_missions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<SbResp<OrgMissionFullRow>>;
        };
      }
    )
      .select("id, title, icon, quest_pack_id")
      .eq("org_id", orgId)) as SbResp<OrgMissionFullRow>;

    if (missionsResp.error) {
      console.error(
        "[control-room/loadActivityFeed] missions error",
        missionsResp.error
      );
      return [];
    }
    const missions = missionsResp.data ?? [];
    if (missions.length === 0) return [];
    const missionIds = missions.map((m) => m.id);
    const missionMap = new Map<string, OrgMissionFullRow>();
    for (const m of missions) missionMap.set(m.id, m);

    // 2) 최신 30개 APPROVED 제출
    const subResp = (await (
      supabase.from("mission_submissions" as never) as unknown as {
        select: (c: string) => {
          in: (k: string, v: string[]) => {
            in: (k: string, v: string[]) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (n: number) => Promise<SbResp<SubmissionRow>>;
              };
            };
          };
        };
      }
    )
      .select(
        "id, org_mission_id, user_id, status, awarded_acorns, submitted_at"
      )
      .in("org_mission_id", missionIds)
      .in("status", APPROVED_STATUSES as unknown as string[])
      .order("submitted_at", { ascending: false })
      .limit(30)) as SbResp<SubmissionRow>;

    if (subResp.error) {
      console.error(
        "[control-room/loadActivityFeed] subs error",
        subResp.error
      );
      return [];
    }
    const subs = subResp.data ?? [];
    if (subs.length === 0) return [];

    // 3) 제출 유저 parent_name 맵
    const userIds = Array.from(new Set(subs.map((s) => s.user_id)));
    const nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      try {
        const usersResp = (await (
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

        if (usersResp.error) {
          console.error(
            "[control-room/loadActivityFeed] users error",
            usersResp.error
          );
        } else {
          for (const u of usersResp.data ?? [])
            nameMap.set(u.id, u.parent_name);
        }
      } catch (e) {
        console.error("[control-room/loadActivityFeed] users throw", e);
      }
    }

    return subs.map((s) => {
      const mission = missionMap.get(s.org_mission_id);
      const parentName = nameMap.get(s.user_id) || "보호자";
      return {
        id: s.id,
        missionTitle: mission?.title ?? "(삭제된 미션)",
        missionIcon: mission?.icon ?? null,
        userDisplayName: `${parentName} 가족`,
        acornsAwarded: s.awarded_acorns ?? 0,
        submittedAt: s.submitted_at,
      };
    });
  } catch (e) {
    console.error("[control-room/loadActivityFeed] throw", e);
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* 10) 리더보드 (G) — 최근 30일 도토리 누적 TOP 10                             */
/* -------------------------------------------------------------------------- */

async function loadLeaderboard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
  last30dIso: string
): Promise<ControlRoomLeaderItem[]> {
  if (userIds.length === 0) return [];

  try {
    // 1) 30일 tx 전부 로드, user_id 별 합산.
    const chunkSize = 500;
    const sumMap = new Map<string, number>();
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      const resp = (await (
        supabase.from("user_acorn_transactions" as never) as unknown as {
          select: (c: string) => {
            in: (k: string, v: string[]) => {
              gt: (k: string, v: number) => {
                gte: (
                  k: string,
                  v: string
                ) => Promise<SbResp<AcornTxRow>>;
              };
            };
          };
        }
      )
        .select("user_id, amount, created_at")
        .in("user_id", chunk)
        .gt("amount", 0)
        .gte("created_at", last30dIso)) as SbResp<AcornTxRow>;

      if (resp.error) {
        console.error(
          "[control-room/loadLeaderboard] chunk error",
          resp.error
        );
        continue;
      }
      for (const r of resp.data ?? []) {
        const prev = sumMap.get(r.user_id) ?? 0;
        sumMap.set(r.user_id, prev + (r.amount ?? 0));
      }
    }

    const sorted = Array.from(sumMap.entries())
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (sorted.length === 0) return [];

    const topUserIds = sorted.map(([uid]) => uid);

    // 2) parent_name + children 일괄 조회
    const nameMap = new Map<string, string>();
    const childrenMap = new Map<string, string[]>();

    await Promise.all([
      (async () => {
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
            .in("id", topUserIds)) as SbResp<AppUserLiteRow>;

          if (resp.error) {
            console.error(
              "[control-room/loadLeaderboard] users error",
              resp.error
            );
            return;
          }
          for (const u of resp.data ?? []) nameMap.set(u.id, u.parent_name);
        } catch (e) {
          console.error("[control-room/loadLeaderboard] users throw", e);
        }
      })(),
      (async () => {
        try {
          const resp = (await (
            supabase.from("app_children" as never) as unknown as {
              select: (c: string) => {
                in: (
                  k: string,
                  v: string[]
                ) => {
                  order: (
                    c: string,
                    o: { ascending: boolean }
                  ) => Promise<SbResp<AppChildLiteRow>>;
                };
              };
            }
          )
            .select("user_id, name, created_at")
            .in("user_id", topUserIds)
            .order("created_at", {
              ascending: true,
            })) as SbResp<AppChildLiteRow>;

          if (resp.error) {
            console.error(
              "[control-room/loadLeaderboard] children error",
              resp.error
            );
            return;
          }
          for (const c of resp.data ?? []) {
            const list = childrenMap.get(c.user_id) ?? [];
            list.push(c.name);
            childrenMap.set(c.user_id, list);
          }
        } catch (e) {
          console.error("[control-room/loadLeaderboard] children throw", e);
        }
      })(),
    ]);

    return sorted.map(([uid, total], idx) => {
      const parentName = nameMap.get(uid) || "보호자";
      const kids = childrenMap.get(uid) ?? [];
      return {
        userId: uid,
        displayName: `${parentName} 가족`,
        childrenLabel: kids.length > 0 ? kids.join(" · ") : null,
        totalAcorns: total,
        rank: idx + 1,
      };
    });
  } catch (e) {
    console.error("[control-room/loadLeaderboard] throw", e);
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* 11) 돌발 미션 현황 (I) — mission_broadcasts + mission_submissions 집계       */
/* -------------------------------------------------------------------------- */

/**
 * 돌발 미션 위젯용 집계.
 *
 * 데이터 소스:
 *   - mission_broadcasts: 발동 이력(fires_at, expires_at, duration_sec, cancelled_at)
 *   - mission_submissions: 응답 (payload_json->>broadcast_id 매칭)
 *
 * 계산 규칙:
 *   - sentLast24h  : fires_at >= 지난24h, triggered_by_org_id = orgId.
 *   - lastSentAt / lastSentTitle: fires_at DESC 최신 1건 + org_missions.title 조인.
 *   - avgResponseRatePct: 지난 24h 발동 건의 "응답률 평균" ≈
 *       mean( broadcast 별 (응답자 수 / 참가자 수) ) * 100.
 *       참가자 수(= participantCount) 는 기관 전체 참가자 (부재 시 0 → 0% 반환).
 *       target_scope=EVENT 인 경우에도 event 단위 참가자 집계가 없어
 *       기관 전체로 근사 — 보고에 명시.
 *   - avgResponseTimeMinutes: mean( response.submitted_at - broadcast.fires_at )
 *       응답이 하나도 없으면 null.
 */
async function loadBroadcastStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  todayIso: string,
  participantCount: number
): Promise<ControlRoomBroadcastStat> {
  const empty: ControlRoomBroadcastStat = {
    sentLast24h: 0,
    avgResponseRatePct: 0,
    avgResponseTimeMinutes: null,
    lastSentAt: null,
    lastSentTitle: null,
  };

  try {
    // 1) 지난 24h 발동 건 로드 (cancelled 포함 — sent 는 "발송 여부" 기준)
    const last24hResp = (await (
      supabase.from("mission_broadcasts" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            gte: (
              k: string,
              v: string
            ) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => Promise<SbResp<MissionBroadcastLiteRow>>;
            };
          };
        };
      }
    )
      .select(
        "id, org_mission_id, fires_at, expires_at, duration_sec, cancelled_at"
      )
      .eq("triggered_by_org_id", orgId)
      .gte("fires_at", todayIso)
      .order("fires_at", {
        ascending: false,
      })) as SbResp<MissionBroadcastLiteRow>;

    if (last24hResp.error) {
      console.error(
        "[control-room/loadBroadcastStats] last24h error",
        last24hResp.error
      );
      // 치명적이지 않음 — 최신 1건은 별도 쿼리로 계속 시도
    }

    const last24hBroadcasts = last24hResp.data ?? [];
    const sentLast24h = last24hBroadcasts.length;

    // 2) 최신 1건 (24h 밖에 있을 수도 있으므로 별도 쿼리)
    let lastSentAt: string | null = null;
    let lastSentTitle: string | null = null;
    let lastMissionId: string | null = null;
    try {
      const latestResp = (await (
        supabase.from("mission_broadcasts" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (
                  n: number
                ) => Promise<
                  SbResp<{ org_mission_id: string; fires_at: string }>
                >;
              };
            };
          };
        }
      )
        .select("org_mission_id, fires_at")
        .eq("triggered_by_org_id", orgId)
        .order("fires_at", { ascending: false })
        .limit(1)) as SbResp<{ org_mission_id: string; fires_at: string }>;

      if (latestResp.error) {
        console.error(
          "[control-room/loadBroadcastStats] latest error",
          latestResp.error
        );
      } else {
        const latest = (latestResp.data ?? [])[0];
        if (latest) {
          lastSentAt = latest.fires_at;
          lastMissionId = latest.org_mission_id;
        }
      }
    } catch (e) {
      console.error("[control-room/loadBroadcastStats] latest throw", e);
    }

    // 3) 최신 1건 미션 title 조회
    if (lastMissionId) {
      try {
        const titleResp = (await (
          supabase.from("org_missions" as never) as unknown as {
            select: (c: string) => {
              eq: (k: string, v: string) => {
                maybeSingle: () => Promise<SbRespOne<{ title: string }>>;
              };
            };
          }
        )
          .select("title")
          .eq("id", lastMissionId)
          .maybeSingle()) as SbRespOne<{ title: string }>;

        if (titleResp.error) {
          console.error(
            "[control-room/loadBroadcastStats] title error",
            titleResp.error
          );
        } else {
          lastSentTitle = titleResp.data?.title ?? null;
        }
      } catch (e) {
        console.error("[control-room/loadBroadcastStats] title throw", e);
      }
    }

    // 24h 발동이 0 이면 응답률/응답시간도 집계할 대상이 없음 → 조기 반환
    if (sentLast24h === 0) {
      return {
        sentLast24h: 0,
        avgResponseRatePct: 0,
        avgResponseTimeMinutes: null,
        lastSentAt,
        lastSentTitle,
      };
    }

    // 4) 해당 미션들의 제출 로드 (payload_json->broadcast_id 로 매핑).
    //    Supabase JS 의 jsonb operator 지원이 제한적이라, 일단 org_mission_id IN (...)
    //    으로 넓게 가져온 뒤 in-memory 에서 payload_json.broadcast_id 로 필터링.
    const broadcastIdSet = new Set(last24hBroadcasts.map((b) => b.id));
    const broadcastById = new Map<string, MissionBroadcastLiteRow>();
    for (const b of last24hBroadcasts) broadcastById.set(b.id, b);
    const missionIds = Array.from(
      new Set(last24hBroadcasts.map((b) => b.org_mission_id))
    );

    // 24h 이내 제출만 잠재적 응답 — broadcast fires_at 보다 이전 제출은 당연히 제외됨.
    // 보수적으로 제출 기준 24h 윈도우.
    const submissionsByBroadcast = new Map<
      string,
      BroadcastSubmissionRow[]
    >();

    if (missionIds.length > 0) {
      try {
        const subsResp = (await (
          supabase.from("mission_submissions" as never) as unknown as {
            select: (c: string) => {
              in: (k: string, v: string[]) => {
                gte: (
                  k: string,
                  v: string
                ) => Promise<SbResp<BroadcastSubmissionRow>>;
              };
            };
          }
        )
          .select("id, user_id, submitted_at, payload_json")
          .in("org_mission_id", missionIds)
          .gte("submitted_at", todayIso)) as SbResp<BroadcastSubmissionRow>;

        if (subsResp.error) {
          console.error(
            "[control-room/loadBroadcastStats] subs error",
            subsResp.error
          );
        } else {
          for (const s of subsResp.data ?? []) {
            const payload = (s.payload_json ?? {}) as {
              broadcast_id?: unknown;
            };
            const bid =
              typeof payload.broadcast_id === "string"
                ? payload.broadcast_id
                : null;
            if (!bid || !broadcastIdSet.has(bid)) continue;
            const list = submissionsByBroadcast.get(bid) ?? [];
            list.push(s);
            submissionsByBroadcast.set(bid, list);
          }
        }
      } catch (e) {
        console.error("[control-room/loadBroadcastStats] subs throw", e);
      }
    }

    // 5) 응답률 / 응답시간 집계
    let rateSum = 0;
    let rateCount = 0;
    let timeSumMinutes = 0;
    let timeCount = 0;

    for (const b of last24hBroadcasts) {
      const subs = submissionsByBroadcast.get(b.id) ?? [];

      // distinct user 응답자 수 (중복 제출 같은 유저는 1 로 카운트)
      const responderSet = new Set<string>();
      for (const s of subs) {
        if (s.user_id) responderSet.add(s.user_id);
      }
      const responders = responderSet.size;

      // 응답률: participantCount 가 0 이면 해당 broadcast 는 스킵 (분모 0)
      if (participantCount > 0) {
        const rate = Math.min(1, responders / participantCount);
        rateSum += rate;
        rateCount += 1;
      }

      // 응답시간: broadcast.fires_at 과 각 제출 submitted_at 차이(분). 음수는 버림.
      const firedMs = new Date(b.fires_at).getTime();
      for (const s of subs) {
        const submittedMs = new Date(s.submitted_at).getTime();
        const diffMs = submittedMs - firedMs;
        if (diffMs <= 0 || !Number.isFinite(diffMs)) continue;
        timeSumMinutes += diffMs / 60000;
        timeCount += 1;
      }
    }

    const avgResponseRatePct =
      rateCount > 0 ? Math.round((rateSum / rateCount) * 100) : 0;
    const avgResponseTimeMinutes =
      timeCount > 0 ? Math.round(timeSumMinutes / timeCount) : null;

    return {
      sentLast24h,
      avgResponseRatePct,
      avgResponseTimeMinutes,
      lastSentAt,
      lastSentTitle,
    };
  } catch (e) {
    console.error("[control-room/loadBroadcastStats] throw", e);
    return empty;
  }
}

/* -------------------------------------------------------------------------- */
/* 12) 활동 히트맵 (K) — 지난 24시간 시간대별 APPROVED 제출 분포                  */
/* -------------------------------------------------------------------------- */

/**
 * submitted_at 의 KST 시(hour)를 추출. Asia/Seoul 캘린더 기준.
 * Intl 이 "24" 를 반환하는 엣지 케이스 방어 차원에서 % 24.
 */
function kstHour(iso: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    hour12: false,
  });
  const h = fmt.format(new Date(iso));
  return parseInt(h, 10) % 24;
}

/** 현재시 기준으로 과거 `hoursAgo` 시간만큼 뺀 시점의 KST hour(0~23). */
function kstHourForOffset(hoursAgo: number): number {
  const d = new Date(Date.now() - hoursAgo * 3600000);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    hour12: false,
  });
  const h = fmt.format(d);
  return parseInt(h, 10) % 24;
}

/** 지난 24시간에 대한 빈 24칸 버킷 — 인덱스 0=현재시-23h, 23=현재시. */
function buildEmptyHeatmapHours(): ControlRoomHeatmapHour[] {
  return Array.from({ length: 24 }).map((_, i) => {
    const hOffset = 23 - i;
    const hour = kstHourForOffset(hOffset);
    return { hourLabel: `${hour}시`, count: 0, intensity: 0 };
  });
}

/** 부재/실패 시 반환 — 빈 24칸 + total=0 + peakHour=null. */
function emptyHeatmap(): ControlRoomHeatmap {
  return {
    hours: buildEmptyHeatmapHours(),
    peakHour: null,
    totalLast24h: 0,
  };
}

async function loadHeatmap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  last24hIso: string
): Promise<ControlRoomHeatmap> {
  try {
    // 1) org 의 mission id 목록.
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
        "[control-room/loadHeatmap] missions error",
        missionsResp.error
      );
      return emptyHeatmap();
    }
    const missionIds = (missionsResp.data ?? []).map((m) => m.id);
    if (missionIds.length === 0) return emptyHeatmap();

    // 2) 지난 24시간 APPROVED 제출 로드.
    const subsResp = (await (
      supabase.from("mission_submissions" as never) as unknown as {
        select: (c: string) => {
          in: (k: string, v: string[]) => {
            in: (k: string, v: string[]) => {
              gte: (
                k: string,
                v: string
              ) => Promise<SbResp<{ submitted_at: string }>>;
            };
          };
        };
      }
    )
      .select("submitted_at")
      .in("org_mission_id", missionIds)
      .in("status", APPROVED_STATUSES as unknown as string[])
      .gte("submitted_at", last24hIso)) as SbResp<{ submitted_at: string }>;

    if (subsResp.error) {
      console.error("[control-room/loadHeatmap] subs error", subsResp.error);
      return emptyHeatmap();
    }

    const subs = subsResp.data ?? [];

    // 3) 버킷 24칸 준비 (인덱스 0=현재시-23h, 23=현재시).
    //    각 인덱스 i 에 대응하는 KST hour = kstHourForOffset(23 - i).
    const buckets = buildEmptyHeatmapHours();
    // 각 KST hour(0~23) 가 버킷 배열에서 어느 인덱스에 대응하는지 역매핑.
    // 주의: "지난 24시간" 윈도우 안에서는 각 시(hour)가 정확히 한 번 나타난다
    // (정시 경계 제외). 따라서 hour→index 단일 매핑으로 충분.
    const hourToIndex = new Map<number, number>();
    buckets.forEach((b, idx) => {
      const h = parseInt(b.hourLabel, 10);
      hourToIndex.set(h, idx);
    });

    for (const s of subs) {
      if (!s.submitted_at) continue;
      const h = kstHour(s.submitted_at);
      const idx = hourToIndex.get(h);
      if (idx === undefined) continue;
      buckets[idx].count += 1;
    }

    // 4) intensity + peakHour 계산.
    let maxCount = 0;
    for (const b of buckets) if (b.count > maxCount) maxCount = b.count;

    if (maxCount > 0) {
      for (const b of buckets) {
        b.intensity = Math.round((b.count / maxCount) * 100) / 100;
      }
    }

    let peakHour: string | null = null;
    if (maxCount > 0) {
      // 동점이면 **더 최근(인덱스가 큰)** 버킷을 우선.
      for (let i = buckets.length - 1; i >= 0; i -= 1) {
        if (buckets[i].count === maxCount) {
          peakHour = buckets[i].hourLabel;
          break;
        }
      }
    }

    const totalLast24h = buckets.reduce((acc, b) => acc + b.count, 0);

    return { hours: buckets, peakHour, totalLast24h };
  } catch (e) {
    console.error("[control-room/loadHeatmap] throw", e);
    return emptyHeatmap();
  }
}
