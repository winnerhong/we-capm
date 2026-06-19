"use server";

// 참가자(가족) 측 빙고 액션 — entry 등록 / 셀 배치 / 셀 비우기 / 스왑.
//
// 모든 액션은:
//   1) 로그인 검증 (campnic_user)
//   2) 보드 LIVE 검증
//   3) 동작 후 라인 카운트 재계산 + finished_at 갱신

import { revalidatePath } from "next/cache";
import { getAppUser } from "@/lib/user-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { countCompletedLines } from "./lines";
import type { BingoSize } from "./types";

type Row = Record<string, unknown>;
type SbErr = { code?: string; message?: string } | null;

type BoardLite = {
  id: string;
  org_id: string;
  size: BingoSize;
  lines_to_win: number;
  status: string;
};

async function loadBoardLite(boardId: string): Promise<BoardLite | null> {
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: BoardLite | null;
          }>;
        };
      };
    }
  )
    .select("id, org_id, size, lines_to_win, status")
    .eq("id", boardId)
    .maybeSingle()) as { data: BoardLite | null };
  return resp.data;
}

async function requireLiveBoard(boardId: string): Promise<BoardLite> {
  const board = await loadBoardLite(boardId);
  if (!board) throw new Error("빙고 보드를 찾을 수 없어요");
  if (board.status !== "LIVE") throw new Error("이 빙고는 지금 진행 중이 아니에요");
  return board;
}

async function requireAuthedUser() {
  const user = await getAppUser();
  if (!user) throw new Error("로그인이 필요해요");
  return user;
}

async function ensureGrid(
  boardId: string,
  userId: string
): Promise<string> {
  const supabase = await createClient();
  const existing = (await (
    supabase.from("org_bingo_grids" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { id: string } | null;
            }>;
          };
        };
      };
    }
  )
    .select("id")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle()) as { data: { id: string } | null };
  if (existing.data) return existing.data.id;

  const inserted = (await (
    supabase.from("org_bingo_grids" as never) as unknown as {
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
    .insert({ board_id: boardId, user_id: userId } satisfies Row)
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: SbErr;
  };
  if (inserted.error || !inserted.data) {
    console.error("[bingo/ensureGrid]", inserted.error);
    throw new Error("빙고판을 만들지 못했어요");
  }
  return inserted.data.id;
}

async function recomputeGridStats(
  gridId: string,
  size: BingoSize,
  linesToWin: number
): Promise<void> {
  const supabase = await createClient();
  const cellsResp = (await (
    supabase.from("org_bingo_grid_cells" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{
          data: Array<{ position: number }> | null;
        }>;
      };
    }
  )
    .select("position")
    .eq("grid_id", gridId)) as {
    data: Array<{ position: number }> | null;
  };
  const positions = (cellsResp.data ?? []).map((c) => c.position);
  const filled = positions.length;
  const lines = countCompletedLines(size, positions);

  // 이미 완료 처리됐는지 확인 — 한 번 finished_at 이 찍히면 라인 줄어도 유지 안 함(엄격 갱신).
  const gridResp = (await (
    supabase.from("org_bingo_grids" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { finished_at: string | null } | null;
          }>;
        };
      };
    }
  )
    .select("finished_at")
    .eq("id", gridId)
    .maybeSingle()) as { data: { finished_at: string | null } | null };

  const reachedGoal = lines >= linesToWin;
  const patch: Row = {
    lines_completed: lines,
    cells_filled: filled,
    updated_at: new Date().toISOString(),
  };
  if (reachedGoal && !gridResp.data?.finished_at) {
    patch.finished_at = new Date().toISOString();
  } else if (!reachedGoal && gridResp.data?.finished_at) {
    // 라인이 다시 줄어들면 (스왑/제거로) finished_at 무효화 — 공정성.
    patch.finished_at = null;
  }

  await (
    supabase.from("org_bingo_grids" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update(patch)
    .eq("id", gridId);
}

/* -------------------------------------------------------------------------- */
/* Entry 등록 (가족 사진 + 키워드)                                              */
/* -------------------------------------------------------------------------- */

export async function submitBingoEntryAction(
  boardId: string,
  formData: FormData
): Promise<void> {
  const user = await requireAuthedUser();
  const board = await requireLiveBoard(boardId);

  const photoUrl = String(formData.get("photo_url") ?? "").trim();
  const keyword = String(formData.get("keyword") ?? "").trim();
  if (!photoUrl) throw new Error("우리 가족 사진을 올려주세요");
  if (!keyword) throw new Error("키워드를 적어주세요");
  if (keyword.length > 30) throw new Error("키워드는 30자 이내로 적어주세요");

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      upsert: (
        p: Row,
        opts: { onConflict: string }
      ) => Promise<{ error: SbErr }>;
    }
  ).upsert(
    {
      board_id: boardId,
      user_id: user.id,
      photo_url: photoUrl,
      keyword,
    } satisfies Row,
    { onConflict: "board_id,user_id" }
  )) as { error: SbErr };

  if (resp.error) {
    console.error("[bingo/submitEntry]", resp.error);
    throw new Error("등록에 실패했어요");
  }

  await ensureGrid(boardId, user.id);

  revalidatePath(`/bingo/${boardId}`);
  revalidatePath(`/org/${board.org_id}/bingo/${boardId}/live`);
}

/* -------------------------------------------------------------------------- */
/* Cell 배치 / 비우기 / 스왑                                                   */
/* -------------------------------------------------------------------------- */

export async function placeEntryOnCellAction(
  boardId: string,
  position: number,
  entryId: string
): Promise<void> {
  const user = await requireAuthedUser();
  const board = await requireLiveBoard(boardId);
  const maxPos = board.size * board.size;
  if (position < 0 || position >= maxPos) {
    throw new Error("잘못된 칸 위치예요");
  }

  // 자기 entry 는 본인 판에 못 올림 (게임 룰).
  const supabase = await createClient();
  const entryResp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { id: string; user_id: string; board_id: string } | null;
          }>;
        };
      };
    }
  )
    .select("id, user_id, board_id")
    .eq("id", entryId)
    .maybeSingle()) as {
    data: { id: string; user_id: string; board_id: string } | null;
  };
  const entry = entryResp.data;
  if (!entry || entry.board_id !== boardId) {
    throw new Error("이 빙고의 사진이 아니에요");
  }
  if (entry.user_id === user.id) {
    throw new Error("우리 가족 사진은 다른 가족들의 판에만 올라가요");
  }

  const gridId = await ensureGrid(boardId, user.id);

  // 같은 entry 가 다른 칸에 있으면 먼저 제거 (UNIQUE 회피).
  await (
    supabase.from("org_bingo_grid_cells" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .delete()
    .eq("grid_id", gridId)
    .eq("entry_id", entryId);

  // 같은 position 의 기존 entry 도 비움 (덮어쓰기).
  await (
    supabase.from("org_bingo_grid_cells" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: number) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .delete()
    .eq("grid_id", gridId)
    .eq("position", position);

  const insertResp = (await (
    supabase.from("org_bingo_grid_cells" as never) as unknown as {
      insert: (p: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    grid_id: gridId,
    position,
    entry_id: entryId,
  } satisfies Row)) as { error: SbErr };

  if (insertResp.error) {
    console.error("[bingo/placeOnCell]", insertResp.error);
    throw new Error("배치에 실패했어요");
  }

  await recomputeGridStats(gridId, board.size, board.lines_to_win);

  revalidatePath(`/bingo/${boardId}`);
  revalidatePath(`/org/${board.org_id}/bingo/${boardId}/live`);
}

export async function removeEntryFromCellAction(
  boardId: string,
  position: number
): Promise<void> {
  const user = await requireAuthedUser();
  const board = await requireLiveBoard(boardId);

  const supabase = await createClient();
  const gridResp = (await (
    supabase.from("org_bingo_grids" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { id: string } | null;
            }>;
          };
        };
      };
    }
  )
    .select("id")
    .eq("board_id", boardId)
    .eq("user_id", user.id)
    .maybeSingle()) as { data: { id: string } | null };
  if (!gridResp.data) return;
  const gridId = gridResp.data.id;

  await (
    supabase.from("org_bingo_grid_cells" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: number) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .delete()
    .eq("grid_id", gridId)
    .eq("position", position);

  await recomputeGridStats(gridId, board.size, board.lines_to_win);

  revalidatePath(`/bingo/${boardId}`);
  revalidatePath(`/org/${board.org_id}/bingo/${boardId}/live`);
}

export async function swapBingoCellsAction(
  boardId: string,
  posA: number,
  posB: number
): Promise<void> {
  const user = await requireAuthedUser();
  const board = await requireLiveBoard(boardId);
  if (posA === posB) return;

  const supabase = await createClient();
  const gridResp = (await (
    supabase.from("org_bingo_grids" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { id: string } | null;
            }>;
          };
        };
      };
    }
  )
    .select("id")
    .eq("board_id", boardId)
    .eq("user_id", user.id)
    .maybeSingle()) as { data: { id: string } | null };
  if (!gridResp.data) return;
  const gridId = gridResp.data.id;

  const cellsResp = (await (
    supabase.from("org_bingo_grid_cells" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          in: (k: string, v: number[]) => Promise<{
            data: Array<{ position: number; entry_id: string }> | null;
          }>;
        };
      };
    }
  )
    .select("position, entry_id")
    .eq("grid_id", gridId)
    .in("position", [posA, posB])) as {
    data: Array<{ position: number; entry_id: string }> | null;
  };
  const cells = cellsResp.data ?? [];
  const a = cells.find((c) => c.position === posA);
  const b = cells.find((c) => c.position === posB);

  // 빈 칸 끼리는 의미 없음.
  if (!a && !b) return;

  // 두 칸 모두 비우고 다시 채워넣어 UNIQUE(grid_id, entry_id) 우회.
  await (
    supabase.from("org_bingo_grid_cells" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          in: (k: string, v: number[]) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .delete()
    .eq("grid_id", gridId)
    .in("position", [posA, posB]);

  const toInsert: Row[] = [];
  if (a) toInsert.push({ grid_id: gridId, position: posB, entry_id: a.entry_id });
  if (b) toInsert.push({ grid_id: gridId, position: posA, entry_id: b.entry_id });

  if (toInsert.length > 0) {
    await (
      supabase.from("org_bingo_grid_cells" as never) as unknown as {
        insert: (p: Row[]) => Promise<{ error: SbErr }>;
      }
    ).insert(toInsert);
  }

  await recomputeGridStats(gridId, board.size, board.lines_to_win);

  revalidatePath(`/bingo/${boardId}`);
  revalidatePath(`/org/${board.org_id}/bingo/${boardId}/live`);
}
