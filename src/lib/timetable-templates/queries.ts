// server-only — SSR 로더 (지사 타임테이블 템플릿).

import { createClient } from "@/lib/supabase/server";
import type {
  PartnerTimetableTemplateRow,
  PartnerTimetableTemplateSlot,
} from "./types";

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

/** DB row (slots 는 중첩 관계명 그대로) → 정렬된 PartnerTimetableTemplateRow. */
type RawRow = Omit<PartnerTimetableTemplateRow, "slots"> & {
  partner_timetable_template_slots: PartnerTimetableTemplateSlot[] | null;
};

const SELECT = "*, partner_timetable_template_slots(*)";

function normalize(raw: RawRow): PartnerTimetableTemplateRow {
  const slots = (raw.partner_timetable_template_slots ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const { partner_timetable_template_slots: _drop, ...rest } = raw;
  void _drop;
  return { ...rest, slots };
}

/**
 * 지사별 타임테이블 템플릿 목록 (슬롯 포함).
 *  - includeArchived=false (디폴트): 보관 제외
 *  - 정렬: sort_order ASC, created_at DESC
 */
export async function loadTimetableTemplates(
  partnerId: string,
  opts?: { includeArchived?: boolean }
): Promise<PartnerTimetableTemplateRow[]> {
  if (!partnerId) return [];
  const includeArchived = opts?.includeArchived ?? false;
  const supabase = await createClient();

  type Q = {
    select: (c: string) => Q;
    eq: (k: string, v: string | boolean) => Q;
    order: (c: string, o: { ascending: boolean }) => Q;
  };
  let q = (
    supabase.from("partner_timetable_templates" as never) as unknown as Q
  ).select(SELECT);
  q = q.eq("partner_id", partnerId);
  if (!includeArchived) q = q.eq("is_archived", false);
  q = q.order("sort_order", { ascending: true });
  q = q.order("created_at", { ascending: false });

  const resp = (await (q as unknown as Promise<SbResp<RawRow>>));
  return (resp.data ?? []).map(normalize);
}

export async function loadTimetableTemplateById(
  id: string
): Promise<PartnerTimetableTemplateRow | null> {
  if (!id) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("partner_timetable_templates" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<RawRow>>;
        };
      };
    }
  )
    .select(SELECT)
    .eq("id", id)
    .maybeSingle()) as SbRespOne<RawRow>;
  return resp.data ? normalize(resp.data) : null;
}

/**
 * 기관(org) 이 속한 지사의 활성 타임테이블 템플릿 — 행사 편집기 "가져오기" 셀렉터용.
 *  - org 의 partner_id 가 NULL 이면 빈 배열.
 */
export async function loadTimetableTemplatesForOrg(
  orgId: string
): Promise<PartnerTimetableTemplateRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();
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
  return loadTimetableTemplates(partnerId);
}
