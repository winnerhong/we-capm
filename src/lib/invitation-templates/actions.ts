"use server";

// org_invitation_templates CRUD — 인사말/초대장 내용 템플릿.
// gift-templates 액션과 같은 패턴: requireOrg + 소유권 검증 + revalidatePath.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-auth-guard";

type Row = Record<string, unknown>;
type SbErr = { message: string; code?: string } | null;
type SbRespOne<T> = { data: T | null; error: SbErr };
type SbResp<T> = { data: T[] | null; error: SbErr };

function revalidateAll(orgId: string) {
  revalidatePath(`/org/${orgId}/invitations/templates`);
  // edit 폼이 템플릿 셀렉터를 로드하므로 events 페이지도 무효화 (페이지가 많아 layout 단위로).
  revalidatePath(`/org/${orgId}/events`, "layout");
}

/**
 * 새 템플릿 생성.
 *  - label 필수, message/body 둘 다 선택(둘 다 비어도 OK — 의도적).
 *  - sort_order 자동 부여 (현재 최댓값 + 10).
 */
export async function createInvitationTemplateAction(input: {
  label: string;
  message?: string | null;
  body?: string | null;
}): Promise<{ id: string }> {
  const org = await requireOrg();
  const label = (input.label ?? "").trim();
  if (!label) throw new Error("템플릿 이름을 입력해 주세요");

  const message = (input.message ?? "").trim() || null;
  const body = (input.body ?? "").trim() || null;

  const supabase = await createClient();

  // 다음 sort_order — 현재 최댓값 + 10
  const maxResp = (await (
    supabase.from("org_invitation_templates" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => {
            limit: (n: number) => Promise<SbResp<{ sort_order: number }>>;
          };
        };
      };
    }
  )
    .select("sort_order")
    .eq("org_id", org.orgId)
    .order("sort_order", { ascending: false })
    .limit(1)) as SbResp<{ sort_order: number }>;
  const nextOrder = ((maxResp.data ?? [])[0]?.sort_order ?? 0) + 10;

  const insResp = (await (
    supabase.from("org_invitation_templates" as never) as unknown as {
      insert: (r: Row) => {
        select: (c: string) => {
          maybeSingle: () => Promise<SbRespOne<{ id: string }>>;
        };
      };
    }
  )
    .insert({
      org_id: org.orgId,
      label,
      message,
      body,
      sort_order: nextOrder,
    } satisfies Row)
    .select("id")
    .maybeSingle()) as SbRespOne<{ id: string }>;

  if (!insResp.data?.id) {
    console.error("[invitation-templates/create] failed", insResp.error);
    throw new Error("템플릿 생성에 실패했어요");
  }

  revalidateAll(org.orgId);
  return { id: insResp.data.id };
}

/**
 * 템플릿 수정 — 같은 org 소유만 가능, 부분 업데이트.
 */
export async function updateInvitationTemplateAction(input: {
  id: string;
  label?: string;
  message?: string | null;
  body?: string | null;
  sortOrder?: number;
}): Promise<void> {
  const org = await requireOrg();
  const id = (input.id ?? "").trim();
  if (!id) throw new Error("템플릿을 찾을 수 없어요");

  const supabase = await createClient();

  const ownResp = (await (
    supabase.from("org_invitation_templates" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<{ org_id: string }>>;
        };
      };
    }
  )
    .select("org_id")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<{ org_id: string }>;
  if (!ownResp.data) throw new Error("템플릿을 찾을 수 없어요");
  if (ownResp.data.org_id !== org.orgId) {
    throw new Error("다른 기관의 템플릿이에요");
  }

  const patch: Row = {};
  if (typeof input.label === "string") {
    const v = input.label.trim();
    if (!v) throw new Error("템플릿 이름을 입력해 주세요");
    patch.label = v;
  }
  if (input.message !== undefined) {
    patch.message = (input.message ?? "").trim() || null;
  }
  if (input.body !== undefined) {
    patch.body = (input.body ?? "").trim() || null;
  }
  if (typeof input.sortOrder === "number") {
    patch.sort_order = Math.floor(input.sortOrder);
  }
  if (Object.keys(patch).length === 0) return;
  patch.updated_at = new Date().toISOString();

  const upd = (await (
    supabase.from("org_invitation_templates" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update(patch)
    .eq("id", id)) as { error: SbErr };
  if (upd.error) {
    console.error("[invitation-templates/update] error", upd.error);
    throw new Error("템플릿 수정에 실패했어요");
  }

  revalidateAll(org.orgId);
}

export async function archiveInvitationTemplateAction(
  id: string,
  archive: boolean = true
): Promise<void> {
  const org = await requireOrg();
  if (!id) throw new Error("템플릿을 찾을 수 없어요");
  const supabase = await createClient();

  const ownResp = (await (
    supabase.from("org_invitation_templates" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<{ org_id: string }>>;
        };
      };
    }
  )
    .select("org_id")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<{ org_id: string }>;
  if (!ownResp.data) throw new Error("템플릿을 찾을 수 없어요");
  if (ownResp.data.org_id !== org.orgId) {
    throw new Error("다른 기관의 템플릿이에요");
  }

  const upd = (await (
    supabase.from("org_invitation_templates" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      is_archived: archive,
      updated_at: new Date().toISOString(),
    } satisfies Row)
    .eq("id", id)) as { error: SbErr };
  if (upd.error) {
    console.error("[invitation-templates/archive] error", upd.error);
    throw new Error("템플릿 보관 처리에 실패했어요");
  }

  revalidateAll(org.orgId);
}

export async function deleteInvitationTemplateAction(id: string): Promise<void> {
  const org = await requireOrg();
  if (!id) throw new Error("템플릿을 찾을 수 없어요");
  const supabase = await createClient();

  const ownResp = (await (
    supabase.from("org_invitation_templates" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<{ org_id: string }>>;
        };
      };
    }
  )
    .select("org_id")
    .eq("id", id)
    .maybeSingle()) as SbRespOne<{ org_id: string }>;
  if (!ownResp.data) throw new Error("템플릿을 찾을 수 없어요");
  if (ownResp.data.org_id !== org.orgId) {
    throw new Error("다른 기관의 템플릿이에요");
  }

  const del = (await (
    supabase.from("org_invitation_templates" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .delete()
    .eq("id", id)) as { error: SbErr };
  if (del.error) {
    console.error("[invitation-templates/delete] error", del.error);
    throw new Error("템플릿 삭제에 실패했어요");
  }

  revalidateAll(org.orgId);
}
