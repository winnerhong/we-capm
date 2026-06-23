import { createClient } from "@/lib/supabase/server";
import type {
  BingoTemplateRow,
  BingoTemplateTileRow,
  BingoTemplateWithTiles,
} from "./types";

type SbErr = { code?: string; message?: string } | null;

async function attachTiles(
  templates: BingoTemplateRow[]
): Promise<BingoTemplateWithTiles[]> {
  if (templates.length === 0) return [];
  const supabase = await createClient();
  const ids = templates.map((t) => t.id);
  const resp = (await (
    supabase.from("bingo_template_tiles" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: BingoTemplateTileRow[] | null }>;
        };
      };
    }
  )
    .select("*")
    .in("template_id", ids)
    .order("created_at", { ascending: true })) as {
    data: BingoTemplateTileRow[] | null;
  };
  const byTemplate = new Map<string, BingoTemplateTileRow[]>();
  for (const tile of resp.data ?? []) {
    const list = byTemplate.get(tile.template_id) ?? [];
    list.push(tile);
    byTemplate.set(tile.template_id, list);
  }
  return templates.map((t) => ({ ...t, tiles: byTemplate.get(t.id) ?? [] }));
}

/** 위너기획 전역 템플릿 전체. */
export async function loadGlobalTemplates(): Promise<BingoTemplateWithTiles[]> {
  const supabase = await createClient();
  const resp = (await (
    supabase.from("bingo_templates" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: BingoTemplateRow[] | null; error: SbErr }>;
        };
      };
    }
  )
    .select("*")
    .eq("scope", "GLOBAL")
    .order("created_at", { ascending: false })) as {
    data: BingoTemplateRow[] | null;
    error: SbErr;
  };
  if (resp.error) {
    console.error("[bingo/loadGlobalTemplates]", resp.error);
    return [];
  }
  return attachTiles(resp.data ?? []);
}

/** 기관이 쓸 수 있는 템플릿 — 전역(GLOBAL) + 자기 전용(ORG). */
export async function loadTemplatesForOrg(
  orgId: string
): Promise<BingoTemplateWithTiles[]> {
  if (!orgId) return [];
  const supabase = await createClient();
  const resp = (await (
    supabase.from("bingo_templates" as never) as unknown as {
      select: (c: string) => {
        or: (f: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: BingoTemplateRow[] | null; error: SbErr }>;
        };
      };
    }
  )
    .select("*")
    .or(`scope.eq.GLOBAL,org_id.eq.${orgId}`)
    .order("created_at", { ascending: false })) as {
    data: BingoTemplateRow[] | null;
    error: SbErr;
  };
  if (resp.error) {
    console.error("[bingo/loadTemplatesForOrg]", resp.error);
    return [];
  }
  return attachTiles(resp.data ?? []);
}

export async function loadTemplateById(
  id: string
): Promise<BingoTemplateWithTiles | null> {
  if (!id) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("bingo_templates" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: BingoTemplateRow | null;
            error: SbErr;
          }>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as { data: BingoTemplateRow | null; error: SbErr };
  if (resp.error || !resp.data) return null;
  return (await attachTiles([resp.data]))[0] ?? null;
}
