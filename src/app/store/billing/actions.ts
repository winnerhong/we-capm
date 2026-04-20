"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * 정산 조기 지급 요청 (stub).
 * 실제로는 settlements 테이블에 요청 레코드를 남기고 관리자 승인을 받는 구조.
 */
export async function requestSettlementPayoutAction(formData: FormData) {
  const amount = Number(formData.get("amount") ?? 0);
  const memo = String(formData.get("memo") ?? "").trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("정산 요청 금액이 올바르지 않아요");
  }

  // TODO: 실제 구현 시 settlements 테이블에 PENDING 상태로 insert.
  // 현재는 stub이므로 audit 메모만 남김.
  const supabase = await createClient();
  const now = new Date().toISOString();

  const audit = supabase as unknown as {
    from: (t: string) => {
      insert: (d: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };

  await audit.from("audit_logs").insert({
    action: "SETTLEMENT_PAYOUT_REQUEST",
    target_type: "AFFILIATE",
    payload: { amount, memo, requested_at: now },
    created_at: now,
  } as never);

  revalidatePath("/store/billing");
  revalidatePath("/store/billing/settlements");
}

/**
 * 정산 입금 계좌 업데이트.
 * 실 서비스에서는 예금주 실명 확인 API를 호출해야 함. 여기서는 stub.
 */
export async function updateBankAccountAction(formData: FormData) {
  const bank = String(formData.get("bank") ?? "").trim();
  const account_number = String(formData.get("account_number") ?? "").trim();
  const holder = String(formData.get("holder") ?? "").trim();

  if (!bank) throw new Error("은행을 선택해 주세요");
  if (!account_number) throw new Error("계좌번호를 입력해 주세요");
  if (!holder) throw new Error("예금주를 입력해 주세요");
  if (!/^[0-9-]{8,20}$/.test(account_number)) {
    throw new Error("계좌번호 형식이 올바르지 않아요");
  }

  // 실명 확인 API stub: 예금주 이름이 공백/특수문자 아니면 통과
  if (!/^[가-힣A-Za-z ().]+$/.test(holder)) {
    throw new Error("예금주 실명 확인에 실패했어요");
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const audit = supabase as unknown as {
    from: (t: string) => {
      insert: (d: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };

  await audit.from("audit_logs").insert({
    action: "AFFILIATE_BANK_ACCOUNT_UPDATE",
    target_type: "AFFILIATE",
    payload: { bank, account_number, holder, verified_at: now },
    created_at: now,
  } as never);

  revalidatePath("/store/billing/bank-account");
  revalidatePath("/store/billing");
}
