import { NextResponse } from "next/server";
import { getPartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  confirmInvoicePayment,
  type PaymentMethod,
} from "@/lib/billing/invoice";

/**
 * POST /api/partner/invoices/[id]/confirm
 * 파트너가 자기 청구서를 결제 확정.
 * - 본인 target 인지 검증
 * - confirmInvoicePayment() 실행 (→ 도토리 충전 + 트랜잭션 기록)
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const partner = await getPartner();
  if (!partner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const method = (body.method as PaymentMethod) ?? "CARD";
  const transactionId = body.transactionId as string | undefined;

  const supabase = await createClient();

  // 권한 검증
  const { data: inv } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: {
                target_type: string;
                target_id: string;
                status: string;
              } | null;
            }>;
          };
        };
      };
    }
  )
    .from("invoices")
    .select("target_type, target_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!inv) {
    return NextResponse.json({ error: "청구서를 찾을 수 없어요" }, { status: 404 });
  }
  if (inv.target_type !== "PARTNER" || inv.target_id !== partner.id) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  }
  if (inv.status !== "PENDING") {
    return NextResponse.json(
      { error: "결제 가능한 상태가 아니에요" },
      { status: 400 },
    );
  }

  try {
    await confirmInvoicePayment(supabase, id, {
      confirmed_by: `PARTNER:${partner.id}`,
      method,
      pg_transaction_id: transactionId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "결제 확정 실패" },
      { status: 500 },
    );
  }
}
