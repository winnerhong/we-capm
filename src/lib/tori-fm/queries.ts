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

  const rows = (resp.data ?? []).slice().reverse();
  // 뒤집어서 ASC — 채팅 UI 는 오래된 게 위, 최신이 아래.

  // sender_name 앞에 반(class) 이름 prefix 보강.
  // 이전에 저장된 메시지(prefix 없이) 도 화면에는 "햇살반 유하준 가족" 형태로 보이도록
  // user_id 기준 app_children.class_name 을 lookup 해서 prefix.
  // 이미 prefix 가 박힌 메시지(새 insert) 는 멱등 처리 — startsWith 체크.
  const userIds = Array.from(
    new Set(
      rows
        .filter((r) => r.user_id)
        .map((r) => r.user_id as string)
    )
  );
  if (userIds.length === 0) return rows;

  type ChildRow = {
    user_id: string;
    class_name: string | null;
    is_enrolled: boolean;
    created_at: string;
  };
  const childResp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        in: (
          k: string,
          v: string[]
        ) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<ChildRow>>;
        };
      };
    }
  )
    .select("user_id, class_name, is_enrolled, created_at")
    .in("user_id", userIds)
    .order("created_at", { ascending: true })) as SbResp<ChildRow>;

  // user_id → primary class_name (첫 enrolled child 중 class_name 있는 것 우선)
  const classByUser = new Map<string, string>();
  const enrolledFirst = (childResp.data ?? []).slice().sort((a, b) => {
    const enrolledDiff = Number(b.is_enrolled) - Number(a.is_enrolled);
    if (enrolledDiff !== 0) return enrolledDiff;
    return a.created_at.localeCompare(b.created_at);
  });
  for (const c of enrolledFirst) {
    const cn = (c.class_name ?? "").trim();
    if (!cn) continue;
    if (classByUser.has(c.user_id)) continue;
    classByUser.set(c.user_id, cn);
  }

  return rows.map((r) => {
    if (!r.user_id) return r;
    const className = classByUser.get(r.user_id);
    if (!className) return r;
    const senderName = r.sender_name ?? "";
    if (senderName.startsWith(`${className} `)) return r; // 멱등
    return { ...r, sender_name: `${className} ${senderName}` };
  });
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

/**
 * QUEUED 방송 대기 큐 — queue_position ASC.
 */
export async function loadQueuedRequests(
  sessionId: string
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
              o: { ascending: boolean; nullsFirst?: boolean }
            ) => Promise<SbResp<FmRequestRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("session_id", sessionId)
    .eq("status", "QUEUED")
    .order("queue_position", { ascending: true, nullsFirst: false })) as SbResp<FmRequestRow>;
  return resp.data ?? [];
}

/**
 * 현재 PLAYING 중인 신청곡 묶음 — 같은 곡(song_normalized) 의 사연이 여러 건일 수 있음.
 * created_at ASC 로 정렬되어 먼저 신청한 사람의 사연이 위에 옴.
 */
export async function loadPlayingGroup(
  sessionId: string
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
    .eq("status", "PLAYING")
    .order("created_at", { ascending: true })) as SbResp<FmRequestRow>;
  return resp.data ?? [];
}

/**
 * 현재 PLAYING 묶음의 첫 항목(또는 null) — 호환용 헬퍼.
 * (이전 코드가 단일 row 만 가정했던 곳에서 사용)
 */
export async function loadPlayingRequest(
  sessionId: string
): Promise<FmRequestRow | null> {
  const group = await loadPlayingGroup(sessionId);
  return group[0] ?? null;
}

/**
 * 세션 내 인기 신청곡 TOP — popularity = heart_count + boost_amount 내림차순.
 *  - PENDING/APPROVED/QUEUED만 (방송됨 제외)
 *  - DB 컬럼 합산 정렬은 RPC 없이 어려워서 전체 조회 후 클라이언트 정렬.
 *    한 세션 신청 수는 보통 수백 미만이라 부하 미미.
 */
export async function loadTopHeartedRequests(
  sessionId: string,
  limit: number = 5
): Promise<FmRequestRow[]> {
  if (!sessionId) return [];
  const supabase = await createClient();
  const resp = (await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          in: (k: string, v: string[]) => Promise<SbResp<FmRequestRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("session_id", sessionId)
    .in("status", ["PENDING", "APPROVED", "QUEUED"])) as SbResp<FmRequestRow>;

  const popularity = (r: FmRequestRow) =>
    (r.heart_count ?? 0) + (r.boost_amount ?? 0);
  return (resp.data ?? [])
    .filter((r) => popularity(r) > 0)
    .sort((a, b) => popularity(b) - popularity(a))
    .slice(0, Math.max(1, Math.min(limit, 20)));
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
