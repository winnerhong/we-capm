// 관리자 청구서 CSV 내보내기.
//
// 화면(/admin/invoices)의 「⬇️ CSV 내보내기」 가 여기로 온다. 버튼은 진작
// 있었는데 이 경로가 없어서 404 로 떨어지고 있었다.
//
// 화면과 **같은 컬럼·같은 필터**를 쓴다. 눈으로 보던 목록과 받아 본 파일이
// 다르면 그때부터 아무도 이 버튼을 안 믿는다.
//   ?status=PENDING 처럼 화면의 상태 필터를 그대로 넘겨받는다.

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";
import { toCSV, csvResponse, formatDateKR, todayISO } from "@/lib/csv-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InvoiceRow = {
  invoice_number: string;
  target_type: string;
  target_name: string | null;
  category: string;
  amount: number;
  total_amount: number;
  status: string;
  issued_at: string;
  expires_at: string;
  paid_at: string | null;
  reminder_count: number;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "초안",
  PENDING: "대기",
  PAID: "입금됨",
  CONFIRMED: "확인완료",
  EXPIRED: "만료",
  CANCELED: "취소",
  REFUNDED: "환불",
};

const TARGET_LABEL: Record<string, string> = {
  PARTNER: "지사",
  ORG: "기관",
  ADVERTISER: "광고주",
  USER: "개인",
};

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const supabase = await createClient();

  let rows: InvoiceRow[] = [];
  try {
    const resp = (await (
      supabase.from("invoices" as never) as unknown as {
        select: (c: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: InvoiceRow[] | null; error: unknown }>;
        };
      }
    )
      .select(
        "invoice_number, target_type, target_name, category, amount, total_amount, status, issued_at, expires_at, paid_at, reminder_count"
      )
      .order("issued_at", { ascending: false })) as {
      data: InvoiceRow[] | null;
      error: unknown;
    };
    rows = resp.data ?? [];
  } catch {
    // 표가 아직 없으면(마이그레이션 전) 빈 파일을 준다 — 화면도 같은 태도다.
    rows = [];
  }

  if (status && status !== "ALL") {
    rows = rows.filter((r) => r.status === status);
  }

  const csv = toCSV(
    rows.map((r) => ({
      invoice_number: r.invoice_number,
      target: TARGET_LABEL[r.target_type] ?? r.target_type,
      target_name: r.target_name ?? "",
      category: r.category,
      amount: r.amount,
      total_amount: r.total_amount,
      status: STATUS_LABEL[r.status] ?? r.status,
      issued_at: formatDateKR(r.issued_at),
      expires_at: formatDateKR(r.expires_at),
      paid_at: formatDateKR(r.paid_at),
      reminder_count: r.reminder_count,
    })),
    [
      { key: "invoice_number", label: "청구서 번호" },
      { key: "target", label: "대상 구분" },
      { key: "target_name", label: "대상 이름" },
      { key: "category", label: "항목" },
      { key: "amount", label: "공급가액" },
      { key: "total_amount", label: "합계금액" },
      { key: "status", label: "상태" },
      { key: "issued_at", label: "발행일" },
      { key: "expires_at", label: "납기일" },
      { key: "paid_at", label: "입금일" },
      { key: "reminder_count", label: "독촉 횟수" },
    ]
  );

  const suffix = status && status !== "ALL" ? `_${STATUS_LABEL[status] ?? status}` : "";
  return csvResponse(csv, `청구서${suffix}_${todayISO()}.csv`);
}
