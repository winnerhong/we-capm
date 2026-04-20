"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

/**
 * 정산(Settlements) Server Actions.
 *
 * Backend agent가 구현할 실제 집계/지급 로직이 있을 때까지는
 * DB 직접 insert/update로 UI 동작만 보장한다.
 */

/** "2026-04" → { start: "2026-04-01", end: "2026-05-01" } */
function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map((n) => parseInt(n, 10));
  if (!y || !m) throw new Error("월 형식이 올바르지 않습니다 (YYYY-MM)");
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return { start, end };
}

export async function generateMonthlySettlementsAction(month: string) {
  const admin = await requireAdmin();
  if (!month) throw new Error("월을 선택해주세요");

  const { start, end } = monthBounds(month);
  const supabase = await createClient();

  // 1) 모든 활성 파트너 로드
  const { data: partners } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<{
            data:
              | {
                  id: string;
                  commission_rate: number | null;
                  total_sales: number | null;
                }[]
              | null;
            error: unknown;
          }>;
        };
      };
    }
  )
    .from("partners")
    .select("id, commission_rate, total_sales")
    .eq("status", "ACTIVE");

  const activePartners = partners ?? [];
  if (activePartners.length === 0) {
    throw new Error("활성 숲지기가 없어 정산을 생성할 수 없어요");
  }

  // 2) 각 파트너별 DRAFT 정산서 생성 (이미 있으면 스킵)
  let created = 0;
  for (const p of activePartners) {
    const { data: existing } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => {
                maybeSingle: () => Promise<{
                  data: { id: string } | null;
                  error: unknown;
                }>;
              };
            };
          };
        };
      }
    )
      .from("settlements")
      .select("id")
      .eq("partner_id", p.id)
      .eq("period_start", start)
      .maybeSingle();

    if (existing) continue;

    const gross = p.total_sales ?? 0;
    const commissionRate = p.commission_rate ?? 10;
    const commission = Math.floor(gross * (commissionRate / 100));
    const net = gross - commission;

    const { error: insErr } = await (
      supabase as unknown as {
        from: (t: string) => {
          insert: (p: Record<string, unknown>) => Promise<{
            error: { message: string } | null;
          }>;
        };
      }
    )
      .from("settlements")
      .insert({
        partner_id: p.id,
        period_start: start,
        period_end: end,
        gross_sales: gross,
        refunds: 0,
        commission_rate: commissionRate,
        commission_amount: commission,
        acorn_deduction: 0,
        other_deductions: 0,
        net_amount: net,
        status: "DRAFT",
        reviewed_by: admin?.id ?? "admin",
      });

    if (!insErr) created++;
  }

  revalidatePath("/admin/settlements");
  revalidatePath("/admin/finance");

  return { ok: true, created };
}

export async function approveSettlementAction(settlementId: string) {
  const admin = await requireAdmin();
  if (!settlementId) throw new Error("정산서 ID가 없습니다");

  const supabase = await createClient();
  await (
    supabase as unknown as {
      from: (t: string) => {
        update: (p: Record<string, unknown>) => {
          eq: (k: string, v: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .from("settlements")
    .update({
      status: "APPROVED",
      approved_by: admin?.id ?? "admin",
    })
    .eq("id", settlementId);

  revalidatePath("/admin/settlements");
}

export async function markSettlementPaidAction(
  settlementId: string,
  reference: string,
) {
  await requireAdmin();
  if (!settlementId) throw new Error("정산서 ID가 없습니다");
  if (!reference.trim()) throw new Error("이체 참조번호를 입력해주세요");

  const supabase = await createClient();
  await (
    supabase as unknown as {
      from: (t: string) => {
        update: (p: Record<string, unknown>) => {
          eq: (k: string, v: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .from("settlements")
    .update({
      status: "PAID",
      paid_at: new Date().toISOString(),
      pay_reference: reference,
    })
    .eq("id", settlementId);

  revalidatePath("/admin/settlements");
  revalidatePath("/admin/finance");
}

export async function bulkApproveSettlementsAction(ids: string[]) {
  const admin = await requireAdmin();
  if (ids.length === 0) throw new Error("선택된 정산서가 없어요");

  const supabase = await createClient();
  let updated = 0;
  for (const id of ids) {
    const { error } = await (
      supabase as unknown as {
        from: (t: string) => {
          update: (p: Record<string, unknown>) => {
            eq: (k: string, v: string) => Promise<{
              error: { message: string } | null;
            }>;
          };
        };
      }
    )
      .from("settlements")
      .update({
        status: "APPROVED",
        approved_by: admin?.id ?? "admin",
      })
      .eq("id", id);
    if (!error) updated++;
  }

  revalidatePath("/admin/settlements");
  return { ok: true, updated };
}
