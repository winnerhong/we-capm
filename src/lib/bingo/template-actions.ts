"use server";

// 토리 빙고 템플릿 액션.
//   - 위너기획(admin): 전역(GLOBAL) 템플릿 CRUD + 타일 편집.
//   - 기관(org): 자기 전용(ORG) 템플릿 저장/삭제 + 템플릿 보드 적용(append).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { recomputeAllGridsForBoard } from "./grid-stats";
import { loadTemplateById } from "./template-queries";
import { isBingoSize } from "./types";
import type { BingoTemplateRow } from "./types";

type Row = Record<string, unknown>;
type SbErr = { code?: string; message?: string } | null;

async function loadTemplateRow(id: string): Promise<BingoTemplateRow | null> {
  const supabase = await createClient();
  const resp = (await (
    supabase.from("bingo_templates" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: BingoTemplateRow | null }>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as { data: BingoTemplateRow | null };
  return resp.data;
}

/** 템플릿 수정 권한 검증: GLOBAL=admin, ORG=해당 기관. */
async function assertTemplateEditable(id: string): Promise<BingoTemplateRow> {
  const tpl = await loadTemplateRow(id);
  if (!tpl) throw new Error("템플릿을 찾을 수 없어요");
  if (tpl.scope === "GLOBAL") {
    await requireAdmin();
  } else {
    const org = await requireOrg();
    if (tpl.org_id !== org.orgId) throw new Error("이 템플릿에 접근할 권한이 없어요");
  }
  return tpl;
}

function revalidateTemplate(tpl: { id: string; scope: string; org_id: string | null }) {
  revalidatePath("/admin/bingo-templates");
  revalidatePath(`/admin/bingo-templates/${tpl.id}`);
  if (tpl.org_id) revalidatePath(`/org/${tpl.org_id}/bingo`);
}

/* -------------------------------------------------------------------------- */
/* 위너기획(admin) 전역 템플릿                                                  */
/* -------------------------------------------------------------------------- */

export async function createGlobalTemplateAction(
  formData: FormData
): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const sizeRaw = Number(formData.get("size"));
  if (!name) throw new Error("템플릿 이름을 입력해 주세요");
  if (!isBingoSize(sizeRaw)) throw new Error("크기는 3~6 사이로 골라주세요");

  const supabase = await createClient();
  const resp = (await (
    supabase.from("bingo_templates" as never) as unknown as {
      insert: (p: Row) => {
        select: (c: string) => {
          single: () => Promise<{ data: { id: string } | null; error: SbErr }>;
        };
      };
    }
  )
    .insert({ scope: "GLOBAL", name, size: sizeRaw } satisfies Row)
    .select("id")
    .single()) as { data: { id: string } | null; error: SbErr };
  if (resp.error || !resp.data) {
    console.error("[bingo/createGlobalTemplate]", resp.error);
    throw new Error("템플릿 생성에 실패했어요");
  }
  revalidatePath("/admin/bingo-templates");
  redirect(`/admin/bingo-templates/${resp.data.id}`);
}

export async function updateTemplateMetaAction(
  templateId: string,
  name: string,
  description: string | null
): Promise<void> {
  const tpl = await assertTemplateEditable(templateId);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("템플릿 이름을 입력해 주세요");

  const supabase = await createClient();
  await (
    supabase.from("bingo_templates" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      name: trimmed,
      description: description?.trim() || null,
      updated_at: new Date().toISOString(),
    } satisfies Row)
    .eq("id", templateId);
  revalidateTemplate(tpl);
}

export async function deleteTemplateAction(templateId: string): Promise<void> {
  const tpl = await assertTemplateEditable(templateId);
  const supabase = await createClient();
  await (
    supabase.from("bingo_templates" as never) as unknown as {
      delete: () => { eq: (k: string, v: string) => Promise<{ error: SbErr }> };
    }
  )
    .delete()
    .eq("id", templateId);
  revalidateTemplate(tpl);
}

/* -------------------------------------------------------------------------- */
/* 템플릿 타일 편집 (admin 또는 기관)                                           */
/* -------------------------------------------------------------------------- */

export async function addTemplateTileAction(
  templateId: string,
  keyword: string
): Promise<void> {
  const tpl = await assertTemplateEditable(templateId);
  const text = (keyword ?? "").trim();
  if (!text) throw new Error("문구를 입력해 주세요");
  if (text.length > 40) throw new Error("문구는 40자 이내로 적어주세요");

  const supabase = await createClient();
  const resp = (await (
    supabase.from("bingo_template_tiles" as never) as unknown as {
      insert: (p: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({ template_id: templateId, keyword: text } satisfies Row)) as {
    error: SbErr;
  };
  if (resp.error) {
    console.error("[bingo/addTemplateTile]", resp.error);
    throw new Error("문구 추가에 실패했어요");
  }
  revalidateTemplate(tpl);
}

export async function removeTemplateTileAction(
  templateId: string,
  tileId: string
): Promise<void> {
  const tpl = await assertTemplateEditable(templateId);
  const supabase = await createClient();
  await (
    supabase.from("bingo_template_tiles" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .delete()
    .eq("id", tileId)
    .eq("template_id", templateId);
  revalidateTemplate(tpl);
}

export async function setTemplateTilePositionAction(
  templateId: string,
  tileId: string,
  position: number | null
): Promise<void> {
  const tpl = await assertTemplateEditable(templateId);
  const supabase = await createClient();

  if (position != null) {
    if (!Number.isInteger(position) || position < 0 || position >= tpl.size * tpl.size) {
      throw new Error("잘못된 칸 위치예요");
    }
    // 그 칸을 점유한 다른 타일 해제.
    await (
      supabase.from("bingo_template_tiles" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: number) => Promise<{ error: SbErr }>;
          };
        };
      }
    )
      .update({ fixed_position: null } satisfies Row)
      .eq("template_id", templateId)
      .eq("fixed_position", position);
  }

  await (
    supabase.from("bingo_template_tiles" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .update({ fixed_position: position } satisfies Row)
    .eq("id", tileId)
    .eq("template_id", templateId);
  revalidateTemplate(tpl);
}

/* -------------------------------------------------------------------------- */
/* 기관 — 보드에 템플릿 적용 / 보드를 템플릿으로 저장                            */
/* -------------------------------------------------------------------------- */

async function assertOrgBoard(
  boardId: string,
  orgId: string
): Promise<{ size: number }> {
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { org_id: string; size: number } | null;
          }>;
        };
      };
    }
  )
    .select("org_id, size")
    .eq("id", boardId)
    .maybeSingle()) as { data: { org_id: string; size: number } | null };
  if (!resp.data || resp.data.org_id !== orgId) {
    throw new Error("이 빙고 보드에 접근할 권한이 없어요");
  }
  return { size: resp.data.size };
}

export async function applyTemplateToBoardAction(
  boardId: string,
  templateId: string
): Promise<void> {
  const org = await requireOrg();
  const { size } = await assertOrgBoard(boardId, org.orgId);

  const tpl = await loadTemplateById(templateId);
  if (!tpl) throw new Error("템플릿을 찾을 수 없어요");
  if (tpl.scope === "ORG" && tpl.org_id !== org.orgId) {
    throw new Error("이 템플릿에 접근할 권한이 없어요");
  }
  if (tpl.tiles.length === 0) throw new Error("템플릿에 문구가 없어요");

  const supabase = await createClient();

  // 이미 고정 점유된 칸 — 충돌 시 위치 없이 넣음.
  const occResp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          not: (k: string, op: string, v: null) => Promise<{
            data: Array<{ fixed_position: number | null }> | null;
          }>;
        };
      };
    }
  )
    .select("fixed_position")
    .eq("board_id", boardId)
    .not("fixed_position", "is", null)) as {
    data: Array<{ fixed_position: number | null }> | null;
  };
  const occupied = new Set<number>(
    (occResp.data ?? [])
      .map((r) => r.fixed_position)
      .filter((p): p is number => p != null)
  );

  // 보드 크기가 같을 때만 고정 위치 적용.
  const usePositions = tpl.size === size;
  const rows: Row[] = tpl.tiles.map((tile) => {
    let pos: number | null = null;
    if (
      usePositions &&
      tile.fixed_position != null &&
      tile.fixed_position < size * size &&
      !occupied.has(tile.fixed_position)
    ) {
      pos = tile.fixed_position;
      occupied.add(pos);
    }
    return {
      board_id: boardId,
      user_id: null,
      photo_url: "",
      keyword: tile.keyword,
      is_org: true,
      fixed_position: pos,
    } satisfies Row;
  });

  const resp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      insert: (p: Row[]) => Promise<{ error: SbErr }>;
    }
  ).insert(rows)) as { error: SbErr };
  if (resp.error) {
    console.error("[bingo/applyTemplate]", resp.error);
    throw new Error("템플릿 적용에 실패했어요");
  }

  await recomputeAllGridsForBoard(boardId);

  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
  revalidatePath(`/org/${org.orgId}/control-room`);
  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
}

export async function saveBoardAsOrgTemplateAction(
  boardId: string,
  name: string
): Promise<void> {
  const org = await requireOrg();
  const { size } = await assertOrgBoard(boardId, org.orgId);
  const trimmed = (name ?? "").trim();
  if (!trimmed) throw new Error("템플릿 이름을 입력해 주세요");

  const supabase = await createClient();
  // 현재 보드의 기관 문구 타일 수집.
  const tilesResp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: boolean) => Promise<{
            data: Array<{ keyword: string; fixed_position: number | null }> | null;
          }>;
        };
      };
    }
  )
    .select("keyword, fixed_position")
    .eq("board_id", boardId)
    .eq("is_org", true)) as {
    data: Array<{ keyword: string; fixed_position: number | null }> | null;
  };
  const tiles = tilesResp.data ?? [];
  if (tiles.length === 0) {
    throw new Error("저장할 기관 문구 타일이 없어요");
  }

  const tplResp = (await (
    supabase.from("bingo_templates" as never) as unknown as {
      insert: (p: Row) => {
        select: (c: string) => {
          single: () => Promise<{ data: { id: string } | null; error: SbErr }>;
        };
      };
    }
  )
    .insert({
      scope: "ORG",
      org_id: org.orgId,
      name: trimmed,
      size,
    } satisfies Row)
    .select("id")
    .single()) as { data: { id: string } | null; error: SbErr };
  if (tplResp.error || !tplResp.data) {
    console.error("[bingo/saveOrgTemplate]", tplResp.error);
    throw new Error("템플릿 저장에 실패했어요");
  }

  const tileRows: Row[] = tiles.map((t) => ({
    template_id: tplResp.data!.id,
    keyword: t.keyword,
    fixed_position: t.fixed_position,
  }));
  await (
    supabase.from("bingo_template_tiles" as never) as unknown as {
      insert: (p: Row[]) => Promise<{ error: SbErr }>;
    }
  ).insert(tileRows);

  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
}
