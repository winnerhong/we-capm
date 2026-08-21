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
import {
  loadCheckedEntryIds,
  loadFixedOrgCells,
  recomputeGridStats,
} from "./grid-stats";
import type { BingoSize } from "./types";

type Row = Record<string, unknown>;
type SbErr = { code?: string; message?: string } | null;

type BoardLite = {
  id: string;
  org_id: string;
  size: BingoSize;
  lines_to_win: number;
  status: string;
  arrange_ends_at: string | null;
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
    .select("id, org_id, size, lines_to_win, status, arrange_ends_at")
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

/**
 * 셀 배치/이동/제거 시점에 배열 타이머가 "지금 돌고 있는지" 검증.
 * 타이머가 돌아가는 시간이 아니면 참가자는 절대 이동할 수 없다.
 *  - arrange_ends_at = null  → 타이머 미시작 — 거부
 *  - arrange_ends_at > now() → 진행중 — 허용
 *  - arrange_ends_at <= now() → 마감 — 거부
 */
function assertArrangementOpen(board: BoardLite): void {
  if (
    board.arrange_ends_at &&
    new Date(board.arrange_ends_at).getTime() > Date.now()
  ) {
    return;
  }
  throw new Error(
    "지금은 배열 시간이 아니에요 — 운영자가 타이머를 시작하면 빙고판을 옮길 수 있어요"
  );
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

  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
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
  assertArrangementOpen(board);
  const maxPos = board.size * board.size;
  if (position < 0 || position >= maxPos) {
    throw new Error("잘못된 칸 위치예요");
  }

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

  // 기관 고정 타일 — 그 칸은 운영자 전용, 가족이 덮을 수 없음.
  const fixedCells = await loadFixedOrgCells(boardId);
  if (fixedCells.some((f) => f.position === position)) {
    throw new Error("운영자가 고정한 칸이에요");
  }
  if (fixedCells.some((f) => f.entryId === entryId)) {
    throw new Error("이 칸은 운영자가 이미 배치했어요");
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

  const checkedIds = await loadCheckedEntryIds(boardId, user.id);
  await recomputeGridStats(
    gridId,
    board.size,
    board.lines_to_win,
    checkedIds,
    fixedCells
  );

  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
  revalidatePath(`/org/${board.org_id}/bingo/${boardId}/live`);
}

export async function removeEntryFromCellAction(
  boardId: string,
  position: number
): Promise<void> {
  const user = await requireAuthedUser();
  const board = await requireLiveBoard(boardId);
  assertArrangementOpen(board);

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

  const fixedCells = await loadFixedOrgCells(boardId);
  if (fixedCells.some((f) => f.position === position)) {
    throw new Error("운영자가 고정한 칸이에요");
  }

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

  const checkedIds = await loadCheckedEntryIds(boardId, user.id);
  await recomputeGridStats(
    gridId,
    board.size,
    board.lines_to_win,
    checkedIds,
    fixedCells
  );

  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
  revalidatePath(`/org/${board.org_id}/bingo/${boardId}/live`);
}

export async function swapBingoCellsAction(
  boardId: string,
  posA: number,
  posB: number
): Promise<void> {
  const user = await requireAuthedUser();
  const board = await requireLiveBoard(boardId);
  assertArrangementOpen(board);
  if (posA === posB) return;

  const fixedCells = await loadFixedOrgCells(boardId);
  if (fixedCells.some((f) => f.position === posA || f.position === posB)) {
    throw new Error("운영자가 고정한 칸이에요");
  }

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

  const checkedIds = await loadCheckedEntryIds(boardId, user.id);
  await recomputeGridStats(
    gridId,
    board.size,
    board.lines_to_win,
    checkedIds,
    fixedCells
  );

  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
  revalidatePath(`/org/${board.org_id}/bingo/${boardId}/live`);
}

/* -------------------------------------------------------------------------- */
/* 📷 QR 인증 — 운영자가 호명(=QR 띄움)한 그림의 QR을 참가자가 찍어 칸 인증       */
/* -------------------------------------------------------------------------- */

/**
 * 참가자가 운영자 화면의 QR을 찍으면 호출. entryId 는 QR 에 인코딩됨.
 *  - 그 그림이 QR 방식으로 호명(called + call_mode='QR')된 상태여야 함
 *  - 그 그림이 내 판(배치 또는 기관 고정)에 있어야 함 → 그 칸이 ⭕
 */
export async function submitQrScanAction(
  boardId: string,
  entryId: string
): Promise<void> {
  const user = await requireAuthedUser();
  const board = await requireLiveBoard(boardId);
  if (!entryId) throw new Error("QR을 다시 찍어 주세요");

  const supabase = await createClient();

  // 이 그림이 이 보드의 것이고 + QR 방식으로 호명(=QR 띄움)됐는지 검증.
  const entryResp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              board_id: string;
              keyword: string;
              called_at: string | null;
              call_mode: "CIRCLE" | "QR";
            } | null;
          }>;
        };
      };
    }
  )
    .select("id, board_id, keyword, called_at, call_mode")
    .eq("id", entryId)
    .maybeSingle()) as {
    data: {
      id: string;
      board_id: string;
      keyword: string;
      called_at: string | null;
      call_mode: "CIRCLE" | "QR";
    } | null;
  };
  const entry = entryResp.data;
  if (!entry || entry.board_id !== boardId) {
    throw new Error("이 빙고의 QR이 아니에요");
  }
  if (!entry.called_at || entry.call_mode !== "QR") {
    throw new Error("아직 운영자가 QR로 띄운 그림이 아니에요");
  }

  // 이 그림이 내 판에 있는지 — 기관 고정 타일 또는 내 배치 셀.
  const fixedCells = await loadFixedOrgCells(boardId);
  const onMyBoardByFixed = fixedCells.some((f) => f.entryId === entryId);

  const gridResp = (await (
    supabase.from("org_bingo_grids" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: { id: string } | null }>;
          };
        };
      };
    }
  )
    .select("id")
    .eq("board_id", boardId)
    .eq("user_id", user.id)
    .maybeSingle()) as { data: { id: string } | null };

  let onMyBoard = onMyBoardByFixed;
  if (!onMyBoard && gridResp.data) {
    const cellResp = (await (
      supabase.from("org_bingo_grid_cells" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{
                data: { entry_id: string } | null;
              }>;
            };
          };
        };
      }
    )
      .select("entry_id")
      .eq("grid_id", gridResp.data.id)
      .eq("entry_id", entryId)
      .maybeSingle()) as { data: { entry_id: string } | null };
    onMyBoard = !!cellResp.data;
  }
  if (!onMyBoard) {
    throw new Error(
      `😢 죄송해요! 「${entry.keyword}」 그림이 내 빙고판에 없어요`
    );
  }

  // 인증 기록 저장 (중복 무시).
  const insertResp = (await (
    supabase.from("org_bingo_signatures" as never) as unknown as {
      upsert: (
        p: Row,
        opts: { onConflict: string }
      ) => Promise<{ error: SbErr }>;
    }
  ).upsert(
    {
      board_id: boardId,
      user_id: user.id,
      entry_id: entryId,
    } satisfies Row,
    { onConflict: "board_id,user_id,entry_id" }
  )) as { error: SbErr };
  if (insertResp.error) {
    console.error("[bingo/submitQrScan]", insertResp.error);
    throw new Error("인증 저장에 실패했어요");
  }

  const gridId = gridResp.data?.id ?? (await ensureGrid(boardId, user.id));
  const checkedIds = await loadCheckedEntryIds(boardId, user.id);
  await recomputeGridStats(
    gridId,
    board.size,
    board.lines_to_win,
    checkedIds,
    fixedCells
  );

  revalidatePath("/e/[eventId]/bingo/[boardId]", "page");
  revalidatePath(`/org/${board.org_id}/bingo/${boardId}/live`);
}
