// server-only: 기관 하단 홈페이지 배너 조회.
//
// 컬럼이 없거나 RLS 충돌이어도 silent fail — 표시 측은 null 처리.

import { createClient } from "@/lib/supabase/server";

export interface OrgHomepageBanner {
  text: string | null;
  url: string | null;
  imageUrl: string | null;
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
        "homepage_banner_text,homepage_banner_url,homepage_banner_image_url" as any
      )
      .eq("id", orgId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as unknown as {
      homepage_banner_text: string | null;
      homepage_banner_url: string | null;
      homepage_banner_image_url: string | null;
    };
    return {
      text: row.homepage_banner_text?.trim() || null,
      url: row.homepage_banner_url?.trim() || null,
      imageUrl: row.homepage_banner_image_url?.trim() || null,
    };
  } catch {
    return null;
  }
}
