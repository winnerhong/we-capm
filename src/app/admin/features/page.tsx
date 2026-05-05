import Link from "next/link";
import { listAllFeaturesWithStats } from "@/lib/features/queries";
import { FEATURE_CATEGORY_META } from "@/lib/features/types";
import { TierToggle } from "./tier-toggle";
import { StatusToggle } from "./status-toggle";

export const dynamic = "force-dynamic";

function formatKRW(n: number): string {
  if (n === 0) return "₩0";
  return `₩${n.toLocaleString("ko-KR")}`;
}

export default async function AdminFeaturesPage() {
  const features = await listAllFeaturesWithStats();

  const grouped = {
    BASIC: features.filter((f) => f.pack_tier === "BASIC"),
    OPTIONAL: features.filter((f) => f.pack_tier === "OPTIONAL"),
    HIDDEN: features.filter((f) => f.pack_tier === "HIDDEN"),
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/admin" className="hover:text-[#2D5A3D]">
          관리자
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">기능 카탈로그</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              🧩
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                기능 카탈로그
              </h1>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                본사가 만든 기능을 등재하고 기본/유료로 분류합니다. 가격은 추후
                결제 도입 시 사용됩니다.
              </p>
            </div>
          </div>
          <Link
            href="/admin/features/new"
            className="shrink-0 rounded-xl bg-[#2D5A3D] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#3A7A52]"
          >
            + 새 기능
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-800">
            🎁 기본팩 {grouped.BASIC.length}
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800">
            🛒 유료팩 {grouped.OPTIONAL.length}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-semibold text-slate-700">
            🔒 비공개 {grouped.HIDDEN.length}
          </span>
        </div>
      </header>

      {/* List */}
      {features.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#D4E4BC] bg-white px-4 py-16 text-center">
          <div className="text-4xl">🧩</div>
          <p className="mt-3 text-base font-semibold text-[#2D5A3D]">
            등재된 기능이 아직 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            새 기능을 만들어 지사에 제공할 수 있습니다.
          </p>
          <Link
            href="/admin/features/new"
            className="mt-4 inline-flex items-center rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3A7A52]"
          >
            + 새 기능 만들기
          </Link>
        </section>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-[#D4E4BC] bg-white shadow-sm">
          {/* Desktop table */}
          <div className="hidden lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-[#F0EBE3] bg-[#FFF8F0] text-left text-[11px] uppercase tracking-wider text-[#8B7F75]">
                <tr>
                  <th className="px-4 py-3">기능</th>
                  <th className="px-4 py-3">분류</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3 text-right">세팅비</th>
                  <th className="px-4 py-3 text-right">월구독</th>
                  <th className="px-4 py-3 text-right">보유 지사</th>
                  <th className="px-4 py-3 text-right">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EBE3]">
                {features.map((f) => {
                  return (
                    <tr key={f.code} className="hover:bg-[#FFF8F0]">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className="text-2xl shrink-0" aria-hidden>
                            {f.icon ?? "🧩"}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-[#2D5A3D]">
                              {f.name}
                            </div>
                            <div className="font-mono text-[11px] text-[#8B7F75]">
                              {f.code}
                            </div>
                            <div className="text-[11px] text-[#6B6560]">
                              {FEATURE_CATEGORY_META[f.category]}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <TierToggle code={f.code} current={f.pack_tier} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusToggle code={f.code} current={f.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {f.pack_tier === "OPTIONAL"
                          ? formatKRW(f.setup_fee_krw)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {f.pack_tier === "OPTIONAL"
                          ? formatKRW(f.monthly_fee_krw)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/features/${f.code}/grants`}
                          className="font-semibold text-[#2D5A3D] hover:underline"
                        >
                          {f.active_grant_count.toLocaleString("ko-KR")}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/features/${f.code}/edit`}
                          className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
                        >
                          편집
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="divide-y divide-[#F0EBE3] lg:hidden">
            {features.map((f) => {
              return (
                <li key={f.code} className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl shrink-0" aria-hidden>
                      {f.icon ?? "🧩"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-[#2D5A3D]">
                            {f.name}
                          </div>
                          <div className="font-mono text-[11px] text-[#8B7F75]">
                            {f.code}
                          </div>
                        </div>
                        <Link
                          href={`/admin/features/${f.code}/edit`}
                          className="shrink-0 rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2D5A3D]"
                        >
                          편집
                        </Link>
                      </div>
                      {f.short_desc && (
                        <p className="mt-1 text-xs text-[#6B6560]">
                          {f.short_desc}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <TierToggle code={f.code} current={f.pack_tier} />
                        <StatusToggle code={f.code} current={f.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#6B6560]">
                        {f.pack_tier === "OPTIONAL" && (
                          <>
                            <span>세팅 {formatKRW(f.setup_fee_krw)}</span>
                            <span>월 {formatKRW(f.monthly_fee_krw)}</span>
                          </>
                        )}
                        <Link
                          href={`/admin/features/${f.code}/grants`}
                          className="font-semibold text-[#2D5A3D]"
                        >
                          보유 {f.active_grant_count.toLocaleString("ko-KR")}곳
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
