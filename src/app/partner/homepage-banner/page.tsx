// 지사(partner) 측 — 자기 기관들의 "하단 홈페이지 배너" 일괄 관리.
//
// 기관 admin 도 같은 기능을 자기 기관 측 /org/[id]/invitations 에서
// 사용 가능. 지사가 여러 기관을 한 페이지에서 빠르게 설정할 수 있도록 추가.

import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { PartnerHomepageBannerEditor } from "./partner-homepage-banner-editor";

export const dynamic = "force-dynamic";

type OrgRow = {
  id: string;
  org_name: string;
  homepage_banner_subtitle: string | null;
  homepage_banner_text: string | null;
  homepage_banner_url: string | null;
  homepage_banner_image_url: string | null;
  homepage_banner_footer_brand: string | null;
  homepage_banner_footer_meta: string | null;
};

export default async function PartnerHomepageBannerPage() {
  const partner = await requirePartner();
  const supabase = await createClient();

  // 지사의 모든 기관(partner_orgs) — 활성 상태만.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("partner_orgs")
    .select(
      "id,org_name,homepage_banner_subtitle,homepage_banner_text,homepage_banner_url,homepage_banner_image_url,homepage_banner_footer_brand,homepage_banner_footer_meta"
    )
    .eq("partner_id", partner.id)
    .order("org_name", { ascending: true });

  const orgs = (error ? [] : (data ?? [])) as OrgRow[];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          지사 홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href="/partner/programs"
          className="hover:text-[#2D5A3D]"
        >
          프로그램
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">하단 홈페이지 배너</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden>
            🔗
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              하단 홈페이지 배너
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              우리 지사 소속 각 기관별로 참가자 토리로 사이트(홈·일정·초대장)
              하단에 노출될 외부 홈페이지 배너를 설정할 수 있어요. 빈 값으로
              두면 배너 비노출.
            </p>
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-900">
              💡 기관 admin 도 자기 기관 측 <b>초대장 모음</b> 페이지에서 같은
              설정을 수정할 수 있습니다.
            </p>
          </div>
        </div>
      </header>

      {orgs.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#D4E4BC] bg-white px-4 py-16 text-center">
          <div className="text-4xl">🏢</div>
          <p className="mt-3 text-base font-semibold text-[#2D5A3D]">
            소속 기관이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            지사에 연결된 기관이 있을 때 여기서 배너를 설정할 수 있어요.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {orgs.map((o) => (
            <section
              key={o.id}
              className="rounded-3xl border border-[#D4E4BC] bg-white shadow-sm"
            >
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0EBE3] bg-[#FFF8F0] px-5 py-3">
                <h2 className="text-base font-bold text-[#2D5A3D]">
                  🏢 {o.org_name || "(이름 없음)"}
                </h2>
                <Link
                  href={`/org/${o.id}/invitations`}
                  className="text-[11px] text-[#6B6560] hover:text-[#2D5A3D] hover:underline"
                >
                  기관 측에서 보기 →
                </Link>
              </header>
              <div className="p-5">
                <PartnerHomepageBannerEditor
                  orgId={o.id}
                  initial={{
                    subtitle: o.homepage_banner_subtitle ?? "",
                    text: o.homepage_banner_text ?? "",
                    url: o.homepage_banner_url ?? "",
                    imageUrl: o.homepage_banner_image_url ?? "",
                    footerBrand: o.homepage_banner_footer_brand ?? "",
                    footerMeta: o.homepage_banner_footer_meta ?? "",
                  }}
                />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
