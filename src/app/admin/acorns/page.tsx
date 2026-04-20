import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RechargeButton } from "./recharge-button";
import type { PartnerLite } from "./recharge-modal";

export const dynamic = "force-dynamic";

const tiers = [
  { amount: "10만원", bonus: "0%", unit: "3,000원", popular: false },
  { amount: "30만원", bonus: "10%", unit: "2,727원", popular: false },
  { amount: "100만원", bonus: "15%", unit: "2,608원", popular: true },
  { amount: "300만원", bonus: "20%", unit: "2,500원", popular: false },
];

type PartnerRow = {
  id: string;
  name: string;
  business_name: string | null;
  acorn_balance: number | null;
};

type AcornInvoice = {
  id: string;
  invoice_number: string;
  target_name: string | null;
  amount: number;
  total_amount: number;
  acorns_credited: number | null;
  status:
    | "DRAFT"
    | "PENDING"
    | "PAID"
    | "CONFIRMED"
    | "EXPIRED"
    | "CANCELED"
    | "REFUNDED";
  issued_at: string;
  paid_at: string | null;
};

const ACORN_INVOICE_STATUS: Record<
  AcornInvoice["status"],
  { label: string; cls: string }
> = {
  DRAFT: { label: "초안", cls: "bg-gray-100 text-gray-700" },
  PENDING: { label: "대기", cls: "bg-amber-100 text-amber-800" },
  PAID: { label: "입금됨", cls: "bg-blue-100 text-blue-800" },
  CONFIRMED: { label: "완료", cls: "bg-green-100 text-green-800" },
  EXPIRED: { label: "만료", cls: "bg-gray-100 text-gray-600" },
  CANCELED: { label: "취소", cls: "bg-red-50 text-red-700" },
  REFUNDED: { label: "환불", cls: "bg-purple-100 text-purple-800" },
};

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
}

export default async function AdminAcornsPage() {
  const supabase = await createClient();

  // 숲지기 목록 조회 (충전 대상)
  let partners: PartnerLite[] = [];
  let totalBalance = 0;
  let tableMissing = false;

  try {
    const { data, error } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{
              data: PartnerRow[] | null;
              error: { message: string; code?: string } | null;
            }>;
          };
        };
      }
    )
      .from("partners")
      .select("id, name, business_name, acorn_balance")
      .order("created_at", { ascending: false });

    if (error) {
      if (
        error.code === "42P01" ||
        /relation .* does not exist/i.test(error.message)
      ) {
        tableMissing = true;
      }
    } else {
      partners = (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        business_name: p.business_name,
        acorn_balance: p.acorn_balance ?? 0,
      }));
      totalBalance = partners.reduce((acc, p) => acc + p.acorn_balance, 0);
    }
  } catch {
    tableMissing = true;
  }

  // 최근 도토리 청구서 (ACORN_RECHARGE 카테고리)
  let acornInvoices: AcornInvoice[] = [];
  try {
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{
                  data: AcornInvoice[] | null;
                  error: unknown;
                }>;
              };
            };
          };
        };
      }
    )
      .from("invoices")
      .select(
        "id, invoice_number, target_name, amount, total_amount, acorns_credited, status, issued_at, paid_at",
      )
      .eq("category", "ACORN_RECHARGE")
      .order("issued_at", { ascending: false })
      .limit(10);
    acornInvoices = data ?? [];
  } catch {
    acornInvoices = [];
  }

  return (
    <div className="space-y-6">
      {/* 상단 네비 */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin"
          className="text-sm text-[#2D5A3D] hover:underline font-medium"
        >
          ← 대시보드
        </Link>
        <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold">
          테스트 모드
        </span>
      </div>

      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#2D5A3D] flex items-center gap-2">
          <span>🎁</span>
          <span>도토리 충전 관리</span>
        </h1>
        <p className="mt-1 text-sm text-[#6B6560]">
          숲지기(업체)의 도토리 크레딧 충전을 관리해요
        </p>
      </div>

      {/* 청구서 발송 CTA */}
      <Link
        href="/admin/invoices/new?category=ACORN_RECHARGE&target_type=PARTNER"
        className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">📤</span>
          <div>
            <div className="text-lg font-extrabold">
              지사에게 도토리 충전 청구서 발송
            </div>
            <div className="text-xs text-white/80">
              결제 링크와 세금계산서가 포함된 청구서를 바로 보내요
            </div>
          </div>
        </div>
        <span className="text-2xl">→</span>
      </Link>

      {/* 충전 패널 */}
      {!tableMissing && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#2D5A3D] mb-3 flex items-center gap-1.5">
            <span>⚡</span>
            <span>빠른 충전</span>
          </h2>
          <RechargeButton partners={partners} />
          <p className="mt-3 text-[11px] text-[#8B6F47]">
            결제 완료 시 선택한 숲지기의 도토리 잔액이 즉시 증가합니다 (테스트
            모드 — 실제 결제는 이루어지지 않아요).
          </p>
        </section>
      )}

      {tableMissing && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <div className="font-semibold">
            ⚠️ partners 테이블이 아직 준비되지 않았어요.
          </div>
          <p className="mt-1 text-xs">
            DB 마이그레이션을 먼저 실행해 주세요.
          </p>
        </div>
      )}

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <div className="text-xs font-medium text-[#8B6F47]">등록 숲지기</div>
          <div className="text-2xl font-bold text-[#6B4423] mt-1">
            {partners.length}
            <span className="text-sm font-medium ml-1">곳</span>
          </div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <div className="text-xs font-medium text-[#8B6F47]">총 보유 도토리</div>
          <div className="text-2xl font-bold text-[#6B4423] mt-1">
            {totalBalance.toLocaleString("ko-KR")}
            <span className="text-sm font-medium ml-1">🌰</span>
          </div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
          <div className="text-xs font-medium text-[#8B6F47]">이번달 충전</div>
          <div className="text-2xl font-bold text-[#6B4423] mt-1">
            0<span className="text-sm font-medium ml-1">건</span>
          </div>
        </div>
      </div>

      {/* 충전 티어 테이블 */}
      <section>
        <h2 className="text-sm font-bold text-[#2D5A3D] mb-3">🌰 충전 티어</h2>
        <div className="rounded-2xl border border-[#D4E4BC] bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#E8F0E4] text-[#2D5A3D]">
              <tr>
                <th className="px-4 py-3 text-left font-bold">충전액</th>
                <th className="px-4 py-3 text-center font-bold">보너스</th>
                <th className="px-4 py-3 text-right font-bold">실질 단가</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.amount} className="border-t border-[#D4E4BC]">
                  <td className="px-4 py-3 font-semibold text-[#6B4423]">
                    {t.amount}
                    {t.popular && (
                      <span className="ml-2 rounded-full bg-[#2D5A3D] text-white px-2 py-0.5 text-[10px] font-bold">
                        인기
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-[#2D5A3D] font-bold">
                    +{t.bonus}
                  </td>
                  <td className="px-4 py-3 text-right text-[#6B6560]">
                    {t.unit} / 🌰
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 최근 도토리 청구서 */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-sm font-bold text-[#2D5A3D]">📋 최근 도토리 청구서</h2>
          <Link
            href="/admin/invoices?category=ACORN_RECHARGE"
            className="text-xs font-semibold text-[#2D5A3D] hover:underline"
          >
            전체 보기 →
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white">
          {acornInvoices.length === 0 ? (
            <div className="py-12 text-center">
              <span className="text-4xl">🌰</span>
              <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
                아직 청구서가 없어요
              </p>
              <p className="mt-1 text-xs text-[#6B6560]">
                위의 파란 버튼으로 첫 청구서를 발송해보세요
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#F5E6D3]/40 text-left text-xs text-[#8B6F47]">
                <tr>
                  <th className="px-4 py-3 font-semibold">발송일</th>
                  <th className="px-4 py-3 font-semibold">청구번호</th>
                  <th className="px-4 py-3 font-semibold">대상</th>
                  <th className="px-4 py-3 text-right font-semibold">금액</th>
                  <th className="px-4 py-3 text-right font-semibold">도토리</th>
                  <th className="px-4 py-3 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F0E4]">
                {acornInvoices.map((r) => {
                  const s = ACORN_INVOICE_STATUS[r.status];
                  return (
                    <tr key={r.id} className="hover:bg-[#FFF8F0]/40">
                      <td className="px-4 py-2.5 text-xs text-[#6B6560]">
                        {fmtDateShort(r.issued_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/admin/invoices/${r.id}`}
                          className="font-mono text-xs text-[#2D5A3D] hover:underline"
                        >
                          {r.invoice_number}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-[#2C2C2C]">
                        {r.target_name ?? "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#2D5A3D]">
                        {r.total_amount.toLocaleString("ko-KR")}원
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#6B4423]">
                        🌰 {(r.acorns_credited ?? 0).toLocaleString("ko-KR")}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}
                        >
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 정책 설명 */}
      <section className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-5">
        <h3 className="text-sm font-bold text-[#6B4423] flex items-center gap-1.5">
          <span>📜</span>
          <span>도토리 정책</span>
        </h3>
        <ul className="mt-2 space-y-1 text-xs text-[#8B6F47] leading-relaxed list-disc pl-5">
          <li>
            기본 단가는 🌰 1개당 <b>3,000원</b>입니다.
          </li>
          <li>충전액이 클수록 보너스 비율이 올라가 실질 단가가 낮아져요.</li>
          <li>
            도토리는 리워드·광고·캠페인 집행에 사용되며,{" "}
            <b>환불 불가 · 유효기간 2년</b>입니다.
          </li>
          <li>미사용 잔액은 언제든 대시보드에서 확인할 수 있어요.</li>
        </ul>
      </section>
    </div>
  );
}
