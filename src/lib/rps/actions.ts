"use server";

// 단체 가위바위보 서바이벌 — server actions.
// HOST side : requireOrg (campnic_org 쿠키)  → 방 만들기·라운드 진행·선물 발송
// PLAYER side: requireAppUser (campnic_user) → 참가·픽 제출
//
// RLS Phase 0 (permissive) 라 일반 supabase server client 만으로도 모든 쓰기 가능.
// Phase 1 에서 정책 조이면 host 작업만 admin client 로 전환 검토.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAppUser } from "@/lib/user-auth-guard";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadChildrenForUser } from "@/lib/app-user/queries";
import { grantGiftAction } from "@/lib/gifts/actions";
import {
  comparePick,
  type RpsParticipantRow,
  type RpsPick,
  type RpsPickRow,
  type RpsRoomRow,
  type RpsRoundRecommendation,
  type RpsRoundResolution,
  type RpsRoundRow,
} from "@/lib/rps/types";

type Row = Record<string, unknown>;
type SbErr = { message: string; code?: string } | null;
type SbResp<T> = { data: T[] | null; error: SbErr };
type SbRespOne<T> = { data: T | null; error: SbErr };

const PICKS: RpsPick[] = ["rock", "paper", "scissors"];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function revalidateRoom(_roomId: string, orgId?: string): void {
  // RPS 는 토리FM 라이브 방송 안에서 모달로 동작하므로 토리FM 경로만 갱신.
  revalidatePath(`/tori-fm`);
  if (orgId) {
    revalidatePath(`/org/${orgId}/tori-fm`);
    revalidatePath(`/screen/tori-fm/${orgId}`);
  }
}

/**
 * 보호자 자녀 이름을 "{이름} 가족" 형태의 표시명으로 변환.
 * (tori-fm/actions 의 deriveDisplayName 과 동일 로직)
 */
function deriveDisplayName(
  children: { name: string; is_enrolled: boolean }[],
  parentName: string
): string {
  const enrolled = children.filter((c) => c.is_enrolled && c.name?.trim());
  const named =
    enrolled.length > 0 ? enrolled : children.filter((c) => c.name?.trim());
  if (named.length === 1) return `${named[0].name.trim()} 가족`;
  if (named.length >= 2) {
    return `${named[0].name.trim()} 외 ${named.length - 1}명 가족`;
  }
  if (parentName?.trim()) return `${parentName.trim()} 가족`;
  return "익명 가족";
}

/**
 * 방 소유 검증 — host 액션 진입 시 org 와 일치하는지.
 */
async function loadRoomOwnedByOrg(
  roomId: string,
  orgId: string
): Promise<RpsRoomRow> {
  if (!roomId) throw new Error("방을 찾을 수 없어요");
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
  if (!resp.data) throw new Error("방을 찾을 수 없어요");
  if (resp.data.org_id !== orgId) {
    throw new Error("이 방에 대한 권한이 없어요");
  }
  return resp.data;
}

function pickRandomPick(): RpsPick {
  return PICKS[Math.floor(Math.random() * 3)];
}

/* ========================================================================== */
/* 1) createRoomAction — HOST                                                 */
/* ========================================================================== */

export async function createRoomAction(input: {
  orgId: string;
  eventId?: string | null;
  fmSessionId?: string | null;
  title: string;
  targetSurvivors: number;
  pickWindowMs?: number;
  giftLabel: string;
  giftImageUrl?: string | null;
  giftMessage?: string | null;
}): Promise<{ roomId: string }> {
  const org = await requireOrg();
  if (input.orgId !== org.orgId) {
    throw new Error("다른 기관의 방을 만들 수 없어요");
  }

  const target = Math.floor(input.targetSurvivors);
  if (!Number.isFinite(target) || target < 1 || target > 50) {
    throw new Error("우승자 수는 1~50명 사이로 설정해 주세요");
  }

  const title = (input.title ?? "").trim() || "단체 가위바위보";
  const pickWindowMs =
    typeof input.pickWindowMs === "number" && input.pickWindowMs > 0
      ? Math.floor(input.pickWindowMs)
      : 3000;

  const giftLabel = (input.giftLabel ?? "").trim();
  if (!giftLabel) throw new Error("선물 이름을 입력해 주세요");
  const giftImageUrl = (input.giftImageUrl ?? "").trim() || null;
  const giftMessage = (input.giftMessage ?? "").trim() || null;

  const supabase = await createClient();
  const resp = (await (
    supabase.from("rps_rooms" as never) as unknown as {
      insert: (r: Row) => {
        select: (c: string) => {
          maybeSingle: () => Promise<SbRespOne<{ id: string }>>;
        };
      };
    }
  )
    .insert({
      org_id: org.orgId,
      event_id: input.eventId ?? null,
      fm_session_id: input.fmSessionId ?? null,
      host_user_id: null, // org staff (관리자 세션) — app_users.id 와 무관 → NULL.
      title,
      target_survivors: target,
      status: "idle",
      current_round_no: 0,
      pick_window_ms: pickWindowMs,
      gift_label: giftLabel,
      gift_image_url: giftImageUrl,
      gift_message: giftMessage,
    } satisfies Row)
    .select("id")
    .maybeSingle()) as SbRespOne<{ id: string }>;

  if (resp.error || !resp.data?.id) {
    console.error("[rps/createRoom] error", { code: resp.error?.code });
    throw new Error("방 생성에 실패했어요");
  }

  revalidateRoom(resp.data.id, org.orgId);
  return { roomId: resp.data.id };
}

/* ========================================================================== */
/* 2) joinRoomAction — PLAYER                                                 */
/* ========================================================================== */

export async function joinRoomAction(roomId: string): Promise<void> {
  const user = await requireAppUser();
  if (!roomId) throw new Error("방을 찾을 수 없어요");

  const supabase = await createClient();

  // 방 존재 확인 + 같은 org 인지 검증
  const roomResp = (await (
    supabase.from("rps_rooms" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ id: string; org_id: string; status: string }>
          >;
        };
      };
    }
  )
    .select("id, org_id, status")
    .eq("id", roomId)
    .maybeSingle()) as SbRespOne<{
    id: string;
    org_id: string;
    status: string;
  }>;

  if (!roomResp.data) throw new Error("방을 찾을 수 없어요");
  if (roomResp.data.org_id !== user.orgId) {
    throw new Error("다른 기관의 방에는 참가할 수 없어요");
  }
  if (
    roomResp.data.status === "finished" ||
    roomResp.data.status === "cancelled"
  ) {
    throw new Error("이미 종료된 방이에요");
  }

  // 표시명 계산 (자녀 우선, 없으면 부모 이름)
  const children = await loadChildrenForUser(user.id);
  const displayName = deriveDisplayName(
    children.map((c) => ({ name: c.name, is_enrolled: c.is_enrolled })),
    user.parentName
  );

  // 기존 참가자 조회 → UPSERT (PK=room_id+user_id 충돌시 display_name/phone 갱신,
  // is_active 는 기존값 유지하기 위해 분기)
  const existingResp = (await (
    supabase.from("rps_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<
              SbRespOne<{ user_id: string; is_active: boolean }>
            >;
          };
        };
      };
    }
  )
    .select("user_id, is_active")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle()) as SbRespOne<{ user_id: string; is_active: boolean }>;

  if (existingResp.data) {
    // 재입장 — display_name 과 phone 만 갱신, is_active 는 그대로.
    const updResp = (await (
      supabase.from("rps_participants" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => Promise<{ error: SbErr }>;
          };
        };
      }
    )
      .update({ display_name: displayName, phone: user.phone })
      .eq("room_id", roomId)
      .eq("user_id", user.id)) as { error: SbErr };

    if (updResp.error) {
      console.error("[rps/joinRoom] update error", {
        code: updResp.error.code,
      });
      throw new Error("참가자 정보 갱신에 실패했어요");
    }
  } else {
    const insResp = (await (
      supabase.from("rps_participants" as never) as unknown as {
        insert: (r: Row) => Promise<{ error: SbErr }>;
      }
    ).insert({
      room_id: roomId,
      user_id: user.id,
      display_name: displayName,
      phone: user.phone,
      is_active: true,
    } satisfies Row)) as { error: SbErr };

    // 동시 입장으로 인한 PK 충돌(23505) 은 멱등 성공으로.
    if (insResp.error && insResp.error.code !== "23505") {
      console.error("[rps/joinRoom] insert error", {
        code: insResp.error.code,
      });
      throw new Error("방 참가에 실패했어요");
    }
  }

  revalidateRoom(roomId, user.orgId);
}

/* ========================================================================== */
/* 3) nextRoundAction — HOST                                                  */
/* ========================================================================== */

export async function nextRoundAction(
  roomId: string,
  mode: "normal" | "revival" | "replay" = "normal"
): Promise<{
  roundId: string;
  roundNo: number;
  startsAt: string;
  lockedAt: string;
}> {
  const org = await requireOrg();
  const room = await loadRoomOwnedByOrg(roomId, org.orgId);

  if (room.status === "finished" || room.status === "cancelled") {
    throw new Error("이미 종료된 방이에요");
  }

  const supabase = await createClient();

  // mode 별 참가자 부활 처리
  if (mode === "revival") {
    // 직전 라운드(=current_round_no) 에서 탈락한 사람만 부활.
    const updResp = (await (
      supabase.from("rps_participants" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: number) => Promise<{ error: SbErr }>;
          };
        };
      }
    )
      .update({ is_active: true, eliminated_at_round: null })
      .eq("room_id", roomId)
      .eq("eliminated_at_round", room.current_round_no)) as { error: SbErr };

    if (updResp.error) {
      console.error("[rps/nextRound] revival update error", {
        code: updResp.error.code,
      });
      throw new Error("부활 처리에 실패했어요");
    }
  } else if (mode === "replay") {
    // 직전 라운드에 픽한 사람들 모두 active 로. 우승자(finished_rank!=null) 는 제외.
    const updResp = (await (
      supabase.from("rps_participants" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => {
            is: (k: string, v: null) => Promise<{ error: SbErr }>;
          };
        };
      }
    )
      .update({ is_active: true, eliminated_at_round: null })
      .eq("room_id", roomId)
      .is("finished_rank", null)) as { error: SbErr };

    if (updResp.error) {
      console.error("[rps/nextRound] replay update error", {
        code: updResp.error.code,
      });
      throw new Error("재시작 처리에 실패했어요");
    }
  }

  // active 참가자 수 카운트
  const activeResp = (await (
    supabase.from("rps_participants" as never) as unknown as {
      select: (c: string, opts: { count: "exact"; head: true }) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: boolean) => Promise<{
            count: number | null;
            error: SbErr;
          }>;
        };
      };
    }
  )
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("is_active", true)) as { count: number | null; error: SbErr };

  const participantsCount = activeResp.count ?? 0;
  if (participantsCount === 0) {
    throw new Error("참가자가 없어요");
  }

  const nextRoundNo = room.current_round_no + 1;
  const now = Date.now();
  const startsAt = new Date(now + 3000).toISOString();
  const lockedAt = new Date(
    now + 3000 + room.pick_window_ms
  ).toISOString();
  const isRevival = mode === "revival";

  // 라운드 INSERT
  const roundResp = (await (
    supabase.from("rps_rounds" as never) as unknown as {
      insert: (r: Row) => {
        select: (c: string) => {
          maybeSingle: () => Promise<SbRespOne<{ id: string }>>;
        };
      };
    }
  )
    .insert({
      room_id: roomId,
      round_no: nextRoundNo,
      starts_at: startsAt,
      locked_at: lockedAt,
      participants_count: participantsCount,
      survivors_count: 0,
      is_revival: isRevival,
    } satisfies Row)
    .select("id")
    .maybeSingle()) as SbRespOne<{ id: string }>;

  if (roundResp.error || !roundResp.data?.id) {
    console.error("[rps/nextRound] insert round error", {
      code: roundResp.error?.code,
    });
    throw new Error("라운드 생성에 실패했어요");
  }

  // 방 상태 갱신 — current_round_no, status='running'
  const roomUpdResp = (await (
    supabase.from("rps_rooms" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ current_round_no: nextRoundNo, status: "running" })
    .eq("id", roomId)) as { error: SbErr };

  if (roomUpdResp.error) {
    console.error("[rps/nextRound] room update error", {
      code: roomUpdResp.error.code,
    });
    throw new Error("방 상태 갱신에 실패했어요");
  }

  revalidateRoom(roomId, org.orgId);
  return {
    roundId: roundResp.data.id,
    roundNo: nextRoundNo,
    startsAt,
    lockedAt,
  };
}

/* ========================================================================== */
/* 4) submitPickAction — PLAYER                                               */
/* ========================================================================== */

export async function submitPickAction(
  roundId: string,
  pick: RpsPick
): Promise<void> {
  const user = await requireAppUser();
  if (!roundId) throw new Error("라운드를 찾을 수 없어요");
  if (!PICKS.includes(pick)) throw new Error("잘못된 선택이에요");

  const supabase = await createClient();

  // 라운드 + 방 동시 조회
  const roundResp = (await (
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

  if (!roundResp.data) throw new Error("라운드를 찾을 수 없어요");
  const round = roundResp.data;

  if (round.resolved_at) {
    throw new Error("이미 종료된 라운드예요");
  }
  if (Date.now() >= new Date(round.locked_at).getTime()) {
    throw new Error("입력 시간이 끝났어요");
  }

  // active 참가자인지 검증
  const partResp = (await (
    supabase.from("rps_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<
              SbRespOne<{
                user_id: string;
                display_name: string;
                is_active: boolean;
              }>
            >;
          };
        };
      };
    }
  )
    .select("user_id, display_name, is_active")
    .eq("room_id", round.room_id)
    .eq("user_id", user.id)
    .maybeSingle()) as SbRespOne<{
    user_id: string;
    display_name: string;
    is_active: boolean;
  }>;

  if (!partResp.data) throw new Error("이 방에 참가하지 않았어요");
  if (!partResp.data.is_active) throw new Error("이미 탈락했어요");

  // 기존 픽 조회 → 있으면 update, 없으면 insert.
  const existingResp = (await (
    supabase.from("rps_picks" as never) as unknown as {
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
    .eq("round_id", roundId)
    .eq("user_id", user.id)
    .maybeSingle()) as SbRespOne<{ id: string }>;

  if (existingResp.data?.id) {
    const updResp = (await (
      supabase.from("rps_picks" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({ pick, picked_at: new Date().toISOString() })
      .eq("id", existingResp.data.id)) as { error: SbErr };

    if (updResp.error) {
      console.error("[rps/submitPick] update error", {
        code: updResp.error.code,
      });
      throw new Error("선택 변경에 실패했어요");
    }
  } else {
    const insResp = (await (
      supabase.from("rps_picks" as never) as unknown as {
        insert: (r: Row) => Promise<{ error: SbErr }>;
      }
    ).insert({
      round_id: roundId,
      user_id: user.id,
      display_name: partResp.data.display_name,
      pick,
    } satisfies Row)) as { error: SbErr };

    if (insResp.error && insResp.error.code !== "23505") {
      console.error("[rps/submitPick] insert error", {
        code: insResp.error.code,
      });
      throw new Error("선택 제출에 실패했어요");
    }
  }

  // 픽은 매우 빈번 → revalidatePath 생략 (realtime 구독이 받아감)
}

/* ========================================================================== */
/* 5) submitHostPickAction — HOST                                             */
/* ========================================================================== */

export async function submitHostPickAction(
  roundId: string,
  pick: RpsPick
): Promise<void> {
  const org = await requireOrg();
  if (!roundId) throw new Error("라운드를 찾을 수 없어요");
  if (!PICKS.includes(pick)) throw new Error("잘못된 선택이에요");

  const supabase = await createClient();

  // 라운드 + 방 소유 검증
  const roundResp = (await (
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

  if (!roundResp.data) throw new Error("라운드를 찾을 수 없어요");
  if (roundResp.data.resolved_at) {
    throw new Error("이미 종료된 라운드예요");
  }

  await loadRoomOwnedByOrg(roundResp.data.room_id, org.orgId);

  const updResp = (await (
    supabase.from("rps_rounds" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ host_pick: pick })
    .eq("id", roundId)) as { error: SbErr };

  if (updResp.error) {
    console.error("[rps/submitHostPick] error", {
      code: updResp.error.code,
    });
    throw new Error("호스트 선택 저장에 실패했어요");
  }

  revalidateRoom(roundResp.data.room_id, org.orgId);
}

/* ========================================================================== */
/* 6) resolveRoundAction — HOST                                               */
/* ========================================================================== */

export async function resolveRoundAction(
  roomId: string
): Promise<RpsRoundResolution> {
  const org = await requireOrg();
  const room = await loadRoomOwnedByOrg(roomId, org.orgId);

  if (room.status !== "running") {
    throw new Error("진행 중인 방이 아니에요");
  }
  if (room.current_round_no === 0) {
    throw new Error("진행 중인 라운드가 없어요");
  }

  const supabase = await createClient();

  // 현재 라운드 조회
  const roundResp = (await (
    supabase.from("rps_rounds" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: number) => {
            maybeSingle: () => Promise<SbRespOne<RpsRoundRow>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("room_id", roomId)
    .eq("round_no", room.current_round_no)
    .maybeSingle()) as SbRespOne<RpsRoundRow>;

  if (!roundResp.data) throw new Error("현재 라운드를 찾을 수 없어요");
  const round = roundResp.data;

  if (round.resolved_at) {
    throw new Error("이미 정산된 라운드예요");
  }
  if (Date.now() < new Date(round.locked_at).getTime()) {
    throw new Error("입력 시간이 아직 남아있어요");
  }

  // host_pick 없으면 랜덤
  let hostPick = round.host_pick;
  if (!hostPick) {
    hostPick = pickRandomPick();
    const updResp = (await (
      supabase.from("rps_rounds" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({ host_pick: hostPick })
      .eq("id", round.id)) as { error: SbErr };

    if (updResp.error) {
      console.error("[rps/resolveRound] auto host_pick error", {
        code: updResp.error.code,
      });
    }
  }

  // active 참가자 전체 (이번 라운드에서 픽했는지 확인하기 위해)
  const activeResp = (await (
    supabase.from("rps_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: boolean) => Promise<SbResp<RpsParticipantRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("room_id", roomId)
    .eq("is_active", true)) as SbResp<RpsParticipantRow>;

  const activePeople = activeResp.data ?? [];

  // 이번 라운드 픽 전체 로드
  const picksResp = (await (
    supabase.from("rps_picks" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<SbResp<RpsPickRow>>;
      };
    }
  )
    .select("*")
    .eq("round_id", round.id)) as SbResp<RpsPickRow>;

  const picks = picksResp.data ?? [];
  const pickByUser = new Map<string, RpsPickRow>();
  for (const p of picks) pickByUser.set(p.user_id, p);

  // 픽별 outcome 계산 후 update
  const winnerUserIds: string[] = [];
  const loserUserIds: string[] = [];
  for (const p of picks) {
    const outcome = comparePick(hostPick, p.pick);
    const updResp = (await (
      supabase.from("rps_picks" as never) as unknown as {
        update: (pp: Row) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({ outcome })
      .eq("id", p.id)) as { error: SbErr };

    if (updResp.error) {
      console.error("[rps/resolveRound] pick outcome update error", {
        code: updResp.error.code,
      });
    }

    if (outcome === "win") winnerUserIds.push(p.user_id);
    else loserUserIds.push(p.user_id);
  }

  // active 인데 이번 라운드 픽 없는 사람 → 자동 탈락
  const noPickUserIds: string[] = activePeople
    .filter((a) => !pickByUser.has(a.user_id))
    .map((a) => a.user_id);

  // 탈락자 = lose + tie + no-pick
  const eliminatedUserIds = [...loserUserIds, ...noPickUserIds];

  if (eliminatedUserIds.length > 0) {
    const elimResp = (await (
      supabase.from("rps_participants" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => {
            in: (k: string, v: string[]) => Promise<{ error: SbErr }>;
          };
        };
      }
    )
      .update({
        is_active: false,
        eliminated_at_round: round.round_no,
      })
      .eq("room_id", roomId)
      .in("user_id", eliminatedUserIds)) as { error: SbErr };

    if (elimResp.error) {
      console.error("[rps/resolveRound] elim error", {
        code: elimResp.error.code,
      });
      throw new Error("탈락 처리에 실패했어요");
    }
  }

  const survivorsCount = winnerUserIds.length;
  const target = room.target_survivors;

  // recommendation 결정
  let recommendation: RpsRoundRecommendation;
  if (survivorsCount === target) recommendation = "finished";
  else if (survivorsCount > target) recommendation = "next_round";
  else if (survivorsCount === 0) recommendation = "replay";
  else recommendation = "revival";

  // 라운드 마감
  const nowIso = new Date().toISOString();
  const roundUpdResp = (await (
    supabase.from("rps_rounds" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ survivors_count: survivorsCount, resolved_at: nowIso })
    .eq("id", round.id)) as { error: SbErr };

  if (roundUpdResp.error) {
    console.error("[rps/resolveRound] round close error", {
      code: roundUpdResp.error.code,
    });
  }

  // finished 인 경우 자동 finalize
  if (recommendation === "finished" && winnerUserIds.length > 0) {
    const rankResp = (await (
      supabase.from("rps_participants" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => {
            in: (k: string, v: string[]) => Promise<{ error: SbErr }>;
          };
        };
      }
    )
      .update({ finished_rank: 1 })
      .eq("room_id", roomId)
      .in("user_id", winnerUserIds)) as { error: SbErr };

    if (rankResp.error) {
      console.error("[rps/resolveRound] rank error", {
        code: rankResp.error.code,
      });
    }

    const roomFinResp = (await (
      supabase.from("rps_rooms" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({ status: "finished", finished_at: nowIso })
      .eq("id", roomId)) as { error: SbErr };

    if (roomFinResp.error) {
      console.error("[rps/resolveRound] room finish error", {
        code: roomFinResp.error.code,
      });
    }
  }

  revalidateRoom(roomId, org.orgId);
  return {
    survivors: survivorsCount,
    eliminated: eliminatedUserIds.length,
    recommendation,
  };
}

/* ========================================================================== */
/* 7) forceFinishRoomAction — HOST                                            */
/* ========================================================================== */

export async function forceFinishRoomAction(roomId: string): Promise<void> {
  const org = await requireOrg();
  const room = await loadRoomOwnedByOrg(roomId, org.orgId);

  if (room.status === "finished" || room.status === "cancelled") {
    throw new Error("이미 종료된 방이에요");
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  // 현재 active 참가자를 모두 우승자로
  const updResp = (await (
    supabase.from("rps_participants" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: boolean) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .update({ finished_rank: 1 })
    .eq("room_id", roomId)
    .eq("is_active", true)) as { error: SbErr };

  if (updResp.error) {
    console.error("[rps/forceFinish] rank error", {
      code: updResp.error.code,
    });
    throw new Error("우승자 처리에 실패했어요");
  }

  const roomUpdResp = (await (
    supabase.from("rps_rooms" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ status: "finished", finished_at: nowIso })
    .eq("id", roomId)) as { error: SbErr };

  if (roomUpdResp.error) {
    console.error("[rps/forceFinish] room update error", {
      code: roomUpdResp.error.code,
    });
    throw new Error("방 종료에 실패했어요");
  }

  revalidateRoom(roomId, org.orgId);
}

/* ========================================================================== */
/* 8) sendGiftsAction — HOST                                                  */
/* ========================================================================== */

export async function sendGiftsAction(
  roomId: string
): Promise<{ sent: number; failed: number }> {
  const org = await requireOrg();
  const room = await loadRoomOwnedByOrg(roomId, org.orgId);

  if (room.status !== "finished") {
    throw new Error("종료된 방에서만 선물을 보낼 수 있어요");
  }

  // 선물 정보는 방 생성 시점에 정해놨음. 못 정해놨다면 방 생성이 거부됐어야 함.
  const giftLabel = (room.gift_label ?? "").trim();
  if (!giftLabel) throw new Error("선물 정보가 누락됐어요");
  const giftImageUrl = (room.gift_image_url ?? "").trim() || null;
  const customMessage = (room.gift_message ?? "").trim() || null;

  const supabase = await createClient();

  // 우승자 — phone 유무와 관계없이 모두 선물함 발급 (앱에서 본인 선물함으로 확인).
  const winnersResp = (await (
    supabase.from("rps_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          not: (
            k: string,
            op: string,
            v: null
          ) => Promise<SbResp<RpsParticipantRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("room_id", roomId)
    .not("finished_rank", "is", null)) as SbResp<RpsParticipantRow>;

  const winners = winnersResp.data ?? [];

  let sent = 0;
  let failed = 0;

  for (const w of winners) {
    try {
      // user_gifts INSERT — 쿠폰 코드 발급 (멱등: 같은 room+user 중복 호출 시 기존 row 반환).
      await grantGiftAction({
        userId: w.user_id,
        orgId: org.orgId,
        sourceType: "rps_winner",
        sourceId: roomId,
        displayName: w.display_name,
        giftLabel,
        giftUrl: giftImageUrl,
        message: customMessage,
        // RPS 우승은 매장에 빨리 와서 받는 게 자연스러움 → 기본 30일.
        expiresInDays: 30,
      });
      sent += 1;
    } catch (err) {
      console.error("[rps/sendGifts] grantGift error", {
        userId: w.user_id,
        message: err instanceof Error ? err.message : "unknown",
      });
      failed += 1;
    }
  }

  revalidateRoom(roomId, org.orgId);
  return { sent, failed };
}

/* ========================================================================== */
/* 9) cancelRoomAction — HOST                                                 */
/* ========================================================================== */

export async function cancelRoomAction(roomId: string): Promise<void> {
  const org = await requireOrg();
  const room = await loadRoomOwnedByOrg(roomId, org.orgId);

  if (room.status === "finished" || room.status === "cancelled") {
    throw new Error("이미 종료된 방이에요");
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const updResp = (await (
    supabase.from("rps_rooms" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ status: "cancelled", finished_at: nowIso })
    .eq("id", roomId)) as { error: SbErr };

  if (updResp.error) {
    console.error("[rps/cancelRoom] error", { code: updResp.error.code });
    throw new Error("방 취소에 실패했어요");
  }

  revalidateRoom(roomId, org.orgId);
}

/* ========================================================================== */
/* 10) uploadGiftImageAction — HOST                                           */
/*     기프티콘 사진 업로드. (private bucket — submission-photos 재사용)         */
/*     사용자 미션 사진 업로드 패턴과 동일 (admin client + signed URL 24h).      */
/* ========================================================================== */

const GIFT_BUCKET = "submission-photos";
const GIFT_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const GIFT_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/gif",
]);

export async function uploadGiftImageAction(
  formData: FormData
): Promise<{ url: string; path: string }> {
  const org = await requireOrg();

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("파일이 비어 있어요");
  if (file.size === 0) throw new Error("빈 파일이에요");
  if (file.size > GIFT_MAX_BYTES) {
    throw new Error("사진은 5MB 이하만 업로드할 수 있어요");
  }
  const mime = file.type || "image/jpeg";
  if (!GIFT_ALLOWED_MIME.has(mime)) {
    throw new Error("이미지 형식만 업로드할 수 있어요 (jpg/png/webp/heic/gif)");
  }

  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/heic"
          ? "heic"
          : mime === "image/gif"
            ? "gif"
            : "jpg";
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `rps-gifts/${org.orgId}/${Date.now()}-${rand}.${ext}`;

  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from(GIFT_BUCKET)
    .upload(path, file, { contentType: mime, upsert: false });
  if (upErr) {
    console.error("[rps/uploadGiftImage] failed", { path, msg: upErr.message });
    throw new Error(`업로드 실패: ${upErr.message}`);
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(GIFT_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);
  if (signErr || !signed?.signedUrl) {
    console.error("[rps/uploadGiftImage] sign failed", {
      path,
      msg: signErr?.message,
    });
    throw new Error("업로드는 됐지만 URL 발급에 실패했어요");
  }

  return { url: signed.signedUrl, path };
}
