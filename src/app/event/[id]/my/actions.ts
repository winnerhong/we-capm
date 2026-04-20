"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { logAccess } from "@/lib/audit-log";

/**
 * PIPA Article 36 — 개인정보 정정권
 * 이름/이메일 등 기본정보를 수정한다.
 */
export async function updateMyInfoAction(eventId: string, formData: FormData) {
  const session = await getParticipant(eventId);
  if (!session) throw new Error("로그인이 필요해요");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;

  if (!name) throw new Error("이름을 입력해 주세요");
  if (name.length > 40) throw new Error("이름이 너무 길어요");

  const supabase = await createClient();

  // participants.name은 컬럼이 없고 event_registrations.name을 사용
  const { error: regErr } = await (
    supabase.from("event_registrations") as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .update({ name } as never)
    .eq("event_id", eventId)
    .eq("phone", session.phone);

  if (regErr) throw new Error(`정보 수정 실패: ${regErr.message}`);

  // 쿠키도 동기화
  const cookieStore = await cookies();
  cookieStore.set(
    "campnic_participant",
    JSON.stringify({
      eventId,
      name,
      phone: session.phone,
      participantId: session.participantId,
      registrationId: session.registrationId,
    }),
    {
      httpOnly: false,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    }
  );

  await logAccess(supabase, {
    user_type: "PARTICIPANT",
    user_identifier: session.phone,
    action: "UPDATE_PROFILE",
    resource: `event:${eventId}`,
  });

  // 이메일은 별도 테이블에 저장하고 있지 않다면 no-op. 존재 시에만 저장.
  // (토리로 스키마에서는 email 컬럼이 없으므로 여기서는 로깅만)
  void email;

  revalidatePath(`/event/${eventId}/my`);
  redirect(`/event/${eventId}/my?updated=1`);
}

/**
 * PIPA Article 37 — 처리 정지권 (회원 탈퇴)
 * 참가자 관련 모든 데이터를 영구 삭제한다.
 */
export async function withdrawAccountAction(eventId: string, formData: FormData) {
  const session = await getParticipant(eventId);
  if (!session) throw new Error("로그인이 필요해요");

  const confirm = String(formData.get("confirm") ?? "");
  if (confirm !== "탈퇴합니다") {
    throw new Error("확인 문구를 정확히 입력해 주세요");
  }

  const reason = String(formData.get("reason") ?? "").trim() || null;
  const reasonDetail = String(formData.get("reason_detail") ?? "").trim() || null;

  const supabase = await createClient();

  // participant id 찾기
  const { data: participant } = await (
    supabase.from("participants") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: { id: string } | null }>;
          };
        };
      };
    }
  )
    .select("id")
    .eq("event_id", eventId)
    .eq("phone", session.phone)
    .maybeSingle();

  const participantId = participant?.id ?? session.participantId ?? null;

  // 감사 로그 먼저 (삭제 전 기록)
  await logAccess(supabase, {
    user_type: "PARTICIPANT",
    user_id: participantId ?? undefined,
    user_identifier: session.phone,
    action: "WITHDRAW_ACCOUNT",
    resource: `event:${eventId}${reason ? ` reason:${reason}` : ""}${
      reasonDetail ? ` detail:${reasonDetail}` : ""
    }`,
  });

  // 관련 데이터 cascade 삭제 (PIPA 준수 — 복구 불가)
  if (participantId) {
    // 제출물
    await (supabase.from("submissions") as unknown as {
      delete: () => { eq: (k: string, v: string) => Promise<unknown> };
    })
      .delete()
      .eq("participant_id", participantId);

    // 보상 수령
    await (supabase.from("reward_claims") as unknown as {
      delete: () => { eq: (k: string, v: string) => Promise<unknown> };
    })
      .delete()
      .eq("participant_id", participantId);

    // 참가자 레코드
    await (supabase.from("participants") as unknown as {
      delete: () => { eq: (k: string, v: string) => Promise<unknown> };
    })
      .delete()
      .eq("id", participantId);
  }

  // 채팅 멤버십
  await (supabase.from("chat_members") as unknown as {
    delete: () => { eq: (k: string, v: string) => Promise<unknown> };
  })
    .delete()
    .eq("participant_phone", session.phone);

  // 행사 등록
  await (supabase.from("event_registrations") as unknown as {
    delete: () => {
      eq: (k: string, v: string) => {
        eq: (k: string, v: string) => Promise<unknown>;
      };
    };
  })
    .delete()
    .eq("event_id", eventId)
    .eq("phone", session.phone);

  // 리뷰 (phone 기반)
  await (supabase.from("event_reviews") as unknown as {
    delete: () => {
      eq: (k: string, v: string) => {
        eq: (k: string, v: string) => Promise<unknown>;
      };
    };
  })
    .delete()
    .eq("event_id", eventId)
    .eq("participant_phone", session.phone);

  // 쿠키 제거
  const cookieStore = await cookies();
  cookieStore.delete("campnic_participant");

  redirect(`/?withdrawn=1`);
}
