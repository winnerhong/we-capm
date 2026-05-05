import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { hasFeature } from "@/lib/features/guard";
import { listPartnerTemplates } from "@/lib/event-templates/queries";
import {
  TEMPLATE_STATUS_META,
  VISIBILITY_META,
} from "@/lib/event-templates/types";
import { FeatureGate } from "@/components/features/feature-gate";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function PartnerEventTemplatesPage() {
  const partner = await requirePartner();
  const enabled = await hasFeature(partner.id, "EVENT_TEMPLATE");

  if (!enabled) {
    return (
      <FeatureGate
        featureCode="EVENT_TEMPLATE"
        featureName="행사 템플릿"
        description="지사가 행사 패키지를 만들어 기관에 일괄 배포할 수 있는 기능입니다."
        breadcrumbHref="/partner/dashboard"
        breadcrumbLabel="대시보드"
      />
    );
  }

  const templates = await listPartnerTemplates(partner.id);

  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">행사 템플릿</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              📦
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                행사 템플릿
              </h1>
              <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                프로그램·숲길을 묶어 행사 패키지를 만들고, 기관이 가져갈 수
                있도록 공개합니다.
              </p>
            </div>
          </div>
          <Link
            href="/partner/event-templates/new"
            className="shrink-0 rounded-xl bg-[#2D5A3D] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#3A7A52]"
          >
            + 새 행사 템플릿
          </Link>
        </div>
      </header>

      {templates.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#D4E4BC] bg-white px-4 py-16 text-center">
          <div className="text-4xl">🌱</div>
          <p className="mt-3 text-base font-semibold text-[#2D5A3D]">
            아직 만든 템플릿이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            첫 템플릿을 만들어 기관에 패키지로 제공해보세요.
          </p>
          <Link
            href="/partner/event-templates/new"
            className="mt-4 inline-flex items-center rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3A7A52]"
          >
            + 새 행사 템플릿 만들기
          </Link>
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const sm = TEMPLATE_STATUS_META[t.status];
            const vm = VISIBILITY_META[t.visibility];
            return (
              <Link
                key={t.id}
                href={`/partner/event-templates/${t.id}/edit`}
                className="group overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="aspect-[16/9] w-full bg-[#FFF8F0]">
                  {t.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.cover_image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl opacity-40">
                      📦
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-bold text-[#2D5A3D] group-hover:text-[#3A7A52]">
                      {t.name}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sm.bg} ${sm.text}`}
                    >
                      {sm.label}
                    </span>
                  </div>
                  {t.subtitle && (
                    <p className="line-clamp-2 text-xs text-[#6B6560]">
                      {t.subtitle}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[#8B7F75]">
                    <span className="rounded-full border border-[#E5DDD0] px-2 py-0.5">
                      {vm.emoji} {vm.label}
                    </span>
                    <span>{fmtDate(t.updated_at)}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
