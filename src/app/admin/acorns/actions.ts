"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

/**
 * 파트너(숲지기) 도토리 크레딧 충전.
 *
 * 현재는 MOCK 결제(`mockPaymentRequest`)로부터 트랜잭션 ID만 받아
 * `partners.acorn_balance`를 단순히 증가시키는 스텁입니다.
 *
 * Future: 실제 PG 연동 시
 *   1) 서버에서 결제 검증(토스 `approve`, 포트원 `getPaymentByImpUid`)
 *   2) `acorn_recharges` 테이블에 거래 내역 영구 기록
 *   3) 보너스 로직(티어별 %) 중앙 정책화
 */
export async function rechargePartnerAction(
  partnerId: string,
  amountUnits: number,
  txnId: string,
): Promise<{ ok: true; newBalance?: number }> {
  await requireAdmin();

  if (!partnerId) throw new Error("숲지기를 선택해주세요");
  if (!Number.isFinite(amountUnits) || amountUnits <= 0) {
    throw new Error("충전 도토리 수량이 올바르지 않습니다");
  }
  if (!txnId) throw new Error("결제 트랜잭션 ID가 없습니다");

  const supabase = await createClient();

  // 1) 현재 잔액 조회
  const { data: current, error: readErr } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { id: string; acorn_balance: number } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("partners")
    .select("id, acorn_balance")
    .eq("id", partnerId)
    .maybeSingle();

  if (readErr) throw new Error(readErr.message);
  if (!current) throw new Error("숲지기를 찾을 수 없습니다");

  const newBalance = (current.acorn_balance ?? 0) + amountUnits;

  // 2) 잔액 업데이트
  const { error: updErr } = await (
    supabase as unknown as {
      from: (t: string) => {
        update: (p: Record<string, unknown>) => {
          eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .from("partners")
    .update({ acorn_balance: newBalance })
    .eq("id", partnerId);

  if (updErr) throw new Error(updErr.message);

  // 3) 거래 로그 (스텁 — 추후 acorn_recharges 테이블에 insert)
  // TODO: create `acorn_recharges` table and persist { partner_id, amount_units, txn_id, paid_at, method }
  // For now, we just console.log on the server for auditability during dev.
  console.info("[acorn-recharge]", {
    partnerId,
    amountUnits,
    txnId,
    newBalance,
    at: new Date().toISOString(),
  });

  revalidatePath("/admin/acorns");
  revalidatePath("/admin/partners");
  return { ok: true, newBalance };
}
