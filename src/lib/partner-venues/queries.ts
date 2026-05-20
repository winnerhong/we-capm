// server-only — SSR 로더.

import { createClient } from "@/lib/supabase/server";
import type { PartnerVenueRow } from "./types";

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

/**
 * 지사별 행사장 카탈로그.
 *  - includeArchived=false (디폴트): 보관 제외
 *  - 정렬: sort_order ASC, created_at DESC
 */
export async function loadPartnerVenues(
  partnerId: string,
  opts?: { includeArchived?: boolean }
): Promise<PartnerVenueRow[]> {
  if (!partnerId) return [];
  const includeArchived = opts?.includeArchived ?? false;
  const supabase = await createClient();

  type Q = {
    select: (c: string) => Q;
    eq: (k: string, v: string | boolean) => Q;
    order: (c: string, o: { ascending: boolean }) => Q;
  };
  let q = (supabase.from("partner_venues" as never) as unknown as Q).select(
    "*"
  );
  q = q.eq("partner_id", partnerId);
  if (!includeArchived) q = q.eq("is_archived", false);
  q = q.order("sort_order", { ascending: true });
  q = q.order("created_at", { ascending: false });

  const resp = (await (q as unknown as Promise<SbResp<PartnerVenueRow>>));
  return resp.data ?? [];
}

export async function loadPartnerVenueById(
  id: string
): Promise<PartnerVenueRow | null> {
  if (!id) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("partner_venues" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<PartnerVenueRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<PartnerVenueRow>;
  return resp.data ?? null;
}

/**
 * 기관(org) 가 속한 지사의 모든 활성 행사장.
 *  - org 행사 편집 폼의 셀렉터에서 사용.
 *  - org 의 partner_id 가 NULL 인 경우(독립 기관) 빈 배열.
 */
export async function loadVenuesForOrg(
  orgId: string
): Promise<PartnerVenueRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();
  // 1) org → partner_id
  const orgResp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<{ partner_id: string | null }>>;
        };
      };
    }
  )
    .select("partner_id")
    .eq("id", orgId)
    .maybeSingle()) as SbRespOne<{ partner_id: string | null }>;

  const partnerId = orgResp.data?.partner_id ?? null;
  if (!partnerId) return [];
  return loadPartnerVenues(partnerId);
}
