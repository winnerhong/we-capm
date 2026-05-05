import Link from "next/link";

/**
 * 기능이 부여되지 않았을 때 보여주는 화면.
 * Server component — 페이지에서 직접 import.
 */
export function FeatureGate({
  featureCode,
  featureName,
  description,
  breadcrumbHref = "/partner/dashboard",
  breadcrumbLabel = "대시보드",
}: {
  featureCode: string;
  featureName: string;
  description?: string;
  breadcrumbHref?: string;
  breadcrumbLabel?: string;
}) {
  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={breadcrumbHref} className="hover:text-[#2D5A3D]">
          {breadcrumbLabel}
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">{featureName}</span>
      </nav>

      <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#E5DDD0] bg-[#FFF8F0] px-4 py-16 text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="mt-4 text-lg font-bold text-[#2D5A3D]">
          이 기능을 사용하려면 부여가 필요합니다
        </h1>
        <p className="mt-2 max-w-md text-sm text-[#6B6560]">
          <b className="text-[#2D5A3D]">{featureName}</b> 기능(
          <span className="font-mono text-xs">{featureCode}</span>)이
          현재 부여되어 있지 않습니다. 본사에 문의해 도입하세요.
        </p>
        {description && (
          <p className="mt-3 max-w-md text-xs text-[#8B7F75]">{description}</p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/partner/features"
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            🛍️ 기능 카탈로그 보기
          </Link>
          <a
            href="mailto:support@toriro.kr?subject=기능 도입 문의"
            className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3A7A52]"
          >
            본사에 문의
          </a>
        </div>
      </section>
    </div>
  );
}
