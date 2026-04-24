"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";

const REVIEWS_PATH = "/partner/analytics/reviews";

function cleanReply(reply: string): string {
  const trimmed = reply.trim();
  if (!trimmed) throw new Error("답글 내용을 입력해주세요");
  if (trimmed.length > 2000) throw new Error("답글은 2000자 이하로 작성해주세요");
  return trimmed;
}

type ExternalRow = {
  id: string;
  partner_id: string | null;
  is_flagged: boolean | null;
  platform: string | null;
};

type InternalRow = {
  id: string;
  is_flagged: boolean | null;
};

// -----------------------------
// 1) 내부 리뷰 답글 등록/수정
// -----------------------------
export async function replyInternalReviewAction(
  reviewId: string,
  formData: FormData
): Promise<void> {
  await requirePartner();
  if (!reviewId) throw new Error("리뷰 ID가 없어요");
  const text = cleanReply(String(formData.get("response") ?? ""));

  const supabase = await createClient();
  const { error } = await (supabase.from("event_reviews" as never) as unknown as {
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>;
    };
  })
    .update({
      response_text: text,
      response_at: new Date().toISOString(),
    })
    .eq("id", reviewId);

  if (error) throw new Error(error.message || "답글 저장에 실패했어요");
  revalidatePath(REVIEWS_PATH);
}

// -----------------------------
// 2) 외부 리뷰 답글 등록/수정
// -----------------------------
export async function replyExternalReviewAction(
  reviewId: string,
  formData: FormData
): Promise<void> {
  const partner = await requirePartner();
  if (!reviewId) throw new Error("리뷰 ID가 없어요");
  const text = cleanReply(String(formData.get("response") ?? ""));

  const supabase = await createClient();

  // 소유권 확인
  const { data: existing } = await (supabase.from("partner_external_reviews" as never) as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        maybeSingle: () => Promise<{ data: ExternalRow | null }>;
      };
    };
  })
    .select("id,partner_id,is_flagged,platform")
    .eq("id", reviewId)
    .maybeSingle();

  if (!existing) throw new Error("리뷰를 찾을 수 없어요");
  if (existing.partner_id && existing.partner_id !== partner.id) {
    throw new Error("이 리뷰에 답글을 달 권한이 없어요");
  }

  const { error } = await (supabase.from("partner_external_reviews" as never) as unknown as {
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>;
    };
  })
    .update({
      response_text: text,
      response_at: new Date().toISOString(),
    })
    .eq("id", reviewId);

  if (error) throw new Error(error.message || "답글 저장에 실패했어요");
  revalidatePath(REVIEWS_PATH);
}

// -----------------------------
// 3) 내부 리뷰 신고 토글
// -----------------------------
export async function toggleFlagInternalAction(reviewId: string): Promise<void> {
  await requirePartner();
  if (!reviewId) throw new Error("리뷰 ID가 없어요");

  const supabase = await createClient();
  const { data: existing } = await (supabase.from("event_reviews" as never) as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        maybeSingle: () => Promise<{ data: InternalRow | null }>;
      };
    };
  })
    .select("id,is_flagged")
    .eq("id", reviewId)
    .maybeSingle();

  if (!existing) throw new Error("리뷰를 찾을 수 없어요");
  const next = !Boolean(existing.is_flagged);

  const { error } = await (supabase.from("event_reviews" as never) as unknown as {
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>;
    };
  })
    .update({ is_flagged: next })
    .eq("id", reviewId);

  if (error) throw new Error(error.message || "신고 처리에 실패했어요");
  revalidatePath(REVIEWS_PATH);
}

// -----------------------------
// 4) 외부 리뷰 신고 토글
// -----------------------------
export async function toggleFlagExternalAction(reviewId: string): Promise<void> {
  const partner = await requirePartner();
  if (!reviewId) throw new Error("리뷰 ID가 없어요");

  const supabase = await createClient();
  const { data: existing } = await (supabase.from("partner_external_reviews" as never) as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        maybeSingle: () => Promise<{ data: ExternalRow | null }>;
      };
    };
  })
    .select("id,partner_id,is_flagged,platform")
    .eq("id", reviewId)
    .maybeSingle();

  if (!existing) throw new Error("리뷰를 찾을 수 없어요");
  if (existing.partner_id && existing.partner_id !== partner.id) {
    throw new Error("이 리뷰를 변경할 권한이 없어요");
  }
  const next = !Boolean(existing.is_flagged);

  const { error } = await (supabase.from("partner_external_reviews" as never) as unknown as {
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>;
    };
  })
    .update({ is_flagged: next })
    .eq("id", reviewId);

  if (error) throw new Error(error.message || "신고 처리에 실패했어요");
  revalidatePath(REVIEWS_PATH);
}

// -----------------------------
// 5) 외부 리뷰 수동 추가
// -----------------------------
const ALLOWED_PLATFORMS = new Set([
  "NAVER",
  "GOOGLE",
  "INSTAGRAM",
  "BLOG",
  "KAKAO",
  "MANUAL",
]);

export async function createExternalReviewAction(formData: FormData): Promise<void> {
  const partner = await requirePartner();

  const platformRaw = String(formData.get("platform") ?? "MANUAL").toUpperCase();
  const platform = ALLOWED_PLATFORMS.has(platformRaw) ? platformRaw : "MANUAL";
  const author_name = String(formData.get("author_name") ?? "").trim() || null;
  const ratingRaw = Number(formData.get("rating") ?? 0);
  const rating =
    Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5
      ? Math.round(ratingRaw)
      : null;
  const content = String(formData.get("content") ?? "").trim() || null;
  const publishedAtRaw = String(formData.get("published_at") ?? "").trim();
  const published_at = publishedAtRaw ? new Date(publishedAtRaw).toISOString() : new Date().toISOString();
  const source_url = String(formData.get("source_url") ?? "").trim() || null;
  const programIdRaw = String(formData.get("program_id") ?? "").trim();
  const program_id = programIdRaw || null;

  if (!content && !author_name) {
    throw new Error("작성자 또는 내용 중 하나는 입력해주세요");
  }

  const supabase = await createClient();
  const payload: Record<string, unknown> = {
    partner_id: partner.id,
    program_id,
    platform,
    author_name,
    rating,
    content,
    published_at,
    source_url,
    external_id: null,
    is_flagged: false,
  };

  const { error } = await (supabase.from("partner_external_reviews" as never) as unknown as {
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).insert(payload);

  if (error) throw new Error(error.message || "리뷰 추가에 실패했어요");
  revalidatePath(REVIEWS_PATH);
}

// -----------------------------
// 6) 외부 리뷰 삭제 (수동 추가한 MANUAL 만)
// -----------------------------
export async function deleteExternalReviewAction(id: string): Promise<void> {
  const partner = await requirePartner();
  if (!id) throw new Error("리뷰 ID가 없어요");

  const supabase = await createClient();
  const { data: existing } = await (supabase.from("partner_external_reviews" as never) as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        maybeSingle: () => Promise<{ data: ExternalRow | null }>;
      };
    };
  })
    .select("id,partner_id,is_flagged,platform")
    .eq("id", id)
    .maybeSingle();

  if (!existing) throw new Error("리뷰를 찾을 수 없어요");
  if (existing.partner_id && existing.partner_id !== partner.id) {
    throw new Error("이 리뷰를 삭제할 권한이 없어요");
  }
  if ((existing.platform ?? "").toUpperCase() !== "MANUAL") {
    throw new Error("수동으로 추가한 리뷰만 삭제할 수 있어요");
  }

  const { error } = await (supabase.from("partner_external_reviews" as never) as unknown as {
    delete: () => {
      eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>;
    };
  })
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message || "리뷰 삭제에 실패했어요");
  revalidatePath(REVIEWS_PATH);
}
