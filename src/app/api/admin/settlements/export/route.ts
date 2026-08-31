// 관리자 정산 CSV 내보내기.
//
// 화면(/admin/settlements)의 「⬇️ CSV 내보내기」 가 여기로 온다. 버튼은 진작
// 있었는데 이 경로가 없어서 404 로 떨어지고 있었다.
//
// 화면과 **같은 달·같은 컬럼**을 쓴다(?month=YYYY-MM). 화면은 period_start 가
// 그 달 안에 드는 것만 보여 주므로 여기서도 같은 창을 쓴다 — 눈으로 보던 것과
// 받아 본 파일이 다르면 그때부터 아무도 이 버튼을 안 믿는다.
//
// 지사 이름은 정산 행에 없어서 partners 를 한 번 더 읽어 붙인다. 정산 파일은
// 사람이 열어 보는 것이라 UUID 만 있으면 쓸모가 없다.

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";
import { toCSV, csvResponse, formatDateKR, todayISO } from "@/lib/csv-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SettlementRow = {
  partner_id: string | null;
  period_start: string;
  period_end: string;
  gross_sales: number;
  refunds: number;
  commission_rate: number;
  commission_amount: number;
  acorn_deduction: number;
  other_deductions: number;
  net_amount: number;
  status: string;
  paid_at: string | null;
  pay_reference: string | null;
  bank_account: string | null;
  account_holder: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "작성중",
  REVIEW: "검토중",
  APPROVED: "승인",
  PAID: "지급완료",
  DISPUTED: "이의제기",
};

/** 화면과 같은 규칙 — YYYY-MM 을 [그 달 1일, 다음 달 1일) 로 편다. */
function monthWindow(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map((n) => parseInt(n, 10));
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${y}-${pad(m)}-01`;
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  return { start, end };
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const month = req.nextUrl.searchParams.get("month") || currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month 는 YYYY-MM 형식" }, { status: 400 });
  }
  const { start, end } = monthWindow(month);

  const supabase = await createClient();

  let rows: SettlementRow[] = [];
  try {
    const resp = (await (
      supabase.from("settlements" as never) as unknown as {
        select: (c: string) => {
          gte: (
            k: string,
            v: string
          ) => {
            lt: (
              k: string,
              v: string
            ) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => Promise<{ data: SettlementRow[] | null }>;
            };
          };
        };
      }
    )
      .select(
        "partner_id, period_start, period_end, gross_sales, refunds, commission_rate, commission_amount, acorn_deduction, other_deductions, net_amount, status, paid_at, pay_reference, bank_account, account_holder"
      )
      .gte("period_start", start)
      .lt("period_start", end)
      .order("net_amount", { ascending: false })) as {
      data: SettlementRow[] | null;
    };
    rows = resp.data ?? [];
  } catch {
    // 표가 아직 없으면(마이그레이션 전) 빈 파일 — 화면도 같은 태도다.
    rows = [];
  }

  // 지사 이름 붙이기 — 한 번만 읽는다.
  const partnerIds = [...new Set(rows.map((r) => r.partner_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (partnerIds.length > 0) {
    try {
      const resp = (await (
        supabase.from("partners" as never) as unknown as {
          select: (c: string) => {
            in: (
              k: string,
              v: string[]
            ) => Promise<{
              data: { id: string; name: string; business_name: string | null }[] | null;
            }>;
          };
        }
      )
        .select("id, name, business_name")
        .in("id", partnerIds)) as {
        data: { id: string; name: string; business_name: string | null }[] | null;
      };
      for (const p of resp.data ?? []) {
        names.set(p.id, p.business_name?.trim() || p.name);
      }
    } catch {
      // 이름을 못 붙여도 금액은 내보낸다.
    }
  }

  const csv = toCSV(
    rows.map((r) => ({
      partner: (r.partner_id && names.get(r.partner_id)) || "(알 수 없음)",
      period: `${formatDateKR(r.period_start)} ~ ${formatDateKR(r.period_end)}`,
      gross_sales: r.gross_sales,
      refunds: r.refunds,
      commission_rate: `${r.commission_rate}%`,
      commission_amount: r.commission_amount,
      acorn_deduction: r.acorn_deduction,
      other_deductions: r.other_deductions,
      net_amount: r.net_amount,
      status: STATUS_LABEL[r.status] ?? r.status,
      paid_at: formatDateKR(r.paid_at),
      pay_reference: r.pay_reference ?? "",
      bank_account: r.bank_account ?? "",
      account_holder: r.account_holder ?? "",
    })),
    [
      { key: "partner", label: "지사" },
      { key: "period", label: "정산 기간" },
      { key: "gross_sales", label: "총매출" },
      { key: "refunds", label: "환불" },
      { key: "commission_rate", label: "수수료율" },
      { key: "commission_amount", label: "수수료" },
      { key: "acorn_deduction", label: "도토리 차감" },
      { key: "other_deductions", label: "기타 차감" },
      { key: "net_amount", label: "지급액" },
      { key: "status", label: "상태" },
      { key: "paid_at", label: "지급일" },
      { key: "pay_reference", label: "이체 참조" },
      { key: "bank_account", label: "계좌" },
      { key: "account_holder", label: "예금주" },
    ]
  );

  return csvResponse(csv, `정산_${month}_${todayISO()}.csv`);
}
