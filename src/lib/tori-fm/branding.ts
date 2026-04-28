// 기관별 토리FM 표시명(브랜드명) 로더.
// partner_orgs.fm_brand_name 컬럼에서 읽어오고, 없거나 빈 값이면 기본값 "토리FM".
// 사용처:
//  - 참가자 홈 카드 (src/app/(user)/home/tori-fm-card.tsx)
//  - 참가자 토리FM 페이지 (src/app/(user)/tori-fm/page.tsx)
//  - 기관 토리FM 제어실 헤더 (선택)

import { createClient } from "@/lib/supabase/server";

export const DEFAULT_FM_BRAND_NAME = "토리FM";

type FmBrandRow = { fm_brand_name: string | null };

export async function loadOrgFmBrandName(orgId: string): Promise<string> {
  if (!orgId) return DEFAULT_FM_BRAND_NAME;
  const supabase = await createClient();
  const { data } = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: FmBrandRow | null }>;
        };
      };
    }
  )
    .select("fm_brand_name")
    .eq("id", orgId)
    .maybeSingle()) as { data: FmBrandRow | null };

  const raw = data?.fm_brand_name?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_FM_BRAND_NAME;
}
