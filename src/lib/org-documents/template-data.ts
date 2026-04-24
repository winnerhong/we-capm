import { createClient } from "@/lib/supabase/server";

const BLANK = "_______________"; // 수기 기입용 빈칸 (언더스코어 15개)

export interface TemplateData {
  partner: {
    business_name: string;
    business_number: string;
    representative_name: string;
    address: string;
    phone: string;
  };
  org: {
    org_name: string;
    business_number: string;
    representative_name: string;
    representative_phone: string;
    address: string;
  };
  today: string; // "2026년 4월 20일"
}

type PartnerOrgRow = {
  id: string;
  partner_id: string | null;
  org_name: string | null;
  business_number: string | null;
  representative_name: string | null;
  representative_phone: string | null;
  address: string | null;
};

type PartnerRow = {
  id: string;
  name: string | null;
  business_name: string | null;
  business_number: string | null;
  representative_name: string | null;
  address: string | null;
  phone: string | null;
};

function nz(value: string | null | undefined): string {
  const s = (value ?? "").trim();
  return s.length > 0 ? s : BLANK;
}

function formatToday(): string {
  const now = new Date();
  // ko-KR 로케일: "2026. 4. 20." → "2026년 4월 20일" 로 정규화
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return `${y}년 ${m}월 ${d}일`;
}

/**
 * 서류 템플릿에 주입할 지사·기관 정보를 로드한다.
 * @param orgId partner_orgs.id
 */
export async function loadTemplateData(
  orgId: string
): Promise<TemplateData | null> {
  const supabase = await createClient();

  const { data: orgRaw } = await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: PartnerOrgRow | null }>;
        };
      };
    }
  )
    .select(
      "id,partner_id,org_name,business_number,representative_name,representative_phone,address"
    )
    .eq("id", orgId)
    .maybeSingle();

  if (!orgRaw || !orgRaw.partner_id) return null;

  const { data: partnerRaw } = await (
    supabase.from("partners" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: PartnerRow | null }>;
        };
      };
    }
  )
    .select("id,name,business_name,business_number,representative_name,address,phone")
    .eq("id", orgRaw.partner_id)
    .maybeSingle();

  if (!partnerRaw) return null;

  return {
    partner: {
      business_name: nz(partnerRaw.business_name ?? partnerRaw.name),
      business_number: nz(partnerRaw.business_number),
      representative_name: nz(partnerRaw.representative_name ?? partnerRaw.name),
      address: nz(partnerRaw.address),
      phone: nz(partnerRaw.phone),
    },
    org: {
      org_name: nz(orgRaw.org_name),
      business_number: nz(orgRaw.business_number),
      representative_name: nz(orgRaw.representative_name),
      representative_phone: nz(orgRaw.representative_phone),
      address: nz(orgRaw.address),
    },
    today: formatToday(),
  };
}
