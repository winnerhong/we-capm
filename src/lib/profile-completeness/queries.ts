// server-only
import { createClient } from "@/lib/supabase/server";
import { loadLatestPartnerDocuments } from "@/lib/documents/queries";
import { loadLatestOrgDocuments } from "@/lib/org-documents/queries";
import type { ProfileSnapshot } from "./types";

type PartnerRow = {
  business_name: string | null;
  representative_name: string | null;
  business_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  name: string | null;
};

type SbRespOne<T> = { data: T | null; error: unknown };

/**
 * 지사(partner)의 프로필 완성도 계산용 스냅샷 로드.
 */
export async function loadPartnerProfileSnapshot(
  partnerId: string
): Promise<ProfileSnapshot> {
  const supabase = await createClient();

  const { data: row } = (await (
    supabase.from("partners" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<PartnerRow>>;
        };
      };
    }
  )
    .select(
      "business_name,representative_name,business_number,phone,email,address,bank_name,account_number,account_holder,name"
    )
    .eq("id", partnerId)
    .maybeSingle()) as SbRespOne<PartnerRow>;

  const p = row ?? ({} as PartnerRow);
  const db: ProfileSnapshot["db"] = {
    // business_name이 비면 name으로 폴백 — 지사 생성 시 최소 name만 있는 케이스 보정
    business_name: p.business_name ?? p.name ?? null,
    representative_name: p.representative_name ?? null,
    business_number: p.business_number ?? null,
    phone: p.phone ?? null,
    email: p.email ?? null,
    address: p.address ?? null,
    bank_name: p.bank_name ?? null,
    account_number: p.account_number ?? null,
    account_holder: p.account_holder ?? null,
  };

  // 문서 — 최신 버전 기준 상태
  const docs: ProfileSnapshot["docs"] = {};
  try {
    const latestMap = await loadLatestPartnerDocuments(partnerId);
    for (const [docType, doc] of latestMap.entries()) {
      docs[docType] = doc.status;
    }
  } catch {
    // 무시 — 비어 있으면 모두 미완료 처리
  }

  return { db, docs };
}

/* ---------- 기관(Org) ---------- */

type OrgRow = {
  org_name: string | null;
  representative_name: string | null;
  representative_phone: string | null;
  email: string | null;
  address: string | null;
  business_number: string | null;
  org_type: string | null;
};

/**
 * 기관(org) 프로필 완성도 계산용 스냅샷 로드.
 */
export async function loadOrgProfileSnapshot(
  orgId: string
): Promise<ProfileSnapshot> {
  const supabase = await createClient();

  const { data: row } = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<OrgRow>>;
        };
      };
    }
  )
    .select(
      "org_name,representative_name,representative_phone,email,address,business_number,org_type"
    )
    .eq("id", orgId)
    .maybeSingle()) as SbRespOne<OrgRow>;

  const o = row ?? ({} as OrgRow);
  const db: ProfileSnapshot["db"] = {
    org_name: o.org_name ?? null,
    representative_name: o.representative_name ?? null,
    representative_phone: o.representative_phone ?? null,
    email: o.email ?? null,
    address: o.address ?? null,
    business_number: o.business_number ?? null,
    org_type: o.org_type ?? null,
  };

  const docs: ProfileSnapshot["docs"] = {};
  try {
    const latestMap = await loadLatestOrgDocuments(orgId);
    for (const [docType, doc] of latestMap.entries()) {
      docs[docType] = doc.status;
    }
  } catch {
    // 무시
  }

  return { db, docs };
}
