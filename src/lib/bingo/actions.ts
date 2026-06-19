"use server";

// 기관 운영자용 빙고 보드 액션 — CRUD + 상태 전환 + 수동 순위.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { isBingoLines, isBingoSize } from "./types";

type Row = Record<string, unknown>;
type SbErr = { code?: string; message?: string } | null;

async function assertBoardOwned(boardId: string, orgId: string): Promise<void> {
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { id: string; org_id: string } | null;
          }>;
        };
      };
    }
  )
    .select("id, org_id")
    .eq("id", boardId)
    .maybeSingle()) as {
    data: { id: string; org_id: string } | null;
  };
  if (!resp.data || resp.data.org_id !== orgId) {
    throw new Error("이 빙고 보드에 접근할 권한이 없어요");
  }
}

function parseBoardFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const sizeRaw = Number(formData.get("size"));
  const linesRaw = Number(formData.get("lines_to_win"));
  const keywordTheme = String(formData.get("keyword_theme") ?? "").trim();
  const showRankingRaw = formData.get("show_ranking");
  const eventIdRaw = String(formData.get("event_id") ?? "").trim();

  if (!name || name.length > 60) {
    throw new Error("보드 이름은 1~60자로 입력해 주세요");
  }
  if (!isBingoSize(sizeRaw)) {
    throw new Error("빙고 크기는 3×3, 4×4, 5×5, 6×6 중에 골라주세요");
  }
  if (!isBingoLines(linesRaw)) {
    throw new Error("승리 줄 수는 1~3 사이로 골라주세요");
  }
  return {
    name,
    size: sizeRaw,
    lines_to_win: linesRaw,
    keyword_theme: keywordTheme || null,
    show_ranking:
      showRankingRaw === "on" ||
      showRankingRaw === "true" ||
      showRankingRaw === "1",
    event_id: eventIdRaw || null,
  };
}

/* -------------------------------------------------------------------------- */
/* CRUD                                                                       */
/* -------------------------------------------------------------------------- */

export async function createBingoBoardAction(
  orgId: string,
  formData: FormData
): Promise<void> {
  const org = await requireOrg();
  if (org.orgId !== orgId) throw new Error("잘못된 기관이에요");

  const fields = parseBoardFields(formData);

  const supabase = await createClient();
  const insertResp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      insert: (p: Row) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: SbErr;
          }>;
        };
      };
    }
  )
    .insert({
      org_id: orgId,
      ...fields,
      status: "DRAFT",
    } satisfies Row)
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: SbErr;
  };

  if (insertResp.error || !insertResp.data) {
    console.error("[bingo/create]", insertResp.error);
    throw new Error("빙고 보드 생성에 실패했어요");
  }

  revalidatePath(`/org/${orgId}/bingo`);
  redirect(`/org/${orgId}/bingo/${insertResp.data.id}`);
}

export async function updateBingoBoardAction(
  boardId: string,
  formData: FormData
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const fields = parseBoardFields(formData);

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      ...fields,
      updated_at: new Date().toISOString(),
    } satisfies Row)
    .eq("id", boardId)) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/update]", resp.error);
    throw new Error("빙고 보드 수정에 실패했어요");
  }

  revalidatePath(`/org/${org.orgId}/bingo`);
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
}

export async function setBingoStatusAction(
  boardId: string,
  next: "DRAFT" | "LIVE" | "ENDED"
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const patch: Row = {
    status: next,
    updated_at: new Date().toISOString(),
  };
  if (next === "LIVE") patch.starts_at = new Date().toISOString();
  if (next === "ENDED") patch.ends_at = new Date().toISOString();

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update(patch)
    .eq("id", boardId)) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/setStatus]", resp.error);
    throw new Error("상태 변경에 실패했어요");
  }

  revalidatePath(`/org/${org.orgId}/bingo`);
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
}

export async function deleteBingoBoardAction(
  boardId: string
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .delete()
    .eq("id", boardId)) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/delete]", resp.error);
    throw new Error("삭제에 실패했어요");
  }

  revalidatePath(`/org/${org.orgId}/bingo`);
  redirect(`/org/${org.orgId}/bingo`);
}

/* -------------------------------------------------------------------------- */
/* 수동 순위                                                                  */
/* -------------------------------------------------------------------------- */

export async function setManualRankingAction(
  boardId: string,
  rank: number,
  userId: string,
  prize: string | null
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);
  if (rank < 1) throw new Error("순위는 1 이상이어야 해요");

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_rankings" as never) as unknown as {
      upsert: (
        p: Row,
        opts: { onConflict: string }
      ) => Promise<{ error: SbErr }>;
    }
  ).upsert(
    {
      board_id: boardId,
      rank,
      user_id: userId,
      prize: prize?.trim() || null,
      set_at: new Date().toISOString(),
    } satisfies Row,
    { onConflict: "board_id,rank" }
  )) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/setManualRanking]", resp.error);
    throw new Error("순위 저장에 실패했어요");
  }
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
}

export async function clearManualRankingAction(
  boardId: string,
  rank: number
): Promise<void> {
  const org = await requireOrg();
  await assertBoardOwned(boardId, org.orgId);

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_rankings" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: number) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .delete()
    .eq("board_id", boardId)
    .eq("rank", rank)) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/clearManualRanking]", resp.error);
    throw new Error("순위 삭제에 실패했어요");
  }
  revalidatePath(`/org/${org.orgId}/bingo/${boardId}`);
}
