import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { confirmInvoicePayment } from "@/lib/billing/invoice";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/invoice/:id/confirm
 *
 * Admin-only: manually confirm an invoice (typically BANK_TRANSFER after
 * bank statement reconciliation). Runs confirmInvoicePayment which also
 * credits acorns on ACORN_RECHARGE invoices.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin: { id?: string; username?: string; name?: string };
  try {
    admin = (await requireAdmin()) as {
      id?: string;
      username?: string;
      name?: string;
    };
  } catch {
    return NextResponse.json(
      { error: "관리자 권한이 필요합니다" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const confirmedBy = admin.username ?? admin.id ?? "admin";

  const supabase = await createClient();
  try {
    await confirmInvoicePayment(supabase, id, {
      confirmed_by: confirmedBy,
      method: "BANK_TRANSFER",
    });
  } catch (e) {
    return NextResponse.json(
      { error: "청구서 확정에 실패했습니다" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
