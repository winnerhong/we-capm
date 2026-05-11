import { createClient } from "@/lib/supabase/server";

/**
 * 기관(org) 의 현재 org_name 을 DB 에서 읽어 반환.
 * - 쿠키(campnic_user.orgName) 는 로그인 시점 값이라 기관명 변경 후엔 stale.
 * - 참가자/관리자 UI 에서 항상 최신 이름을 보여줘야 할 때 사용.
 * - 실패하거나 행이 없으면 fallback 인자 반환.
 */
export async function loadOrgNameById(
  orgId: string,
  fallback = "소속 기관"
): Promise<string> {
  if (!orgId) return fallback;
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("partner_orgs" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { org_name: string | null } | null;
            }>;
          };
        };
      }
    )
      .select("org_name")
      .eq("id", orgId)
      .maybeSingle()) as { data: { org_name: string | null } | null };
    const name = resp.data?.org_name?.trim();
    return name && name.length > 0 ? name : fallback;
  } catch {
    return fallback;
  }
}

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
