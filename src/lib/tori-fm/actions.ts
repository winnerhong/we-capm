"use server";

// 토리FM interactive layer — server actions.
// USER side: requireAppUser (campnic_user 쿠키)
// DJ side:   requireOrg    (campnic_org 쿠키)
//
// 채팅/리액션/신청곡/하트/투표를 한 파일에 묶음. revalidatePath 는
// /(user)/tori-fm 와 /org/[orgId]/tori-fm/[sessionId] 양쪽을 찍는다.
//
// 주의: options jsonb 는 PG 에서 잠금 없이 read → mutate → update 하므로
// 동시 투표가 쏠리면 카운트가 덮어써질 수 있음. denormalized cache 로만
// 취급하고, 실제 집계는 tori_fm_poll_votes 테이블을 source of truth 로 삼는다.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/user-auth-guard";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadFmSessionById } from "@/lib/missions/queries";
import {
  loadPollById,
  loadActivePoll,
} from "@/lib/tori-fm/queries";
import type {
  FmPollOption,
  ReactionEmoji,
} from "@/lib/tori-fm/types";
import { REACTION_EMOJIS } from "@/lib/tori-fm/types";

type Row = Record<string, unknown>;
type SbErr = { message: string; code?: string } | null;
type SbRespOne<T> = { data: T | null; error: SbErr };

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function revalidateFm(sessionId?: string, orgId?: string): void {
  revalidatePath("/tori-fm");
  if (orgId && sessionId) {
    revalidatePath(`/org/${orgId}/tori-fm/${sessionId}`);
    revalidatePath(`/org/${orgId}/tori-fm`);
  }
}

function clampString(
  raw: string | null | undefined,
  max: number
): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/* ========================================================================== */
/* USER actions                                                               */
/* ========================================================================== */

/**
 * 채팅 메시지 보내기 — 1~300자.
 */
export async function sendChatMessageAction(
  sessionId: string,
  message: string
): Promise<void> {
  const user = await requireAppUser();
  if (!sessionId) throw new Error("세션을 찾을 수 없어요");

  const text = (message ?? "").trim();
  if (!text) throw new Error("메시지를 입력해 주세요");
  if (text.length > 300) {
    throw new Error("메시지는 300자까지만 보낼 수 있어요");
  }

  const supabase = await createClient();
  const resp = (await (
    supabase.from("tori_fm_chat_messages" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    session_id: sessionId,
    user_id: user.id,
    sender_type: "USER",
    sender_name: user.parentName || "익명",
    message: text,
  } satisfies Row)) as { error: SbErr };

  if (resp.error) {
    console.error("[fm/sendChatMessage] error", { code: resp.error.code });
    throw new Error("채팅 전송에 실패했어요");
  }

  revalidateFm(sessionId, user.orgId);
}

/**
 * 이모지 리액션 — 6종 중 하나. targetRequestId 지정 시 해당 신청곡 위로 떠오름.
 */
export async function sendReactionAction(
  sessionId: string,
  emoji: string,
  targetRequestId?: string
): Promise<void> {
  const user = await requireAppUser();
  if (!sessionId) throw new Error("세션을 찾을 수 없어요");

  if (!REACTION_EMOJIS.includes(emoji as ReactionEmoji)) {
    throw new Error("지원하지 않는 이모지에요");
  }

  const supabase = await createClient();
  const resp = (await (
    supabase.from("tori_fm_reactions" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    session_id: sessionId,
    user_id: user.id,
    emoji,
    target_request_id: targetRequestId ?? null,
  } satisfies Row)) as { error: SbErr };

  if (resp.error) {
    console.error("[fm/sendReaction] error", { code: resp.error.code });
    throw new Error("리액션 전송에 실패했어요");
  }

  // 리액션은 빈번 → revalidatePath 생략 (클라이언트 realtime 구독이 받아감)
}

/**
 * 신청곡 제출 — 방송 LIVE 상태에서만 가능. 상태 PENDING, heart_count 0.
 */
export async function submitSessionRequestAction(
  sessionId: string,
  formData: FormData
): Promise<void> {
  const user = await requireAppUser();
  if (!sessionId) throw new Error("세션을 찾을 수 없어요");

  const songTitle = clampString(
    String(formData.get("song_title") ?? ""),
    200
  );
  if (!songTitle) throw new Error("노래 제목을 입력해 주세요");

  const artist = clampString(String(formData.get("artist") ?? ""), 200);
  const story = clampString(String(formData.get("story") ?? ""), 500);
  const childName = clampString(
    String(formData.get("child_name") ?? ""),
    50
  );

  const session = await loadFmSessionById(sessionId);
  if (!session) throw new Error("세션을 찾을 수 없어요");
  if (session.org_id !== user.orgId) {
    throw new Error("다른 기관의 방송에는 신청할 수 없어요");
  }
  if (!session.is_live) {
    throw new Error("방송 중이 아닐 때는 신청 못해요");
  }

  const supabase = await createClient();
  const resp = (await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    session_id: sessionId,
    user_id: user.id,
    song_title: songTitle,
    artist,
    story,
    child_name: childName,
    heart_count: 0,
    status: "PENDING",
  } satisfies Row)) as { error: SbErr };

  if (resp.error) {
    console.error("[fm/submitRequest] error", { code: resp.error.code });
    throw new Error("신청곡 제출에 실패했어요");
  }

  revalidateFm(sessionId, user.orgId);
}

/**
 * 신청곡 하트 토글 — 있으면 DELETE, 없으면 INSERT. 트리거가 heart_count 자동 증감.
 */
export async function toggleRequestHeartAction(
  requestId: string
): Promise<{ hearted: boolean }> {
  const user = await requireAppUser();
  if (!requestId) throw new Error("신청곡을 찾을 수 없어요");

  const supabase = await createClient();

  // 기존 하트 조회
  const existing = (await (
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
    .eq("user_id", user.id)
    .eq("request_id", requestId)
    .maybeSingle()) as SbRespOne<{ id: string }>;

  if (existing.data?.id) {
    // unheart
    const delResp = (await (
      supabase.from("tori_fm_request_hearts" as never) as unknown as {
        delete: () => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .delete()
      .eq("id", existing.data.id)) as { error: SbErr };

    if (delResp.error) {
      console.error("[fm/toggleHeart] delete error", {
        code: delResp.error.code,
      });
      throw new Error("하트 취소에 실패했어요");
    }

    revalidateFm(undefined, user.orgId);
    return { hearted: false };
  }

  // heart — UNIQUE 충돌(23505) 은 멱등 성공으로 간주
  const insResp = (await (
    supabase.from("tori_fm_request_hearts" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    request_id: requestId,
    user_id: user.id,
  } satisfies Row)) as { error: SbErr };

  if (insResp.error && insResp.error.code !== "23505") {
    console.error("[fm/toggleHeart] insert error", {
      code: insResp.error.code,
    });
    throw new Error("하트 반영에 실패했어요");
  }

  revalidateFm(undefined, user.orgId);
  return { hearted: true };
}

/**
 * 투표 참여 — UNIQUE(poll_id, user_id) 가 중복 차단. options jsonb 캐시도 업데이트.
 *
 * 주의: options[].votes 는 집계 캐시. 동시 투표 시 last-write-wins 로 덮어써질 수
 * 있으므로 UI 는 tori_fm_poll_votes 를 count 로 계산해도 좋다.
 */
export async function votePollAction(
  pollId: string,
  optionId: string
): Promise<void> {
  const user = await requireAppUser();
  if (!pollId) throw new Error("투표를 찾을 수 없어요");
  if (!optionId) throw new Error("보기를 선택해 주세요");

  const poll = await loadPollById(pollId);
  if (!poll) throw new Error("투표를 찾을 수 없어요");
  if (poll.status !== "ACTIVE") {
    throw new Error("종료된 투표에요");
  }
  if (new Date(poll.ends_at).getTime() <= Date.now()) {
    throw new Error("투표 시간이 끝났어요");
  }
  const optionIds = new Set(poll.options.map((o) => o.id));
  if (!optionIds.has(optionId)) {
    throw new Error("잘못된 보기에요");
  }

  const supabase = await createClient();

  // 1) 투표 INSERT — UNIQUE(poll_id, user_id) 충돌은 멱등 처리
  const voteResp = (await (
    supabase.from("tori_fm_poll_votes" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    poll_id: pollId,
    user_id: user.id,
    option_id: optionId,
  } satisfies Row)) as { error: SbErr };

  if (voteResp.error) {
    if (voteResp.error.code === "23505") {
      // 이미 투표 — 조용히 종료
      revalidateFm(poll.session_id, user.orgId);
      return;
    }
    console.error("[fm/votePoll] insert error", {
      code: voteResp.error.code,
    });
    throw new Error("투표에 실패했어요");
  }

  // 2) options jsonb cache bump — load → mutate → update
  const nextOptions: FmPollOption[] = poll.options.map((o) =>
    o.id === optionId ? { ...o, votes: (o.votes ?? 0) + 1 } : o
  );

  const updResp = (await (
    supabase.from("tori_fm_polls" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ options: nextOptions })
    .eq("id", pollId)) as { error: SbErr };

  if (updResp.error) {
    // 캐시 드리프트일 뿐 — 실제 표는 poll_votes 에 박혔음. 로그만 남김.
    console.error("[fm/votePoll] options cache drift", {
      code: updResp.error.code,
    });
  }

  revalidateFm(poll.session_id, user.orgId);
}

/* ========================================================================== */
/* DJ (org) actions                                                           */
/* ========================================================================== */

/**
 * 세션 소유 기관 검증 — 매 요청 session_id → org_id 조회.
 */
async function assertSessionOwnedByOrg(
  sessionId: string,
  orgId: string
): Promise<void> {
  const session = await loadFmSessionById(sessionId);
  if (!session) throw new Error("세션을 찾을 수 없어요");
  if (session.org_id !== orgId) {
    throw new Error("이 세션에 대한 권한이 없어요");
  }
}

/**
 * DJ 메시지 전송 — sender_type='DJ', sender_name=org.orgName.
 */
export async function sendDjMessageAction(
  sessionId: string,
  message: string
): Promise<void> {
  const org = await requireOrg();
  if (!sessionId) throw new Error("세션을 찾을 수 없어요");

  const text = (message ?? "").trim();
  if (!text) throw new Error("메시지를 입력해 주세요");
  if (text.length > 300) {
    throw new Error("메시지는 300자까지만 보낼 수 있어요");
  }

  await assertSessionOwnedByOrg(sessionId, org.orgId);

  const supabase = await createClient();
  const resp = (await (
    supabase.from("tori_fm_chat_messages" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    session_id: sessionId,
    user_id: null,
    sender_type: "DJ",
    sender_name: org.orgName || "DJ",
    message: text,
  } satisfies Row)) as { error: SbErr };

  if (resp.error) {
    console.error("[fm/sendDjMessage] error", { code: resp.error.code });
    throw new Error("DJ 메시지 전송에 실패했어요");
  }

  revalidateFm(sessionId, org.orgId);
}

/**
 * 채팅 메시지 숨기기 — is_deleted=true (물리 삭제 아님).
 */
export async function deleteChatMessageAction(
  messageId: string
): Promise<void> {
  const org = await requireOrg();
  if (!messageId) throw new Error("메시지를 찾을 수 없어요");

  const supabase = await createClient();

  // 소유 검증 — 메시지의 session_id 가 org 소유인지.
  const msgResp = (await (
    supabase.from("tori_fm_chat_messages" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ id: string; session_id: string }>
          >;
        };
      };
    }
  )
    .select("id, session_id")
    .eq("id", messageId)
    .maybeSingle()) as SbRespOne<{ id: string; session_id: string }>;

  if (!msgResp.data) throw new Error("메시지를 찾을 수 없어요");
  await assertSessionOwnedByOrg(msgResp.data.session_id, org.orgId);

  const updResp = (await (
    supabase.from("tori_fm_chat_messages" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ is_deleted: true })
    .eq("id", messageId)) as { error: SbErr };

  if (updResp.error) {
    console.error("[fm/deleteChatMessage] error", {
      code: updResp.error.code,
    });
    throw new Error("메시지 숨기기에 실패했어요");
  }

  revalidateFm(msgResp.data.session_id, org.orgId);
}

/**
 * 투표 생성 — 기존 ACTIVE 투표가 있으면 자동 종료.
 * options: ["사과","바나나",...] (2~5개).
 */
export async function createPollAction(
  sessionId: string,
  formData: FormData
): Promise<void> {
  const org = await requireOrg();
  if (!sessionId) throw new Error("세션을 찾을 수 없어요");

  await assertSessionOwnedByOrg(sessionId, org.orgId);

  const question = clampString(String(formData.get("question") ?? ""), 200);
  if (!question) throw new Error("투표 질문을 입력해 주세요");

  // options 는 FormData.getAll("options") 로 다중 추출.
  const rawOptions = formData.getAll("options");
  const optionLabels = rawOptions
    .map((v) => clampString(String(v ?? ""), 100))
    .filter((s): s is string => !!s);

  if (optionLabels.length < 2) {
    throw new Error("보기를 2개 이상 입력해 주세요");
  }
  if (optionLabels.length > 5) {
    throw new Error("보기는 최대 5개까지에요");
  }

  const durationSecRaw = Number(formData.get("duration_sec") ?? 60);
  const durationSec = Math.max(
    15,
    Math.min(600, Number.isFinite(durationSecRaw) ? durationSecRaw : 60)
  );

  const nowMs = Date.now();
  const options: FmPollOption[] = optionLabels.map((label, i) => ({
    id: `opt-${i}`,
    label,
    votes: 0,
  }));

  const supabase = await createClient();

  // 1) 기존 ACTIVE 투표 종료
  const active = await loadActivePoll(sessionId);
  if (active) {
    await endPollInternal(supabase, active.id);
  }

  // 2) 새 투표 INSERT
  const insResp = (await (
    supabase.from("tori_fm_polls" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    session_id: sessionId,
    question,
    options,
    duration_sec: durationSec,
    starts_at: new Date(nowMs).toISOString(),
    ends_at: new Date(nowMs + durationSec * 1000).toISOString(),
    status: "ACTIVE",
  } satisfies Row)) as { error: SbErr };

  if (insResp.error) {
    console.error("[fm/createPoll] error", { code: insResp.error.code });
    throw new Error("투표 생성에 실패했어요");
  }

  revalidateFm(sessionId, org.orgId);
}

/**
 * 투표 종료 — status=ENDED, winner_option_id 계산. 내부 재사용용.
 */
async function endPollInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pollId: string
): Promise<void> {
  // 최신 options 재로드 — 투표 캐시 기준.
  const fresh = (await (
    supabase.from("tori_fm_polls" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ id: string; options: FmPollOption[]; status: string }>
          >;
        };
      };
    }
  )
    .select("id, options, status")
    .eq("id", pollId)
    .maybeSingle()) as SbRespOne<{
    id: string;
    options: FmPollOption[];
    status: string;
  }>;

  if (!fresh.data) return;
  if (fresh.data.status === "ENDED" || fresh.data.status === "CANCELLED") {
    return; // 멱등
  }

  // 가장 많은 표를 받은 option — 동률이면 가장 앞쪽.
  let winner: FmPollOption | null = null;
  for (const o of fresh.data.options ?? []) {
    if (!winner || (o.votes ?? 0) > (winner.votes ?? 0)) {
      winner = o;
    }
  }

  const updResp = (await (
    supabase.from("tori_fm_polls" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      status: "ENDED",
      winner_option_id: winner?.id ?? null,
    })
    .eq("id", pollId)) as { error: SbErr };

  if (updResp.error) {
    console.error("[fm/endPoll] error", { code: updResp.error.code });
    throw new Error("투표 종료에 실패했어요");
  }
}

export async function endPollAction(pollId: string): Promise<void> {
  const org = await requireOrg();
  if (!pollId) throw new Error("투표를 찾을 수 없어요");

  const poll = await loadPollById(pollId);
  if (!poll) throw new Error("투표를 찾을 수 없어요");
  await assertSessionOwnedByOrg(poll.session_id, org.orgId);

  const supabase = await createClient();
  await endPollInternal(supabase, pollId);

  revalidateFm(poll.session_id, org.orgId);
}

/**
 * 신청곡 상태 전환 공용 — DJ 전용.
 */
async function setRequestStatus(
  requestId: string,
  status: "APPROVED" | "HIDDEN" | "PLAYED"
): Promise<void> {
  const org = await requireOrg();
  if (!requestId) throw new Error("신청곡을 찾을 수 없어요");

  const supabase = await createClient();

  // 소유 검증
  const reqResp = (await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ id: string; session_id: string }>
          >;
        };
      };
    }
  )
    .select("id, session_id")
    .eq("id", requestId)
    .maybeSingle()) as SbRespOne<{ id: string; session_id: string }>;

  if (!reqResp.data) throw new Error("신청곡을 찾을 수 없어요");
  await assertSessionOwnedByOrg(reqResp.data.session_id, org.orgId);

  const updResp = (await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ status })
    .eq("id", requestId)) as { error: SbErr };

  if (updResp.error) {
    console.error("[fm/setRequestStatus] error", {
      code: updResp.error.code,
      status,
    });
    throw new Error("신청곡 상태 변경에 실패했어요");
  }

  revalidateFm(reqResp.data.session_id, org.orgId);
}

export async function approveRequestAction(requestId: string): Promise<void> {
  return setRequestStatus(requestId, "APPROVED");
}

export async function hideRequestAction(requestId: string): Promise<void> {
  return setRequestStatus(requestId, "HIDDEN");
}

export async function markRequestPlayedAction(
  requestId: string
): Promise<void> {
  return setRequestStatus(requestId, "PLAYED");
}
