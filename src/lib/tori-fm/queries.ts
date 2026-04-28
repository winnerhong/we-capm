// server-only: @/lib/supabase/server 참조 → 클라이언트 번들 금지.
// tori-fm interactive layer 데이터 로더들.

import { createClient } from "@/lib/supabase/server";
import type {
  FmChatMessageRow,
  FmReactionRow,
  FmRequestRow,
  FmTopArtistRow,
  FmTopChatterRow,
  FmTopFamilyRow,
  FmTopSongRow,
  FmTopStoryRow,
  RequestStatus,
} from "@/lib/tori-fm/types";

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

/* -------------------------------------------------------------------------- */
/* Chat                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * 세션의 최신 채팅 메시지 로드 — DESC 로 가져와 뒤집어 ASC 로 반환.
 * is_deleted=true 행은 제외.
 */
export async function loadChatMessages(
  sessionId: string,
  limit: number = 50
): Promise<FmChatMessageRow[]> {
  if (!sessionId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("tori_fm_chat_messages" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: boolean) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => {
              limit: (n: number) => Promise<SbResp<FmChatMessageRow>>;
            };
          };
        };
      };
    }
  )
    .select("*")
    .eq("session_id", sessionId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit)) as SbResp<FmChatMessageRow>;

  const rows = resp.data ?? [];
  // 뒤집어서 ASC — 채팅 UI 는 오래된 게 위, 최신이 아래.
  return rows.slice().reverse();
}

/* -------------------------------------------------------------------------- */
/* Requests                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * HIDDEN 제외 모든 신청곡 — created_at DESC.
 */
export async function loadOpenSessionRequests(
  sessionId: string
): Promise<FmRequestRow[]> {
  if (!sessionId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          neq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<SbResp<FmRequestRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("session_id", sessionId)
    .neq("status", "HIDDEN")
    .order("created_at", { ascending: false })) as SbResp<FmRequestRow>;

  return resp.data ?? [];
}

/**
 * 특정 상태의 신청곡 목록 — created_at DESC.
 */
export async function loadSessionRequestsByStatus(
  sessionId: string,
  status: RequestStatus
): Promise<FmRequestRow[]> {
  if (!sessionId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<SbResp<FmRequestRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("session_id", sessionId)
    .eq("status", status)
    .order("created_at", { ascending: false })) as SbResp<FmRequestRow>;

  return resp.data ?? [];
}

/**
 * PENDING 모더레이션 큐 — DJ 승인 대기 목록.
 */
export async function loadPendingRequests(
  sessionId: string
): Promise<FmRequestRow[]> {
  return loadSessionRequestsByStatus(sessionId, "PENDING");
}

/* -------------------------------------------------------------------------- */
/* Reactions                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * 최근 sinceMs 내에 들어온 리액션 — 화면에 이모지 떠오르기 애니메이션용.
 */
export async function loadRecentReactions(
  sessionId: string,
  sinceMs: number
): Promise<FmReactionRow[]> {
  if (!sessionId) return [];
  const supabase = await createClient();

  const since = new Date(Date.now() - Math.max(0, sinceMs)).toISOString();

  const resp = (await (
    supabase.from("tori_fm_reactions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          gte: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<SbResp<FmReactionRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("session_id", sessionId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })) as SbResp<FmReactionRow>;

  return resp.data ?? [];
}

/* -------------------------------------------------------------------------- */
/* Hearts — user state                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 특정 유저가 특정 신청곡에 하트를 눌렀는지 여부.
 */
export async function hasUserHeartedRequest(
  userId: string,
  requestId: string
): Promise<boolean> {
  if (!userId || !requestId) return false;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("tori_fm_request_hearts" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<SbRespOne<{ id: string }>>;
          };
        };
      };
    }
  )
    .select("id")
    .eq("user_id", userId)
    .eq("request_id", requestId)
    .maybeSingle()) as SbRespOne<{ id: string }>;

  return !!resp.data?.id;
}

/* -------------------------------------------------------------------------- */
/* Ranking views                                                              */
/* -------------------------------------------------------------------------- */

export async function loadTopSongs(
  sessionId: string,
  limit: number = 5
): Promise<FmTopSongRow[]> {
  if (!sessionId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("view_fm_top_songs_today" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          limit: (n: number) => Promise<SbResp<FmTopSongRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("session_id", sessionId)
    .limit(limit)) as SbResp<FmTopSongRow>;

  return resp.data ?? [];
}

export async function loadTopArtists(
  sessionId: string,
  limit: number = 5
): Promise<FmTopArtistRow[]> {
  if (!sessionId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("view_fm_top_artists_today" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          limit: (n: number) => Promise<SbResp<FmTopArtistRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("session_id", sessionId)
    .limit(limit)) as SbResp<FmTopArtistRow>;

  return resp.data ?? [];
}

export async function loadTopStories(
  sessionId: string,
  limit: number = 3
): Promise<FmTopStoryRow[]> {
  if (!sessionId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("view_fm_top_stories_today" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          limit: (n: number) => Promise<SbResp<FmTopStoryRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("session_id", sessionId)
    .limit(limit)) as SbResp<FmTopStoryRow>;

  return resp.data ?? [];
}

export async function loadTopFamilies(
  sessionId: string,
  limit: number = 5
): Promise<FmTopFamilyRow[]> {
  if (!sessionId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("view_fm_top_families_today" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          limit: (n: number) => Promise<SbResp<FmTopFamilyRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("session_id", sessionId)
    .limit(limit)) as SbResp<FmTopFamilyRow>;

  return resp.data ?? [];
}

export async function loadTopChatters(
  sessionId: string,
  limit: number = 5
): Promise<FmTopChatterRow[]> {
  if (!sessionId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("view_fm_top_chatters_today" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          limit: (n: number) => Promise<SbResp<FmTopChatterRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("session_id", sessionId)
    .limit(limit)) as SbResp<FmTopChatterRow>;

  return resp.data ?? [];
}
