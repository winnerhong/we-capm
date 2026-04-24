import { createClient } from "@/lib/supabase/server";

/**
 * 기관(org) 의 소속 지사(partner) 표시명을 반환.
 * - `partners.business_name` 우선 (예: "(주)위너사업자")
 * - 없으면 `partners.name`
 * - 둘 다 없으면 "지사" fallback
 *
 * 기관 측 페이지에서 "(지사명)에서 개발한 ..." 같은 문구에 쓰입니다.
 */
export async function loadPartnerDisplayNameForOrg(
  orgId: string
): Promise<string> {
  if (!orgId) return "지사";
  const supabase = await createClient();

  const orgResp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { partner_id: string } | null;
          }>;
        };
      };
    }
  )
    .select("partner_id")
    .eq("id", orgId)
    .maybeSingle()) as { data: { partner_id: string } | null };

  const partnerId = orgResp.data?.partner_id;
  if (!partnerId) return "지사";

  const partnerResp = (await (
    supabase.from("partners" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { name: string; business_name: string | null } | null;
          }>;
        };
      };
    }
  )
    .select("name, business_name")
    .eq("id", partnerId)
    .maybeSingle()) as {
    data: { name: string; business_name: string | null } | null;
  };

  return (
    partnerResp.data?.business_name?.trim() ||
    partnerResp.data?.name?.trim() ||
    "지사"
  );
}
