// 빙고 grid 통계 재계산 — **호명(called) 기반**.
//
// 정통 빙고 규칙: 한 칸이 "체크"되려면 (1) 그 칸에 그림이 배치돼 있고
// (2) 그 그림이 운영자에게 호명(called_at != null)돼야 한다.
// 줄(라인)은 체크된 칸으로만 완성된다.
//
// 이 모듈은 server-only 헬퍼 ("use server" 아님 — 액션이 아니라 내부 유틸).

import { createClient } from "@/lib/supabase/server";
import { countCompletedLines } from "./lines";
import type { BingoSize } from "./types";

type Row = Record<string, unknown>;
type SbErr = { code?: string; message?: string } | null;

/** 기관 고정 타일 셀 — 모든 가족 판에 가상 오버레이된다. */
export type FixedCell = { position: number; entryId: string; called: boolean };

/** 보드의 고정 배치된 기관 타일들 (position, called 여부). */
export async function loadFixedOrgCells(
  boardId: string
): Promise<FixedCell[]> {
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: boolean) => {
            not: (k: string, op: string, v: null) => Promise<{
              data: Array<{
                id: string;
                fixed_position: number | null;
                called_at: string | null;
              }> | null;
            }>;
          };
        };
      };
    }
  )
    .select("id, fixed_position, called_at")
    .eq("board_id", boardId)
    .eq("is_org", true)
    .not("fixed_position", "is", null)) as {
    data: Array<{
      id: string;
      fixed_position: number | null;
      called_at: string | null;
    }> | null;
  };
  return (resp.data ?? [])
    .filter((r) => r.fixed_position != null)
    .map((r) => ({
      position: r.fixed_position as number,
      entryId: r.id,
      called: !!r.called_at,
    }));
}

/** 보드에서 호명된 entry (방식 + 소유자 포함). */
async function loadCalledEntries(
  boardId: string
): Promise<
  Array<{ id: string; user_id: string | null; call_mode: "CIRCLE" | "QR" }>
> {
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          not: (k: string, op: string, v: null) => Promise<{
            data: Array<{
              id: string;
              user_id: string | null;
              call_mode: "CIRCLE" | "QR";
            }> | null;
          }>;
        };
      };
    }
  )
    .select("id, user_id, call_mode")
    .eq("board_id", boardId)
    .not("called_at", "is", null)) as {
    data: Array<{
      id: string;
      user_id: string | null;
      call_mode: "CIRCLE" | "QR";
    }> | null;
  };
  return resp.data ?? [];
}

/** 자동 ⭕(CIRCLE 방식)로 호명된 entry id 집합 — 모든 가족 공통 체크. */
export async function loadCircleCalledIds(
  boardId: string
): Promise<Set<string>> {
  const called = await loadCalledEntries(boardId);
  return new Set(called.filter((e) => e.call_mode === "CIRCLE").map((e) => e.id));
}

/** QR 방식으로 호명된 entry id 집합 — 참가자가 찍어야 ⭕ (QR 미션). */
export async function loadQrCalledIds(
  boardId: string
): Promise<Set<string>> {
  const called = await loadCalledEntries(boardId);
  return new Set(called.filter((e) => e.call_mode === "QR").map((e) => e.id));
}

/**
 * QR로 호명된 사진의 "주인" → 그 entry id 매핑.
 * 주인은 자기 사진을 스스로 인증할 필요 없이 자동 ⭕ 처리된다.
 */
export async function loadOwnQrEntryByUser(
  boardId: string
): Promise<Map<string, string>> {
  const called = await loadCalledEntries(boardId);
  const m = new Map<string, string>();
  for (const e of called) {
    if (e.call_mode === "QR" && e.user_id) m.set(e.user_id, e.id);
  }
  return m;
}

/** 한 참가자가 인증(싸인)한 entry id 집합. */
export async function loadSignedEntryIds(
  boardId: string,
  userId: string
): Promise<Set<string>> {
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_signatures" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{
            data: Array<{ entry_id: string }> | null;
          }>;
        };
      };
    }
  )
    .select("entry_id")
    .eq("board_id", boardId)
    .eq("user_id", userId)) as {
    data: Array<{ entry_id: string }> | null;
  };
  return new Set((resp.data ?? []).map((r) => r.entry_id));
}

/** 보드의 모든 싸인 기록 — user_id → 인증한 entry id 집합. */
export async function loadSignedEntryIdsByUser(
  boardId: string
): Promise<Map<string, Set<string>>> {
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_signatures" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{
          data: Array<{ user_id: string; entry_id: string }> | null;
        }>;
      };
    }
  )
    .select("user_id, entry_id")
    .eq("board_id", boardId)) as {
    data: Array<{ user_id: string; entry_id: string }> | null;
  };
  const m = new Map<string, Set<string>>();
  for (const r of resp.data ?? []) {
    const s = m.get(r.user_id) ?? new Set<string>();
    s.add(r.entry_id);
    m.set(r.user_id, s);
  }
  return m;
}

/**
 * 재계산에 쓸 "체크된 entry id 집합" (한 참가자 기준).
 *  = 자동 ⭕(CIRCLE 호명) ∪ 내가 QR로 인증한 entry.
 * 그림마다 호명 방식이 다르므로 두 경로를 합집합한다.
 */
export async function loadCheckedEntryIds(
  boardId: string,
  userId: string
): Promise<Set<string>> {
  const [circle, signed, ownQr] = await Promise.all([
    loadCircleCalledIds(boardId),
    loadSignedEntryIds(boardId, userId),
    loadOwnQrEntryByUser(boardId),
  ]);
  for (const id of signed) circle.add(id);
  // 내 사진이 QR로 호명됐으면 주인인 나는 자동 ⭕.
  const own = ownQr.get(userId);
  if (own) circle.add(own);
  return circle;
}

/**
 * 이미 로드된 셀/현재 finished_at 로 patch 객체만 계산 (쿼리 없음).
 * - cells_filled = 배치된 칸 수 (배열 진행도)
 * - lines_completed = 체크된(배치 ∩ 호명) 칸으로 완성된 줄 수
 */
function computeGridPatch(
  size: BingoSize,
  linesToWin: number,
  checkedIds: Set<string>,
  fixedCells: FixedCell[],
  cells: Array<{ position: number; entry_id: string }>,
  currentFinishedAt: string | null
): Row {
  // 배치된 칸 = 가족 배치 ∪ 기관 고정 타일 (위치 dedup, 고정 우선).
  const placedSet = new Set<number>(cells.map((c) => c.position));
  for (const f of fixedCells) placedSet.add(f.position);
  const filled = placedSet.size;

  // 체크된 칸 = 체크된 그림이 배치된 칸 ∪ 체크된 고정 타일.
  //   일반 모드: checkedIds=호명된 entry / 싸인 모드: 그 참가자가 인증한 entry.
  const checkedSet = new Set<number>(
    cells.filter((c) => checkedIds.has(c.entry_id)).map((c) => c.position)
  );
  for (const f of fixedCells) if (checkedIds.has(f.entryId)) checkedSet.add(f.position);
  const checkedPositions = Array.from(checkedSet);
  const lines = countCompletedLines(size, checkedPositions);

  const reachedGoal = lines >= linesToWin;
  const patch: Row = {
    lines_completed: lines,
    cells_filled: filled,
    cells_checked: checkedPositions.length,
    updated_at: new Date().toISOString(),
  };
  if (reachedGoal && !currentFinishedAt) {
    patch.finished_at = new Date().toISOString();
  } else if (!reachedGoal && currentFinishedAt) {
    // 호명 취소/배열 변경으로 줄이 줄면 완료 무효화 — 공정성.
    patch.finished_at = null;
  }
  return patch;
}

/**
 * 한 grid 의 lines_completed / cells_filled / finished_at 갱신.
 * 단일 grid 경로(참가자 배치/제거/스왑)에서 사용 — 셀 + finished_at 조회.
 * @param checkedIds 체크 기준 entry id 집합 (일반=호명 / 싸인=그 참가자 인증).
 */
export async function recomputeGridStats(
  gridId: string,
  size: BingoSize,
  linesToWin: number,
  checkedIds: Set<string>,
  fixedCells: FixedCell[] = []
): Promise<void> {
  const supabase = await createClient();
  const [cellsResp, gridResp] = await Promise.all([
    (
      supabase.from("org_bingo_grid_cells" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<{
            data: Array<{ position: number; entry_id: string }> | null;
          }>;
        };
      }
    )
      .select("position, entry_id")
      .eq("grid_id", gridId) as Promise<{
      data: Array<{ position: number; entry_id: string }> | null;
    }>,
    (
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
      .maybeSingle() as Promise<{
      data: { finished_at: string | null } | null;
    }>,
  ]);

  const patch = computeGridPatch(
    size,
    linesToWin,
    checkedIds,
    fixedCells,
    cellsResp.data ?? [],
    gridResp.data?.finished_at ?? null
  );

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

/**
 * 보드의 **모든 grid** 재계산. 운영자가 그림을 호명/취소했을 때 사용.
 */
export async function recomputeAllGridsForBoard(
  boardId: string
): Promise<void> {
  const supabase = await createClient();

  const boardResp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { size: BingoSize; lines_to_win: number } | null;
          }>;
        };
      };
    }
  )
    .select("size, lines_to_win")
    .eq("id", boardId)
    .maybeSingle()) as {
    data: { size: BingoSize; lines_to_win: number } | null;
  };
  if (!boardResp.data) return;
  const { size, lines_to_win } = boardResp.data;

  // 자동 ⭕(CIRCLE 호명)는 모든 가족 공통, QR 인증·주인 자동체크는 가족별.
  const [circleCalledIds, signedByUser, ownQrByUser, fixedCells, gridsResp] =
    await Promise.all([
    loadCircleCalledIds(boardId),
    loadSignedEntryIdsByUser(boardId),
    loadOwnQrEntryByUser(boardId),
    loadFixedOrgCells(boardId),
    (
      supabase.from("org_bingo_grids" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<{
            data: Array<{
              id: string;
              user_id: string;
              finished_at: string | null;
            }> | null;
          }>;
        };
      }
    )
      .select("id, user_id, finished_at")
      .eq("board_id", boardId) as Promise<{
      data: Array<{
        id: string;
        user_id: string;
        finished_at: string | null;
      }> | null;
    }>,
  ]);

  const grids = gridsResp.data ?? [];
  if (grids.length === 0) return;

  // 모든 grid 의 셀을 한 번에 로드 (grid 당 셀 select 제거 — N→1).
  const allCellsResp = (await (
    supabase.from("org_bingo_grid_cells" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{
          data: Array<{
            grid_id: string;
            position: number;
            entry_id: string;
          }> | null;
        }>;
      };
    }
  )
    .select("grid_id, position, entry_id")
    .in(
      "grid_id",
      grids.map((g) => g.id)
    )) as {
    data: Array<{ grid_id: string; position: number; entry_id: string }> | null;
  };

  // grid_id → 셀 목록.
  const cellsByGrid = new Map<
    string,
    Array<{ position: number; entry_id: string }>
  >();
  for (const c of allCellsResp.data ?? []) {
    const list = cellsByGrid.get(c.grid_id) ?? [];
    list.push({ position: c.position, entry_id: c.entry_id });
    cellsByGrid.set(c.grid_id, list);
  }

  // grid 마다 in-memory 계산 후 update (조회 없이 update 만 N회).
  await Promise.all(
    grids.map((g) => {
      // 체크 = 자동 ⭕(CIRCLE) ∪ 그 가족이 QR 인증한 entry ∪ 내 QR 사진(주인 자동).
      const signed = signedByUser.get(g.user_id);
      const own = ownQrByUser.get(g.user_id);
      let checkedIds = circleCalledIds;
      if ((signed && signed.size > 0) || own) {
        checkedIds = new Set<string>(circleCalledIds);
        if (signed) for (const id of signed) checkedIds.add(id);
        if (own) checkedIds.add(own);
      }
      const patch = computeGridPatch(
        size,
        lines_to_win,
        checkedIds,
        fixedCells,
        cellsByGrid.get(g.id) ?? [],
        g.finished_at
      );
      return (
        supabase.from("org_bingo_grids" as never) as unknown as {
          update: (p: Row) => {
            eq: (k: string, v: string) => Promise<{ error: SbErr }>;
          };
        }
      )
        .update(patch)
        .eq("id", g.id);
    })
  );
}
