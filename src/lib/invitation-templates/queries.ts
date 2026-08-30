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

/**
 * 살아있는(보관 아닌) 템플릿 개수 — 초대장 탭 배지용.
 *
 * 목록을 불러 length 를 세지 않는 이유: 배지는 숫자 하나면 되는데 본문(인사말·
 * 초대장 내용)까지 실어오게 된다. count 만 받으면 행이 아예 안 넘어온다.
 */
export async function countOrgInvitationTemplates(
  orgId: string
): Promise<number> {
  if (!orgId) return 0;
  try {
    const supabase = await createClient();
    const resp = (await (
      supabase.from("org_invitation_templates" as never) as unknown as {
        select: (
          c: string,
          o: { count: "exact"; head: true }
        ) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: boolean) => Promise<{ count: number | null }>;
          };
        };
      }
    )
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_archived", false)) as { count: number | null };
    return resp.count ?? 0;
  } catch {
    // 배지가 안 뜨는 건 불편할 뿐이다 — 이걸로 화면이 죽으면 안 된다.
    return 0;
  }
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
