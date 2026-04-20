import Link from "next/link";
import { redirect } from "next/navigation";
import { getPartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { AcornsForm } from "./acorns-form";

export const dynamic = "force-dynamic";

async function loadBalance(partnerId: string): Promise<number> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{
                data: { acorn_balance: number | null } | null;
              }>;
            };
          };
        };
      }
    )
      .from("partners")
      .select("acorn_balance")
      .eq("id", partnerId)
      .maybeSingle();
    return data?.acorn_balance ?? 0;
  } catch {
    return 0;
  }
}

export default async function PartnerAcornsPage() {
  const partner = await getPartner();
  if (!partner) redirect("/partner");

  const balance = await loadBalance(partner.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/partner/billing"
          className="text-sm font-medium text-[#2D5A3D] hover:underline"
        >
          ← 결제 &amp; 정산
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#6B4423] via-[#8B6F47] to-[#C4956A] p-6 text-white shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#F5E6D3]">
          Acorn Recharge
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <span>🌰</span>
          <span>도토리 충전</span>
        </h1>
        <p className="mt-1 text-sm text-[#FFF8F0]">
          리워드 · 광고 · 캠페인 집행에 쓰이는 도토리 크레딧을 자체 충전해요.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 backdrop-blur-sm">
          <span className="text-xs font-semibold text-[#F5E6D3]">
            현재 잔액
          </span>
          <span className="text-lg font-extrabold">
            {balance.toLocaleString("ko-KR")}🌰
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <AcornsForm />
      </section>

      {/* 정책 */}
      <section className="rounded-2xl border border-[#E5D3B8] bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#6B4423]">
          <span>📜</span>
          <span>도토리 정책</span>
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-[#8B6F47]">
          <li>
            기본 단가는 🌰 1개당 <b>1,000원</b>입니다 (공급가 기준).
          </li>
          <li>
            충전액이 클수록 보너스 비율이 올라가요:
            30만+ <b>+10%</b>, 100만+ <b>+15%</b>, 300만+ <b>+20%</b>
          </li>
          <li>
            도토리는 리워드·광고·캠페인 집행에 사용되며,{" "}
            <b>환불 불가 · 유효기간 2년</b>입니다.
          </li>
          <li>
            부가세(10%)는 청구서에 별도 표기되며, 결제 후 세금계산서를 받으실 수
            있어요.
          </li>
        </ul>
      </section>
    </div>
  );
}
