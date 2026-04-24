import Link from "next/link";
import type { OrgHomeDashboard } from "@/lib/org-home/types";

type Props = {
  resources: OrgHomeDashboard["resources"];
  orgId: string;
};

export function ResourceFamilyCard({ resources, orgId }: Props) {
  const tiles: Array<{
    href: string;
    icon: string;
    title: string;
    sub: string;
    badge?: string;
  }> = [
    {
      href: `/org/${orgId}/quest-packs`,
      icon: "📚",
      title: "스탬프북",
      sub: `총 ${resources.stampbooks.total} · LIVE ${resources.stampbooks.live} · 초안 ${resources.stampbooks.draft}`,
    },
    {
      href: `/org/${orgId}/programs`,
      icon: "🗂",
      title: "프로그램",
      sub: `총 ${resources.programs.total} · 활성 ${resources.programs.active}`,
    },
    {
      href: `/org/${orgId}/trails`,
      icon: "🗺",
      title: "My 코스관리",
      sub: `${resources.trails}개`,
    },
    {
      href: `/org/${orgId}/missions/catalog`,
      icon: "🎯",
      title: "미션 카탈로그",
      sub: `총 ${resources.partnerMissionCatalog.total}${
        resources.partnerMissionCatalog.newThisWeek > 0
          ? ` · 신규 ${resources.partnerMissionCatalog.newThisWeek}`
          : ""
      }`,
      badge:
        resources.partnerMissionCatalog.newThisWeek > 0
          ? `+${resources.partnerMissionCatalog.newThisWeek}`
          : undefined,
    },
  ];

  return (
    <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-[#2D5A3D]">📚 리소스</h2>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group relative rounded-2xl border border-[#D4E4BC] bg-[#F5F1E8] p-4 transition hover:bg-white hover:shadow-md active:scale-[0.98]"
          >
            {t.badge && (
              <span className="absolute right-2 top-2 rounded-full bg-pink-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {t.badge}
              </span>
            )}
            <div className="text-2xl" aria-hidden>
              {t.icon}
            </div>
            <p className="mt-2 text-sm font-bold text-[#2D5A3D]">{t.title}</p>
            <p className="mt-1 text-[11px] leading-tight text-[#6B6560]">
              {t.sub}
            </p>
            <span className="mt-2 inline-block text-[11px] font-semibold text-[#4A7C59] group-hover:text-[#2D5A3D]">
              열기 →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
