import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * partner_orgs 한 행 — **요청당 한 번만** 읽는다.
 *
 * 왜 한 곳으로 모았나:
 *   기관 이름(org_name)과 소속 지사(partner_id)는 같은 행에 있는데, 예전엔 셋이
 *   따로 물었다 — loadOrgNameById 가 한 번, loadPartnerDisplayNameForOrg 가 한 번,
 *   org-home 의 loadPartnerIdForOrg 가 또 한 번. 기관 홈 한 장을 계측하니 같은
 *   행을 세 번 읽고 있었다(레이아웃과 페이지가 각자 부르는 것까지 더하면 더).
 *
 *   행이 하나면 질의도 하나여야 한다. 필요한 컬럼을 같이 읽고 cache() 로 감싼다.
 *   유효 범위는 요청 하나라, 기관명을 바꾸면 다음 요청부터 새 이름이 나온다.
 *
 * 프로필 완성도 스냅샷(profile-completeness)도 **같은 행**을 자기 컬럼 목록으로
 * 따로 읽고 있었다. 한 행에 두 번 다녀오는 셈이라 여기로 합쳤다 — 단일 행이라
 * 컬럼이 늘어도 비용은 사실상 그대로다.
 */
export type OrgRowFull = {
  org_name: string | null;
  partner_id: string | null;
  representative_name: string | null;
  representative_phone: string | null;
  email: string | null;
  address: string | null;
  business_number: string | null;
  org_type: string | null;
};

const ORG_ROW_COLUMNS =
  "org_name, partner_id, representative_name, representative_phone, email, address, business_number, org_type";
const orgRow = cache(async function orgRow(
  orgId: string
): Promise<OrgRowFull | null> {
  if (!orgId) return null;
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("partner_orgs" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: OrgRowFull | null }>;
          };
        };
      }
    )
      .select(ORG_ROW_COLUMNS)
      .eq("id", orgId)
      .maybeSingle()) as { data: OrgRowFull | null };
    return resp.data ?? null;
  } catch {
    return null;
  }
});

/** 이 기관 행 전체 — 프로필 완성도 계산이 쓴다. 위 cache() 를 그대로 탄다. */
export async function loadOrgRowFull(
  orgId: string
): Promise<OrgRowFull | null> {
  return orgRow(orgId);
}

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
  const name = (await orgRow(orgId))?.org_name?.trim();
  return name && name.length > 0 ? name : fallback;
}

/** 이 기관이 속한 지사 id. 없으면 null. */
export async function loadPartnerIdForOrg(
  orgId: string
): Promise<string | null> {
  if (!orgId) return null;
  return (await orgRow(orgId))?.partner_id ?? null;
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

  const partnerId = await loadPartnerIdForOrg(orgId);
  if (!partnerId) return "지사";

  const supabase = await createClient();
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
