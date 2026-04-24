"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { acornBonusRate } from "@/lib/invoice-policy";

/**
 * 청구서 관리 Server Actions.
 *
 * Backend agent가 준비하는 `/lib/billing/invoice.ts` 모듈이 있을 때는
 * 해당 함수(`createInvoice`, `confirmInvoicePayment`, `cancelInvoice`)를
 * 우선 사용합니다. 아직 없으면 본 파일 내의 fallback 로직으로 DB에 직접
 * insert/update 해서 UI 개발을 언블락합니다.
 */

// ---- Types --------------------------------------------------------------

type TargetType =
  | "PARTNER"
  | "MANAGER"
  | "PARTICIPANT"
  | "ADVERTISER"
  | "AFFILIATE"
  | "ORG"
  | "B2B_CLIENT";

type Category =
  | "ACORN_RECHARGE"
  | "SUBSCRIPTION"
  | "EVENT_FEE"
  | "AD_CAMPAIGN"
  | "COUPON_FEE"
  | "B2B_CONTRACT"
  | "SETTLEMENT"
  | "REFUND"
  | "OTHER";

type PaymentMethod =
  | "CARD"
  | "KAKAOPAY"
  | "NAVERPAY"
  | "TOSSPAY"
  | "BANK_TRANSFER"
  | "VIRTUAL_ACCOUNT";

// ---- Utilities ----------------------------------------------------------

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, Math.min(90, Math.floor(days))));
  return d.toISOString();
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `INV-${yyyy}${mm}${dd}-${rand}`;
}

// ---- Actions ------------------------------------------------------------

export async function createInvoiceAction(formData: FormData) {
  const admin = await requireAdmin();

  const targetType = String(formData.get("target_type") ?? "") as TargetType;
  const targetId = String(formData.get("target_id") ?? "").trim();
  const targetName = String(formData.get("target_name") ?? "").trim() || null;
  const targetEmail = String(formData.get("target_email") ?? "").trim() || null;
  const targetPhone = String(formData.get("target_phone") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "") as Category;
  const amountRaw = Number(formData.get("amount"));
  const expiresDays = Number(formData.get("expires_days") ?? 7);
  const description = String(formData.get("description") ?? "").trim() || null;
  const memo = String(formData.get("memo") ?? "").trim() || null;
  const methods = formData.getAll("payment_methods").map(String) as PaymentMethod[];

  if (!targetType) throw new Error("대상 유형을 선택해주세요");
  if (!targetId) throw new Error("대상을 선택해주세요");
  if (!category) throw new Error("분류를 선택해주세요");
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
    throw new Error("금액을 올바르게 입력해주세요");
  }
  if (methods.length === 0) {
    throw new Error("결제 수단을 최소 1개 이상 선택해주세요");
  }

  const amount = Math.floor(amountRaw);
  const vat = Math.floor(amount * 0.1);
  const totalAmount = amount + vat;

  let bonusRate: number | null = null;
  let bonusAmount: number | null = null;
  let acornsCredited: number | null = null;

  if (category === "ACORN_RECHARGE") {
    bonusRate = acornBonusRate(amount);
    const baseUnits = Math.floor(amount / 3000);
    const bonusUnits = Math.floor(baseUnits * (bonusRate / 100));
    acornsCredited = baseUnits + bonusUnits;
    bonusAmount = bonusUnits * 3000;
  }

  // Try backend helper first; fall back to direct DB insert.
  let createdId: string | null = null;
  try {
    const billing = (await import("@/lib/billing/invoice").catch(() => null)) as
      | { createInvoice?: (input: Record<string, unknown>) => Promise<{ id: string }> }
      | null;
    if (billing?.createInvoice) {
      const created = await billing.createInvoice({
        issuedByType: "ADMIN",
        issuedById: admin?.id ?? "admin",
        targetType,
        targetId,
        targetName,
        targetEmail,
        targetPhone,
        category,
        amount,
        vat,
        totalAmount,
        bonusRate,
        bonusAmount,
        acornsCredited,
        paymentMethods: methods,
        description,
        memo,
        expiresAt: addDaysIso(expiresDays),
      });
      createdId = created.id;
    }
  } catch (err) {
    console.warn("[invoices] backend billing helper failed, using fallback", err);
  }

  if (!createdId) {
    const supabase = await createClient();
    const insertPayload = {
      invoice_number: generateInvoiceNumber(),
      issued_by_type: "ADMIN" as const,
      issued_by_id: admin?.id ?? "admin",
      target_type: targetType,
      target_id: targetId,
      target_name: targetName,
      target_email: targetEmail,
      target_phone: targetPhone,
      category,
      amount,
      bonus_rate: bonusRate,
      bonus_amount: bonusAmount,
      vat,
      total_amount: totalAmount,
      acorns_credited: acornsCredited,
      payment_methods: methods,
      description,
      memo,
      status: "PENDING" as const,
      issued_at: new Date().toISOString(),
      expires_at: addDaysIso(expiresDays),
      email_sent_at: new Date().toISOString(),
      reminder_count: 0,
      tax_invoice_issued: false,
    };

    const { data, error } = await (
      supabase as unknown as {
        from: (t: string) => {
          insert: (p: Record<string, unknown>) => {
            select: (c: string) => {
              single: () => Promise<{
                data: { id: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      }
    )
      .from("invoices")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    createdId = data?.id ?? null;
  }

  revalidatePath("/admin/invoices");
  revalidatePath("/admin/finance");
  if (category === "ACORN_RECHARGE") revalidatePath("/admin/acorns");

  if (createdId) redirect(`/admin/invoices/${createdId}`);
  redirect("/admin/invoices");
}

export async function confirmPaymentAction(invoiceId: string) {
  const admin = await requireAdmin();
  if (!invoiceId) throw new Error("청구서 ID가 없습니다");

  try {
    const billing = (await import("@/lib/billing/invoice").catch(() => null)) as
      | { confirmInvoicePayment?: (id: string, adminId: string) => Promise<void> }
      | null;
    if (billing?.confirmInvoicePayment) {
      await billing.confirmInvoicePayment(invoiceId, admin?.id ?? "admin");
    } else {
      const supabase = await createClient();
      await (
        supabase as unknown as {
          from: (t: string) => {
            update: (p: Record<string, unknown>) => {
              eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
            };
          };
        }
      )
        .from("invoices")
        .update({
          status: "CONFIRMED",
          paid_at: new Date().toISOString(),
          confirmed_at: new Date().toISOString(),
          confirmed_by: admin?.id ?? "admin",
        })
        .eq("id", invoiceId);
    }
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "입금 확인 실패");
  }

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin/finance");
}

export async function cancelInvoiceAction(invoiceId: string, reason: string) {
  await requireAdmin();
  if (!invoiceId) throw new Error("청구서 ID가 없습니다");

  try {
    const billing = (await import("@/lib/billing/invoice").catch(() => null)) as
      | { cancelInvoice?: (id: string, reason: string) => Promise<void> }
      | null;
    if (billing?.cancelInvoice) {
      await billing.cancelInvoice(invoiceId, reason);
    } else {
      const supabase = await createClient();
      await (
        supabase as unknown as {
          from: (t: string) => {
            update: (p: Record<string, unknown>) => {
              eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
            };
          };
        }
      )
        .from("invoices")
        .update({
          status: "CANCELED",
          canceled_at: new Date().toISOString(),
          memo: reason ? `[취소사유] ${reason}` : null,
        })
        .eq("id", invoiceId);
    }
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "취소 실패");
  }

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoiceId}`);
}

export async function resendInvoiceAction(invoiceId: string) {
  await requireAdmin();
  if (!invoiceId) throw new Error("청구서 ID가 없습니다");

  const supabase = await createClient();

  // Read current reminder_count, then +1 with email_sent_at.
  const { data: current } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { reminder_count: number | null } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("invoices")
    .select("reminder_count")
    .eq("id", invoiceId)
    .maybeSingle();

  const next = (current?.reminder_count ?? 0) + 1;

  await (
    supabase as unknown as {
      from: (t: string) => {
        update: (p: Record<string, unknown>) => {
          eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .from("invoices")
    .update({
      reminder_count: next,
      email_sent_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoiceId}`);
}

export async function issueTaxInvoiceAction(invoiceId: string) {
  await requireAdmin();
  if (!invoiceId) throw new Error("청구서 ID가 없습니다");

  const supabase = await createClient();

  // 간단 플래그만 토글. 실제 홈택스 연동은 backend 담당.
  await (
    supabase as unknown as {
      from: (t: string) => {
        update: (p: Record<string, unknown>) => {
          eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .from("invoices")
    .update({ tax_invoice_issued: true })
    .eq("id", invoiceId);

  revalidatePath(`/admin/invoices/${invoiceId}`);
}
