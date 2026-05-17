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
import { loadChildrenForUser } from "@/lib/app-user/queries";
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
 * 보호자의 자녀 이름을 "{반} {이름} 가족" 형태의 표시명으로 변환한다.
 *  - 원생(is_enrolled=true) 우선, 여러 명이면 "{첫이름} 외 {N-1}명 가족"
 *  - 자녀 class_name 이 있으면 가장 앞에 prefix (예: "햇살반 유하준 가족")
 *  - 자녀 정보가 없으면 부모 이름 + 가족 → 최후 "익명 가족"
 */
function deriveDisplayName(
  children: {
    name: string;
    is_enrolled: boolean;
    class_name: string | null;
  }[],
  parentName: string
): string {
  const enrolled = children.filter((c) => c.is_enrolled && c.name?.trim());
  const named = enrolled.length > 0 ? enrolled : children.filter((c) => c.name?.trim());
  const className = named.find((c) => c.class_name?.trim())?.class_name?.trim();
  const prefix = className ? `${className} ` : "";
  if (named.length === 1) return `${prefix}${named[0].name.trim()} 가족`;
  if (named.length >= 2) {
    return `${prefix}${named[0].name.trim()} 외 ${named.length - 1}명 가족`;
  }
  if (parentName?.trim()) return `${parentName.trim()} 가족`;
  return "익명 가족";
}

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

  // 자녀 이름을 표시명으로 사용 (없으면 부모 이름 fallback)
  const children = await loadChildrenForUser(user.id);
  const displayName = deriveDisplayName(
    children.map((c) => ({
      name: c.name,
      is_enrolled: c.is_enrolled,
      class_name: c.class_name,
    })),
    user.parentName
  );

  const supabase = await createClient();
  const resp = (await (
    supabase.from("tori_fm_chat_messages" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    session_id: sessionId,
    user_id: user.id,
    sender_type: "USER",
    sender_name: displayName,
    message: text,
  } satisfies Row)) as { error: SbErr };

  if (resp.error) {
    console.error("[fm/sendChatMessage] error", { code: resp.error.code });
    throw new Error("채팅 전송에 실패했어요");
  }

  revalidateFm(sessionId, user.orgId);
}

/**
 * 본인 채팅 메시지 수정 — 작성자(user_id) 본인만 가능.
 *  - is_deleted=true 메시지는 수정 불가
 *  - 1~300자 제약
 */
export async function editOwnChatMessageAction(
  messageId: string,
  newText: string
): Promise<void> {
  const user = await requireAppUser();
  if (!messageId) throw new Error("메시지를 찾을 수 없어요");

  const text = (newText ?? "").trim();
  if (!text) throw new Error("메시지를 입력해 주세요");
  if (text.length > 300) {
    throw new Error("메시지는 300자까지만 보낼 수 있어요");
  }

  const supabase = await createClient();

  // 소유 검증 — 메시지가 이 user 의 것인지.
  const msgResp = (await (
    supabase.from("tori_fm_chat_messages" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{
              id: string;
              user_id: string | null;
              session_id: string;
              is_deleted: boolean;
            }>
          >;
        };
      };
    }
  )
    .select("id, user_id, session_id, is_deleted")
    .eq("id", messageId)
    .maybeSingle()) as SbRespOne<{
    id: string;
    user_id: string | null;
    session_id: string;
    is_deleted: boolean;
  }>;

  if (!msgResp.data) throw new Error("메시지를 찾을 수 없어요");
  if (msgResp.data.user_id !== user.id) {
    throw new Error("본인이 보낸 메시지만 수정할 수 있어요");
  }
  if (msgResp.data.is_deleted) {
    throw new Error("이미 삭제된 메시지에요");
  }

  const updResp = (await (
    supabase.from("tori_fm_chat_messages" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ message: text })
    .eq("id", messageId)) as { error: SbErr };

  if (updResp.error) {
    console.error("[fm/editOwnChatMessage] error", {
      code: updResp.error.code,
    });
    throw new Error("메시지 수정에 실패했어요");
  }

  revalidateFm(msgResp.data.session_id, user.orgId);
}

/**
 * 본인 채팅 메시지 삭제 (soft) — 작성자(user_id) 본인만 가능.
 *  - is_deleted=true 로 표시. 다른 client 는 Realtime UPDATE 로 즉시 사라짐.
 */
export async function deleteOwnChatMessageAction(
  messageId: string
): Promise<void> {
  const user = await requireAppUser();
  if (!messageId) throw new Error("메시지를 찾을 수 없어요");

  const supabase = await createClient();

  const msgResp = (await (
    supabase.from("tori_fm_chat_messages" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{
              id: string;
              user_id: string | null;
              session_id: string;
            }>
          >;
        };
      };
    }
  )
    .select("id, user_id, session_id")
    .eq("id", messageId)
    .maybeSingle()) as SbRespOne<{
    id: string;
    user_id: string | null;
    session_id: string;
  }>;

  if (!msgResp.data) throw new Error("메시지를 찾을 수 없어요");
  if (msgResp.data.user_id !== user.id) {
    throw new Error("본인이 보낸 메시지만 삭제할 수 있어요");
  }

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
    console.error("[fm/deleteOwnChatMessage] error", {
      code: updResp.error.code,
    });
    throw new Error("메시지 삭제에 실패했어요");
  }

  revalidateFm(msgResp.data.session_id, user.orgId);
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

  // kind 판정 — story_only 면 곡명 없이 사연만 + 익명 처리.
  const kindRaw = String(formData.get("kind") ?? "song_request");
  const kind: "song_request" | "story_only" =
    kindRaw === "story_only" ? "story_only" : "song_request";

  const songTitleRaw = clampString(String(formData.get("song_title") ?? ""), 200);
  const artist = clampString(String(formData.get("artist") ?? ""), 200);
  const story = clampString(String(formData.get("story") ?? ""), 500);
  const childName = clampString(String(formData.get("child_name") ?? ""), 50);

  // 분기 검증
  if (kind === "song_request") {
    if (!songTitleRaw) throw new Error("노래 제목을 입력해 주세요");
  } else {
    if (!story) throw new Error("사연을 입력해 주세요");
  }

  const songTitle = kind === "song_request" ? songTitleRaw : null;

  const session = await loadFmSessionById(sessionId);
  if (!session) throw new Error("세션을 찾을 수 없어요");
  if (session.org_id !== user.orgId) {
    throw new Error("다른 기관의 방송에는 신청할 수 없어요");
  }
  // LIVE 인 세션에만 신청 가능 — 방송 전 미리 받기는 운영상 혼란을 일으켜 비활성.
  if (!session.is_live) {
    throw new Error("방송 중일 때만 신청할 수 있어요");
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
    // story_only 도 작성자 표시 — child_name 은 항상 저장.
    artist: kind === "song_request" ? artist : null,
    story,
    child_name: childName || null,
    heart_count: 0,
    status: "PENDING",
    kind,
    is_anonymous: false,
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
 *  - HIDDEN 으로 전이할 때는 boost 자동 환불 (PLAYED 는 정상 재생이라 환불 없음).
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

  // HIDDEN 으로 가는 경우 boost 환불 — status update 보다 먼저 수행해서
  // 환불 실패 시 상태도 안 바뀌도록.
  if (status === "HIDDEN") {
    await refundAllBoostsForRequest(supabase, requestId);
  }

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
/* BROADCAST QUEUE — 방송 대기 큐 + 재생 컨트롤                                  */
/* ========================================================================== */

/**
 * "방송에 올리기" — 신청곡을 방송 대기 큐 끝에 추가.
 *  - status='QUEUED', queue_position = 같은 세션 QUEUED 의 max+1
 *  - 같은 세션의 다른 호스트와 동시 클릭 시 충돌 가능성 낮음 (LIVE 1명 운영)
 */
export async function queueRequestAction(requestId: string): Promise<void> {
  const org = await requireOrg();
  if (!requestId) throw new Error("신청곡을 찾을 수 없어요");

  const supabase = await createClient();
  const reqResp = (await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ id: string; session_id: string; status: string }>
          >;
        };
      };
    }
  )
    .select("id, session_id, status")
    .eq("id", requestId)
    .maybeSingle()) as SbRespOne<{
    id: string;
    session_id: string;
    status: string;
  }>;

  if (!reqResp.data) throw new Error("신청곡을 찾을 수 없어요");
  if (reqResp.data.status === "PLAYING" || reqResp.data.status === "PLAYED") {
    throw new Error("이미 방송된 곡이에요");
  }
  await assertSessionOwnedByOrg(reqResp.data.session_id, org.orgId);

  // 같은 세션 QUEUED 의 max position + 1
  const maxResp = (await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean; nullsFirst?: boolean }
            ) => {
              limit: (n: number) => Promise<{
                data: Array<{ queue_position: number | null }> | null;
              }>;
            };
          };
        };
      };
    }
  )
    .select("queue_position")
    .eq("session_id", reqResp.data.session_id)
    .eq("status", "QUEUED")
    .order("queue_position", { ascending: false, nullsFirst: false })
    .limit(1)) as { data: Array<{ queue_position: number | null }> | null };

  const maxPos = maxResp.data?.[0]?.queue_position ?? 0;
  const nextPos = maxPos + 1;

  const updResp = (await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ status: "QUEUED", queue_position: nextPos })
    .eq("id", requestId)) as { error: SbErr };

  if (updResp.error) {
    console.error("[fm/queueRequest] error", { code: updResp.error.code });
    throw new Error("큐에 올리지 못했어요");
  }

  revalidateFm(reqResp.data.session_id, org.orgId);
}

/**
 * 큐에서 빼기 — APPROVED 로 되돌림. queue_position NULL.
 */
export async function unqueueRequestAction(requestId: string): Promise<void> {
  const org = await requireOrg();
  if (!requestId) throw new Error("신청곡을 찾을 수 없어요");

  const supabase = await createClient();
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

  await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ status: "APPROVED", queue_position: null })
    .eq("id", requestId);

  revalidateFm(reqResp.data.session_id, org.orgId);
}

/**
 * 큐 항목 위/아래 이동 — 같은 세션 인접 항목과 queue_position 스왑.
 */
export async function reorderQueueAction(
  requestId: string,
  direction: "up" | "down"
): Promise<void> {
  const org = await requireOrg();
  if (!requestId) throw new Error("신청곡을 찾을 수 없어요");

  const supabase = await createClient();
  const reqResp = (await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{
              id: string;
              session_id: string;
              status: string;
              queue_position: number | null;
            }>
          >;
        };
      };
    }
  )
    .select("id, session_id, status, queue_position")
    .eq("id", requestId)
    .maybeSingle()) as SbRespOne<{
    id: string;
    session_id: string;
    status: string;
    queue_position: number | null;
  }>;

  if (!reqResp.data) throw new Error("신청곡을 찾을 수 없어요");
  if (reqResp.data.status !== "QUEUED" || reqResp.data.queue_position == null) {
    throw new Error("큐에 올라간 항목만 이동할 수 있어요");
  }
  await assertSessionOwnedByOrg(reqResp.data.session_id, org.orgId);

  const myPos = reqResp.data.queue_position;
  const sessionId = reqResp.data.session_id;

  // 인접 항목 찾기
  const neighborResp = (await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => {
              limit: (n: number) => Promise<{
                data: Array<{ id: string; queue_position: number | null }> | null;
              }>;
            };
          };
        };
      };
    }
  )
    .select("id, queue_position")
    .eq("session_id", sessionId)
    .eq("status", "QUEUED")
    .order("queue_position", { ascending: direction === "up" })
    .limit(20)) as {
    data: Array<{ id: string; queue_position: number | null }> | null;
  };

  // direction='up' 이면 myPos 보다 작은 가장 큰 항목,
  // direction='down' 이면 myPos 보다 큰 가장 작은 항목.
  const neighbor = (neighborResp.data ?? []).find((r) => {
    if (r.id === requestId || r.queue_position == null) return false;
    return direction === "up"
      ? r.queue_position < myPos
      : r.queue_position > myPos;
  });

  if (!neighbor || neighbor.queue_position == null) {
    return; // 끝점이라 이동 불가
  }

  // 두 항목 position 스왑
  await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ queue_position: neighbor.queue_position })
    .eq("id", requestId);
  await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ queue_position: myPos })
    .eq("id", neighbor.id);

  revalidateFm(sessionId, org.orgId);
}

/**
 * [▶ 다음 곡] — 현재 PLAYING 묶음 → PLAYED, 큐 첫 항목과 같은 곡(song_normalized)
 * 사연들을 함께 PLAYING 으로 묶음 처리.
 *  - 같은 song_normalized 의 PENDING/APPROVED/QUEUED 항목 모두 묶어 PLAYING.
 *  - story_only(곡명 없음) 는 묶음 X — 한 row 만 PLAYING.
 *  - 큐 비어있으면 단순히 PLAYING → PLAYED.
 */
export async function playNextFromQueueAction(
  sessionId: string
): Promise<{ playingId: string | null }> {
  const org = await requireOrg();
  if (!sessionId) throw new Error("세션을 찾을 수 없어요");
  await assertSessionOwnedByOrg(sessionId, org.orgId);

  const supabase = await createClient();

  // 1) 현재 PLAYING 묶음 → PLAYED
  await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .update({ status: "PLAYED", queue_position: null })
    .eq("session_id", sessionId)
    .eq("status", "PLAYING");

  // 2) 큐 첫 항목 (queue_position ASC) 조회 — kind/song_normalized 필요
  const nextResp = (await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean; nullsFirst?: boolean }
            ) => {
              limit: (n: number) => {
                maybeSingle: () => Promise<
                  SbRespOne<{
                    id: string;
                    kind: string | null;
                    song_normalized: string | null;
                  }>
                >;
              };
            };
          };
        };
      };
    }
  )
    .select("id, kind, song_normalized")
    .eq("session_id", sessionId)
    .eq("status", "QUEUED")
    .order("queue_position", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()) as SbRespOne<{
    id: string;
    kind: string | null;
    song_normalized: string | null;
  }>;

  if (!nextResp.data?.id) {
    revalidateFm(sessionId, org.orgId);
    return { playingId: null };
  }

  const next = nextResp.data;

  // 3a) song_request + song_normalized 가 있으면 같은 곡 묶음 PLAYING
  //     (PENDING/APPROVED/QUEUED 중 같은 song_normalized 모두 한번에)
  const isBundleable =
    (next.kind === "song_request" || next.kind === null) &&
    !!next.song_normalized;

  if (isBundleable) {
    await (
      supabase.from("tori_fm_requests" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              in: (k: string, v: string[]) => Promise<{ error: SbErr }>;
            };
          };
        };
      }
    )
      .update({ status: "PLAYING", queue_position: null })
      .eq("session_id", sessionId)
      .eq("song_normalized", next.song_normalized as string)
      .in("status", ["PENDING", "APPROVED", "QUEUED"]);
  } else {
    // 3b) story_only 또는 song_normalized 비어있는 경우 — 단일 row 만 PLAYING
    await (
      supabase.from("tori_fm_requests" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({ status: "PLAYING", queue_position: null })
      .eq("id", next.id);
  }

  revalidateFm(sessionId, org.orgId);
  return { playingId: next.id };
}

/**
 * [⏹ 정지] — 현재 PLAYING 을 PLAYED 로 (다음 곡 자동 X).
 */
export async function stopPlayingAction(sessionId: string): Promise<void> {
  const org = await requireOrg();
  if (!sessionId) throw new Error("세션을 찾을 수 없어요");
  await assertSessionOwnedByOrg(sessionId, org.orgId);

  const supabase = await createClient();
  await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .update({ status: "PLAYED", queue_position: null })
    .eq("session_id", sessionId)
    .eq("status", "PLAYING");

  revalidateFm(sessionId, org.orgId);
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

/* ========================================================================== */
/* BOOST — 신청곡 경매 (도토리 추가 지불로 상위 정렬)                            */
/* ========================================================================== */

// 1회 boost 한도: UX 안전망. 잔액 보유 한도에 추가로 클라이언트도 동일 검증.
const BOOST_MIN = 1;
const BOOST_MAX = 99_999;

/**
 * 결과 객체 — production throw 마스킹 회피.
 */
export type BoostRequestResult =
  | {
      ok: true;
      /** boost 후 누적 boost_amount */
      newBoostAmount: number;
      /** boost 후 사용자 도토리 잔액 */
      newBalance: number;
    }
  | { ok: false; error: string };

/**
 * 신청곡 boost — 청취자가 도토리를 지불해서 정렬 우선순위를 끌어올린다.
 *  - 본인/타인 신청 모두 boost 가능
 *  - 누적: 같은 신청에 여러 번 boost 시 boost_amount 누적
 *  - HIDDEN 처리 시 환불은 setRequestStatus → refundAllBoostsForRequest
 *  - 원자성: balance 차감을 `acorn_balance >= amount` 조건부 UPDATE 로 묶어
 *    동시성 경쟁/오차 회피. 나머지 단계는 best-effort.
 */
export async function boostRequestAction(
  requestId: string,
  amount: number
): Promise<BoostRequestResult> {
  try {
    const user = await requireAppUser();
    if (!requestId) return { ok: false, error: "신청곡을 찾을 수 없어요" };
    if (!Number.isInteger(amount)) {
      return { ok: false, error: "금액이 올바르지 않아요" };
    }
    if (amount < BOOST_MIN) {
      return { ok: false, error: `최소 ${BOOST_MIN} 도토리부터 가능해요` };
    }
    if (amount > BOOST_MAX) {
      return {
        ok: false,
        error: `한 번에 ${BOOST_MAX.toLocaleString("ko-KR")} 도토리까지만 가능해요`,
      };
    }

    const supabase = await createClient();

    // 신청곡 존재 + 상태 검증 (PLAYING/PLAYED/HIDDEN 은 boost 거부)
    const reqResp = (await (
      supabase.from("tori_fm_requests" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<
              SbRespOne<{
                id: string;
                session_id: string;
                status: string;
                boost_amount: number | null;
              }>
            >;
          };
        };
      }
    )
      .select("id, session_id, status, boost_amount")
      .eq("id", requestId)
      .maybeSingle()) as SbRespOne<{
      id: string;
      session_id: string;
      status: string;
      boost_amount: number | null;
    }>;

    if (!reqResp.data) {
      return { ok: false, error: "신청곡을 찾을 수 없어요" };
    }
    const reqRow = reqResp.data;
    if (
      reqRow.status === "PLAYING" ||
      reqRow.status === "PLAYED" ||
      reqRow.status === "HIDDEN"
    ) {
      return { ok: false, error: "이 신청곡은 더 이상 끌어올릴 수 없어요" };
    }

    // 1) 잔액 조회 → 차감 (read-modify-write).
    //    동시성 보호는 차감 update 의 .gte("acorn_balance", amount) 조건으로 atomic 처리.
    const balResp = (await (
      supabase.from("app_users" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<
              SbRespOne<{ acorn_balance: number | null }>
            >;
          };
        };
      }
    )
      .select("acorn_balance")
      .eq("id", user.id)
      .maybeSingle()) as SbRespOne<{ acorn_balance: number | null }>;

    const currentBalance = balResp.data?.acorn_balance ?? 0;
    if (currentBalance < amount) {
      return {
        ok: false,
        error: `도토리가 부족해요 (보유 ${currentBalance.toLocaleString("ko-KR")})`,
      };
    }

    // 차감 — 조건부 update (acorn_balance >= amount) returning new balance
    const nextBalance = currentBalance - amount;
    const deductResp = (await (
      supabase.from("app_users" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => {
            gte: (
              k: string,
              v: number
            ) => {
              select: (c: string) => Promise<{
                data: Array<{ acorn_balance: number }> | null;
                error: SbErr;
              }>;
            };
          };
        };
      }
    )
      .update({ acorn_balance: nextBalance })
      .eq("id", user.id)
      .gte("acorn_balance", amount)
      .select("acorn_balance")) as {
      data: Array<{ acorn_balance: number }> | null;
      error: SbErr;
    };

    if (deductResp.error || (deductResp.data ?? []).length === 0) {
      return {
        ok: false,
        error: "도토리 차감에 실패했어요 (동시 결제 충돌 가능 — 다시 시도)",
      };
    }

    // 2) ledger insert (best-effort; 실패해도 차감은 이미 됨 → 운영 reconcile)
    const txInsert = (await (
      supabase.from("user_acorn_transactions" as never) as unknown as {
        insert: (r: Row) => Promise<{ error: SbErr }>;
      }
    ).insert({
      user_id: user.id,
      amount: -amount, // 차감 → 음수
      reason: "FM_BOOST",
      source_type: "fm_request",
      source_id: requestId,
      memo: `FM boost +${amount}`,
    } satisfies Row)) as { error: SbErr };
    if (txInsert.error) {
      console.error("[fm/boost] tx insert failed (drift)", {
        code: txInsert.error.code,
      });
    }

    // 3) tori_fm_boosts ledger insert
    const boostInsert = (await (
      supabase.from("tori_fm_boosts" as never) as unknown as {
        insert: (r: Row) => Promise<{ error: SbErr }>;
      }
    ).insert({
      request_id: requestId,
      user_id: user.id,
      kind: "CHARGE",
      amount,
    } satisfies Row)) as { error: SbErr };
    if (boostInsert.error) {
      console.error("[fm/boost] boost ledger insert failed", {
        code: boostInsert.error.code,
      });
    }

    // 4) request.boost_amount 누적 + last_boost_at = now
    const currentBoost = reqRow.boost_amount ?? 0;
    const newBoostAmount = currentBoost + amount;
    const nowIso = new Date().toISOString();
    const reqUpd = (await (
      supabase.from("tori_fm_requests" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({
        boost_amount: newBoostAmount,
        last_boost_at: nowIso,
      })
      .eq("id", requestId)) as { error: SbErr };
    if (reqUpd.error) {
      console.error("[fm/boost] request update failed", {
        code: reqUpd.error.code,
      });
    }

    revalidateFm(reqRow.session_id);
    return { ok: true, newBoostAmount, newBalance: nextBalance };
  } catch (e) {
    console.error("[fm/boost] unexpected throw", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "boost 실패",
    };
  }
}

/**
 * 신청곡 환불 — HIDDEN/REJECTED 시 호출. 모든 CHARGE 합산에서
 * 이전 REFUND 합산을 뺀 잔여를 사용자별로 복구.
 *  - net = sum(CHARGE) - sum(REFUND)
 *  - net > 0 인 user 에게만 환불 (이미 환불된 user 는 net=0)
 *  - 각 user 에게: balance += net, ledger insert (FM_BOOST_REFUND), tori_fm_boosts insert (REFUND)
 *  - 마지막에 tori_fm_requests.boost_amount=0, last_boost_at=null 리셋
 */
async function refundAllBoostsForRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string
): Promise<void> {
  type BoostLedgerRow = {
    user_id: string;
    kind: "CHARGE" | "REFUND";
    amount: number;
  };

  const ledger = (await (
    supabase.from("tori_fm_boosts" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ data: BoostLedgerRow[] | null; error: SbErr }>;
      };
    }
  )
    .select("user_id, kind, amount")
    .eq("request_id", requestId)) as {
    data: BoostLedgerRow[] | null;
    error: SbErr;
  };

  if (ledger.error) {
    console.error("[fm/refund] ledger load failed", { code: ledger.error.code });
    return; // 환불 실패해도 status 전이는 계속 — 운영 reconcile 대상
  }

  const netByUser = new Map<string, number>();
  for (const l of ledger.data ?? []) {
    const delta = l.kind === "CHARGE" ? l.amount : -l.amount;
    netByUser.set(l.user_id, (netByUser.get(l.user_id) ?? 0) + delta);
  }

  for (const [userId, net] of netByUser) {
    if (net <= 0) continue;

    // balance 복구
    const balResp = (await (
      supabase.from("app_users" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<
              SbRespOne<{ acorn_balance: number | null }>
            >;
          };
        };
      }
    )
      .select("acorn_balance")
      .eq("id", userId)
      .maybeSingle()) as SbRespOne<{ acorn_balance: number | null }>;

    const before = balResp.data?.acorn_balance ?? 0;
    const after = before + net;

    const balUpd = (await (
      supabase.from("app_users" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({ acorn_balance: after })
      .eq("id", userId)) as { error: SbErr };
    if (balUpd.error) {
      console.error("[fm/refund] balance update failed", {
        userId,
        code: balUpd.error.code,
      });
      continue; // 이 user 는 스킵 (ledger 도 안 넣어서 net 보존)
    }

    // user_acorn_transactions REFUND insert (양수)
    await (
      supabase.from("user_acorn_transactions" as never) as unknown as {
        insert: (r: Row) => Promise<{ error: SbErr }>;
      }
    ).insert({
      user_id: userId,
      amount: net, // 양수 (환불)
      reason: "FM_BOOST_REFUND",
      source_type: "fm_request",
      source_id: requestId,
      memo: `FM boost refund +${net}`,
    } satisfies Row);

    // tori_fm_boosts REFUND row insert
    await (
      supabase.from("tori_fm_boosts" as never) as unknown as {
        insert: (r: Row) => Promise<{ error: SbErr }>;
      }
    ).insert({
      request_id: requestId,
      user_id: userId,
      kind: "REFUND",
      amount: net,
    } satisfies Row);
  }

  // 신청곡 boost_amount 리셋
  await (
    supabase.from("tori_fm_requests" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ boost_amount: 0, last_boost_at: null })
    .eq("id", requestId);
}
