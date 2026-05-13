// server-only: 기관 하단 홈페이지 배너 조회.
//
// 컬럼이 없거나 RLS 충돌이어도 silent fail — 표시 측은 null 처리.

import { createClient } from "@/lib/supabase/server";

export interface OrgHomepageBanner {
  /** 메인 문구 위에 작게 노출되는 보조 안내문. 예: "더 많은 행사정보 및 체육수업이 궁금하시다면?". */
  subtitle: string | null;
  text: string | null;
  url: string | null;
  imageUrl: string | null;
  /** 배너 아래 푸터 강조 한 줄. 예: "WE ARE THE WINNER". */
  footerBrand: string | null;
  /** 배너 아래 푸터 본문 — 줄바꿈 그대로. 예: "위너키즈스포츠 · 1800-7581\n(주) 위너그룹". */
  footerMeta: string | null;
}

export async function loadOrgHomepageBanner(
  orgId: string | null | undefined
): Promise<OrgHomepageBanner | null> {
  if (!orgId) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("partner_orgs")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select(
        "homepage_banner_subtitle,homepage_banner_text,homepage_banner_url,homepage_banner_image_url,homepage_banner_footer_brand,homepage_banner_footer_meta" as any
      )
      .eq("id", orgId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as unknown as {
      homepage_banner_subtitle: string | null;
      homepage_banner_text: string | null;
      homepage_banner_url: string | null;
      homepage_banner_image_url: string | null;
      homepage_banner_footer_brand: string | null;
      homepage_banner_footer_meta: string | null;
    };
    return {
      subtitle: row.homepage_banner_subtitle?.trim() || null,
      text: row.homepage_banner_text?.trim() || null,
      url: row.homepage_banner_url?.trim() || null,
      imageUrl: row.homepage_banner_image_url?.trim() || null,
      footerBrand: row.homepage_banner_footer_brand?.trim() || null,
      footerMeta: row.homepage_banner_footer_meta?.trim() || null,
    };
  } catch {
    return null;
  }
}
