"use server";

// 토리FM interactive layer — server actions.
// USER side: requireAppUser (campnic_user 쿠키)
// DJ side:   requireOrg    (campnic_org 쿠키)
//
// 채팅/리액션/신청곡/하트를 한 파일에 묶음. revalidatePath 는
// /(user)/tori-fm 와 /org/[orgId]/tori-fm/[sessionId] 양쪽을 찍는다.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/user-auth-guard";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadFmSessionById } from "@/lib/missions/queries";
import type { ReactionEmoji } from "@/lib/tori-fm/types";
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

/* ========================================================================== */
/* SPOTLIGHT — DJ 콘솔 → 전광판 즉석 푸시                                       */
/* ========================================================================== */

import {
  DEFAULT_SPOTLIGHT_DURATION_SEC,
  type SpotlightKind,
} from "@/lib/tori-fm/spotlight";

const SPOTLIGHT_KINDS: SpotlightKind[] = [
  "STORY",
  "HEART_RAIN",
  "EMOJI_RAIN",
  "BANNER",
];

/**
 * 전광판에 스포트라이트 이벤트를 트리거.
 *  - 같은 세션의 동일 kind 활성 row 가 있으면 먼저 dismiss 처리 (overwrite).
 *  - 새 row INSERT, expires_at = now() + duration (kind 별 기본값, durationSec 로 override 가능).
 *  - durationSec === 0 또는 default 가 null → expires_at NULL (DJ 명시 dismiss 까지).
 */
export async function triggerSpotlightAction(
  sessionId: string,
  kind: SpotlightKind,
  payload: Record<string, unknown> = {},
  durationSec?: number
): Promise<void> {
  const session = await requireOrg();
  if (!sessionId) throw new Error("세션이 필요해요");
  if (!SPOTLIGHT_KINDS.includes(kind)) {
    throw new Error("지원하지 않는 스포트라이트 종류예요");
  }

  // 세션이 이 기관 소유인지 확인
  const sessionRow = await loadFmSessionById(sessionId);
  if (!sessionRow || sessionRow.org_id !== session.orgId) {
    throw new Error("권한이 없어요");
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  // 1) 기존 동일 kind 활성 row dismiss (앱 레이어 정책 — 한 종류는 한 번에 1개만)
  const dismissResp = (await (
    supabase.from("fm_spotlight_events" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            is: (k: string, v: null) => Promise<{ error: SbErr }>;
          };
        };
      };
    }
  )
    .update({ dismissed_at: nowIso })
    .eq("session_id", sessionId)
    .eq("kind", kind)
    .is("dismissed_at", null)) as { error: SbErr };

  if (dismissResp.error) {
    console.error("[spotlight] dismiss prev failed", {
      kind,
      sessionId,
      message: dismissResp.error.message,
      code: dismissResp.error.code,
    });
    // 테이블이 없거나 권한 문제 — 사용자에게 명확한 메시지로 throw
    throw new Error(
      `스포트라이트 테이블 접근 실패: ${dismissResp.error.message ?? "unknown"}. ` +
        `Supabase 에 마이그레이션(20260605000000_fm_spotlight_events.sql)이 적용됐는지 확인해 주세요.`
    );
  }

  // 2) duration 결정
  const defaultDuration = DEFAULT_SPOTLIGHT_DURATION_SEC[kind];
  const finalDuration =
    typeof durationSec === "number" && durationSec > 0
      ? durationSec
      : defaultDuration;
  const expiresIso =
    finalDuration === null
      ? null
      : new Date(Date.now() + finalDuration * 1000).toISOString();

  // 3) 새 row INSERT
  const insertResp = (await (
    supabase.from("fm_spotlight_events" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    session_id: sessionId,
    kind,
    payload_json: payload,
    triggered_at: nowIso,
    expires_at: expiresIso,
    triggered_by_org_id: session.orgId,
  } satisfies Row)) as { error: SbErr };

  if (insertResp.error) {
    console.error("[spotlight] insert failed", {
      kind,
      sessionId,
      message: insertResp.error.message,
      code: insertResp.error.code,
    });
    throw new Error(
      `스포트라이트 INSERT 실패: ${insertResp.error.message ?? "unknown"}. ` +
        `테이블/RLS 정책 확인 필요.`
    );
  }

  console.log("[spotlight] triggered OK", { kind, sessionId, expiresIso });
  revalidateFm(sessionId, session.orgId);
}

/**
 * 활성 스포트라이트를 즉시 종료 (dismiss).
 *  - kind 단위 dismiss: 같은 session 의 같은 kind 활성 row 모두 dismiss.
 */
export async function dismissSpotlightAction(
  sessionId: string,
  kind: SpotlightKind
): Promise<void> {
  const session = await requireOrg();
  if (!sessionId) throw new Error("세션이 필요해요");

  const sessionRow = await loadFmSessionById(sessionId);
  if (!sessionRow || sessionRow.org_id !== session.orgId) {
    throw new Error("권한이 없어요");
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  await (
    supabase.from("fm_spotlight_events" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            is: (k: string, v: null) => Promise<{ error: SbErr }>;
          };
        };
      };
    }
  )
    .update({ dismissed_at: nowIso })
    .eq("session_id", sessionId)
    .eq("kind", kind)
    .is("dismissed_at", null);

  revalidateFm(sessionId, session.orgId);
}
