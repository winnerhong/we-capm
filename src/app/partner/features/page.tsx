import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { listAllFeatures } from "@/lib/features/queries";
import { getFeatureMap } from "@/lib/features/guard";
import {
  FEATURE_CATEGORY_META,
  PACK_TIER_META,
} from "@/lib/features/types";

export const dynamic = "force-dynamic";

function formatKRW(n: number): string {
  if (n === 0) return "₩0";
  return `₩${n.toLocaleString("ko-KR")}`;
}

export default async function PartnerFeaturesPage() {
  const partner = await requirePartner();
  const features = await listAllFeatures();

  const visible = features.filter(
    (f) => f.pack_tier !== "HIDDEN" && (f.status === "GA" || f.status === "BETA")
  );
  const codes = visible.map((f) => f.code);
  const ownership = await getFeatureMap(partner.id, codes);

  const owned = visible.filter((f) => ownership[f.code]);
  const notOwned = visible.filter((f) => !ownership[f.code]);

  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">기능 카탈로그</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden>
            🛍️
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              기능 카탈로그
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              본사가 제공하는 기능 중 보유 중인 항목과 추가 도입 가능한 기능을
              확인할 수 있어요.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-800">
            ✅ 보유 {owned.length}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-semibold text-slate-700">
            🔒 미보유 {notOwned.length}
          </span>
        </div>
      </header>

      {/* 보유 기능 */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>✅</span>
          <span>사용 중인 기능</span>
        </h2>
        {owned.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-8 text-center text-xs text-[#6B6560]">
            아직 사용 중인 기능이 없어요. 본사에 문의해 기능을 받으세요.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {owned.map((f) => (
              <li
                key={f.code}
                className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl" aria-hidden>
                    {f.icon ?? "🧩"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#2D5A3D]">
                        {f.name}
                      </h3>
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        ✅ 보유
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-[#8B7F75]">
                      {FEATURE_CATEGORY_META[f.category]}
                    </p>
                    {f.short_desc && (
                      <p className="mt-2 text-xs text-[#6B6560]">
                        {f.short_desc}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 미보유 OPTIONAL 기능 */}
      {notOwned.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🛒</span>
            <span>추가 가능한 기능</span>
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {notOwned.map((f) => {
              const tier = PACK_TIER_META[f.pack_tier];
              const isPaid = f.pack_tier === "OPTIONAL";
              return (
                <li
                  key={f.code}
                  className="relative rounded-2xl border border-dashed border-[#E5DDD0] bg-white/70 p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="text-3xl opacity-60 grayscale"
                      aria-hidden
                    >
                      {f.icon ?? "🧩"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#6B6560]">
                          {f.name}
                        </h3>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          🔒 미보유
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-[#8B7F75]">
                        {FEATURE_CATEGORY_META[f.category]} · {tier.emoji}{" "}
                        {tier.label}
                      </p>
                      {f.short_desc && (
                        <p className="mt-2 text-xs text-[#6B6560]">
                          {f.short_desc}
                        </p>
                      )}
                      {isPaid &&
                        (f.setup_fee_krw > 0 || f.monthly_fee_krw > 0) && (
                          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-900">
                            세팅 <b>{formatKRW(f.setup_fee_krw)}</b> · 월{" "}
                            <b>{formatKRW(f.monthly_fee_krw)}</b>{" "}
                            <span className="opacity-70">(VAT 별도)</span>
                          </div>
                        )}
                      <div className="mt-3 flex justify-end">
                        <a
                          href="mailto:support@toriro.kr?subject=기능 도입 문의"
                          className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
                        >
                          본사에 문의
                        </a>
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
