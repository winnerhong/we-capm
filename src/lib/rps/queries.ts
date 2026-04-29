// server-only: @/lib/supabase/server 참조 → 클라이언트 번들 금지.
// 단체 가위바위보 서바이벌 — SSR 데이터 로더.

import { createClient } from "@/lib/supabase/server";
import type {
  RpsGiftRow,
  RpsParticipantRow,
  RpsPickRow,
  RpsRoomRow,
  RpsRoundRow,
} from "@/lib/rps/types";

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

/* -------------------------------------------------------------------------- */
/* Rooms                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 방 단건 로드 — 없으면 null.
 */
export async function loadRoom(roomId: string): Promise<RpsRoomRow | null> {
  if (!roomId) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("rps_rooms" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<RpsRoomRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", roomId)
    .maybeSingle()) as SbRespOne<RpsRoomRow>;
  return resp.data ?? null;
}

/**
 * 기관(org)의 방 목록 — created_at DESC.
 *  - eventId 가 주어지면 해당 이벤트로 필터.
 */
export async function loadRoomsForOrg(
  orgId: string,
  eventId?: string | null
): Promise<RpsRoomRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();

  // eventId 분기에 따라 빌더 체인 시그니처가 달라져 코드 양쪽으로 분리.
  if (eventId) {
    const resp = (await (
      supabase.from("rps_rooms" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => Promise<SbResp<RpsRoomRow>>;
            };
          };
        };
      }
    )
      .select("*")
      .eq("org_id", orgId)
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })) as SbResp<RpsRoomRow>;
    return resp.data ?? [];
  }

  const resp = (await (
    supabase.from("rps_rooms" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<RpsRoomRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })) as SbResp<RpsRoomRow>;
  return resp.data ?? [];
}

/**
 * 토리FM 세션과 묶인 가장 최신 RPS 방 — 진행중/대기중/종료 모두 포함, 취소된 건 제외.
 * (한 라디오 세션은 보통 한 번에 1개의 RPS 방만 운영하므로 LIMIT 1.)
 */
export async function loadActiveRpsRoomForFmSession(
  fmSessionId: string
): Promise<RpsRoomRow | null> {
  if (!fmSessionId) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("rps_rooms" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          neq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => {
              limit: (n: number) => {
                maybeSingle: () => Promise<SbRespOne<RpsRoomRow>>;
              };
            };
          };
        };
      };
    }
  )
    .select("*")
    .eq("fm_session_id", fmSessionId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as SbRespOne<RpsRoomRow>;
  return resp.data ?? null;
}

/* -------------------------------------------------------------------------- */
/* Rounds                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 방의 가장 최신 라운드 — round_no DESC LIMIT 1. 없으면 null.
 */
export async function loadCurrentRound(
  roomId: string
): Promise<RpsRoundRow | null> {
  if (!roomId) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("rps_rounds" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<SbRespOne<RpsRoundRow>>;
            };
          };
        };
      };
    }
  )
    .select("*")
    .eq("room_id", roomId)
    .order("round_no", { ascending: false })
    .limit(1)
    .maybeSingle()) as SbRespOne<RpsRoundRow>;
  return resp.data ?? null;
}

/**
 * 라운드 단건 로드 — 없으면 null.
 */
export async function loadRound(
  roundId: string
): Promise<RpsRoundRow | null> {
  if (!roundId) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("rps_rounds" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<RpsRoundRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", roundId)
    .maybeSingle()) as SbRespOne<RpsRoundRow>;
  return resp.data ?? null;
}

/* -------------------------------------------------------------------------- */
/* Picks                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 라운드의 모든 픽 — picked_at ASC.
 */
export async function loadRoundPicks(
  roundId: string
): Promise<RpsPickRow[]> {
  if (!roundId) return [];
  const supabase = await createClient();
  const resp = (await (
    supabase.from("rps_picks" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<RpsPickRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("round_id", roundId)
    .order("picked_at", { ascending: true })) as SbResp<RpsPickRow>;
  return resp.data ?? [];
}

/* -------------------------------------------------------------------------- */
/* Participants                                                               */
/* -------------------------------------------------------------------------- */

/**
 * 방의 모든 참가자 — joined_at ASC.
 */
export async function loadParticipants(
  roomId: string
): Promise<RpsParticipantRow[]> {
  if (!roomId) return [];
  const supabase = await createClient();
  const resp = (await (
    supabase.from("rps_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<RpsParticipantRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true })) as SbResp<RpsParticipantRow>;
  return resp.data ?? [];
}

/**
 * 현재 살아 있는 참가자(is_active=true) — joined_at ASC.
 */
export async function loadActiveParticipants(
  roomId: string
): Promise<RpsParticipantRow[]> {
  if (!roomId) return [];
  const supabase = await createClient();
  const resp = (await (
    supabase.from("rps_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: boolean) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<SbResp<RpsParticipantRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("room_id", roomId)
    .eq("is_active", true)
    .order("joined_at", { ascending: true })) as SbResp<RpsParticipantRow>;
  return resp.data ?? [];
}

/**
 * 우승자 목록 — finished_rank IS NOT NULL, ORDER BY finished_rank ASC.
 */
export async function loadWinners(
  roomId: string
): Promise<RpsParticipantRow[]> {
  if (!roomId) return [];
  const supabase = await createClient();
  const resp = (await (
    supabase.from("rps_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          not: (
            k: string,
            op: string,
            v: null
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<SbResp<RpsParticipantRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("room_id", roomId)
    .not("finished_rank", "is", null)
    .order("finished_rank", { ascending: true })) as SbResp<RpsParticipantRow>;
  return resp.data ?? [];
}

/* -------------------------------------------------------------------------- */
/* Gifts                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 방의 선물 발송 기록 — created_at DESC.
 */
export async function loadGifts(roomId: string): Promise<RpsGiftRow[]> {
  if (!roomId) return [];
  const supabase = await createClient();
  const resp = (await (
    supabase.from("rps_gifts" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<RpsGiftRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })) as SbResp<RpsGiftRow>;
  return resp.data ?? [];
}
