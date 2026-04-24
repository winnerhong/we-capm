"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";

function cleanReply(reply: string): string {
  const trimmed = reply.trim();
  if (!trimmed) throw new Error("답글 내용을 입력해주세요");
  if (trimmed.length > 2000) throw new Error("답글은 2000자 이하로 작성해주세요");
  return trimmed;
}

/**
 * 내부(토리로) 리뷰 답글 등록/수정
 * reviews 테이블에 response_text 업데이트
 */
export async function replyReviewAction(
  reviewId: string,
  reply: string
): Promise<void> {
  await requirePartner();
  if (!reviewId) throw new Error("리뷰 ID가 없어요");
  const text = cleanReply(reply);

  const supabase = await createClient();
  try {
    await (supabase.from("reviews" as never) as any)
      .update({
        response_text: text,
        replied_at: new Date().toISOString(),
      })
      .eq("id", reviewId);
  } catch {
    // 테이블이 없거나 쿼리 실패 — 조용히 무시 (데모 환경)
  }
  revalidatePath("/partner/marketing/reviews");
}

/**
 * 외부(네이버/구글 등) 리뷰 답글 등록/수정
 * partner_external_reviews.response_text 업데이트
 */
export async function replyExternalReviewAction(
  reviewId: string,
  reply: string
): Promise<void> {
  await requirePartner();
  if (!reviewId) throw new Error("리뷰 ID가 없어요");
  const text = cleanReply(reply);

  const supabase = await createClient();
  try {
    await (supabase.from("partner_external_reviews" as never) as any)
      .update({
        response_text: text,
        response_at: new Date().toISOString(),
      })
      .eq("id", reviewId);
  } catch {
    // ignore
  }
  revalidatePath("/partner/marketing/reviews");
}

/**
 * 리뷰 신고 플래그 토글
 */
export async function flagReviewAction(
  reviewId: string,
  flagged: boolean
): Promise<void> {
  await requirePartner();
  if (!reviewId) throw new Error("리뷰 ID가 없어요");

  const supabase = await createClient();
  try {
    await (supabase.from("partner_external_reviews" as never) as any)
      .update({ is_flagged: flagged })
      .eq("id", reviewId);
  } catch {
    // ignore
  }
  try {
    await (supabase.from("reviews" as never) as any)
      .update({ is_flagged: flagged })
      .eq("id", reviewId);
  } catch {
    // ignore
  }
  revalidatePath("/partner/marketing/reviews");
}

/**
 * 리뷰 요청 발송 (mock): event_registrations.review_requested_at 세팅
 */
export async function requestReviewAction(registrationId: string): Promise<void> {
  await requirePartner();
  if (!registrationId) throw new Error("등록 ID가 없어요");

  const supabase = await createClient();
  try {
    await (supabase.from("event_registrations" as never) as any)
      .update({ review_requested_at: new Date().toISOString() })
      .eq("id", registrationId);
  } catch {
    // 컬럼이 없을 수 있음 — SMS 로그만 남기는 시뮬레이션
  }
  revalidatePath("/partner/marketing/reviews/request");
}
