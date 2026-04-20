"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getParticipant } from "@/lib/participant-session";
import { createClient } from "@/lib/supabase/server";

export type RefundReasonCategory =
  | "SCHEDULE_CONFLICT"
  | "HEALTH"
  | "SERVICE_ISSUE"
  | "DUPLICATE"
  | "OTHER";

/**
 * 참가자가 본인 인보이스에 대해 환불 요청을 생성합니다.
 * - 본인 인보이스인지(target_type=PARTICIPANT + target_phone 일치) 검증
 * - 상태 PENDING으로 refunds 레코드 삽입
 * - 관리자 알림은 백엔드의 Invoice 시스템에서 처리 (백엔드 에이전트 담당)
 */
export async function requestRefundAction(
  eventId: string,
  invoiceId: string,
  formData: FormData
): Promise<void> {
  const session = await getParticipant(eventId);
  if (!session) throw new Error("unauthorized");

  const reasonCategory = String(
    formData.get("reason_category") ?? "OTHER"
  ) as RefundReasonCategory;
  const reasonText = String(formData.get("reason") ?? "").trim();
  const expectedAmountRaw = String(formData.get("expected_amount") ?? "0");
  const expectedAmount = Math.max(0, Number(expectedAmountRaw) || 0);

  if (reasonText.length < 5) {
    throw new Error("환불 사유를 5자 이상 입력해주세요.");
  }

  const supabase = await createClient();

  // 본인 인보이스인지 검증
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, target_type, target_phone, status, total_amount")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invErr || !invoice) throw new Error("인보이스를 찾을 수 없어요.");
  if (invoice.target_type !== "PARTICIPANT" || invoice.target_phone !== session.phone) {
    throw new Error("본인 결제만 환불 요청할 수 있어요.");
  }
  if (!["PAID", "CONFIRMED"].includes(invoice.status)) {
    throw new Error("결제 완료된 건만 환불 요청할 수 있어요.");
  }

  // 결제 트랜잭션 매칭 (있으면 연결)
  const { data: txn } = await supabase
    .from("payment_transactions")
    .select("id")
    .eq("invoice_id", invoiceId)
    .eq("status", "SUCCESS")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const requestedAmount = Math.min(
    expectedAmount || invoice.total_amount,
    invoice.total_amount
  );

  const { error: insertErr } = await supabase.from("refunds").insert({
    invoice_id: invoiceId,
    payment_transaction_id: txn?.id ?? null,
    requested_by_type: "PARTICIPANT",
    requested_by_id: session.participantId ?? session.phone,
    reason: reasonText,
    reason_category: reasonCategory,
    requested_amount: requestedAmount,
    status: "PENDING",
  });

  if (insertErr) throw new Error(`환불 요청 실패: ${insertErr.message}`);

  revalidatePath(`/event/${eventId}/my/payments`);
  revalidatePath(`/event/${eventId}/my/payments/${invoiceId}`);
  redirect(`/event/${eventId}/my/payments/${invoiceId}?refund=requested`);
}
