// server-only — SSR 로더.

import { createClient } from "@/lib/supabase/server";
import type { OrgInvitationTemplateRow } from "./types";

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

/**
 * 기관별 초대장 템플릿.
 *  - includeArchived=false (디폴트): 보관 처리 제외
 *  - 정렬: sort_order ASC, created_at DESC
 */
export async function loadOrgInvitationTemplates(
  orgId: string,
  opts?: { includeArchived?: boolean }
): Promise<OrgInvitationTemplateRow[]> {
  if (!orgId) return [];
  const includeArchived = opts?.includeArchived ?? false;
  const supabase = await createClient();

  type Q = {
    select: (c: string) => Q;
    eq: (k: string, v: string | boolean) => Q;
    order: (c: string, o: { ascending: boolean }) => Q;
  };
  let q = (
    supabase.from("org_invitation_templates" as never) as unknown as Q
  ).select("*");
  q = q.eq("org_id", orgId);
  if (!includeArchived) q = q.eq("is_archived", false);
  q = q.order("sort_order", { ascending: true });
  q = q.order("created_at", { ascending: false });

  const resp = (await (q as unknown as Promise<
    SbResp<OrgInvitationTemplateRow>
  >));
  return resp.data ?? [];
}

export async function loadOrgInvitationTemplateById(
  id: string
): Promise<OrgInvitationTemplateRow | null> {
  if (!id) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_invitation_templates" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<OrgInvitationTemplateRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<OrgInvitationTemplateRow>;
  return resp.data ?? null;
}
