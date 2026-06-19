import { createClient } from "@/lib/supabase/server";
import type {
  BingoBoardRow,
  BingoEntryRow,
  BingoGridCellRow,
  BingoGridRow,
  BingoRankingRow,
} from "./types";

type SbErr = { code?: string; message?: string } | null;

/* -------------------------------------------------------------------------- */
/* 보드                                                                       */
/* -------------------------------------------------------------------------- */

export async function loadBoardsByOrg(
  orgId: string
): Promise<BingoBoardRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: BingoBoardRow[] | null; error: SbErr }>;
        };
      };
    }
  )
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })) as {
    data: BingoBoardRow[] | null;
    error: SbErr;
  };
  if (resp.error) {
    console.error("[bingo/loadBoardsByOrg]", resp.error);
    return [];
  }
  return resp.data ?? [];
}

export async function loadBoardById(
  boardId: string
): Promise<BingoBoardRow | null> {
  if (!boardId) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: BingoBoardRow | null;
            error: SbErr;
          }>;
        };
      };
    }
  )
    .select("*")
    .eq("id", boardId)
    .maybeSingle()) as {
    data: BingoBoardRow | null;
    error: SbErr;
  };
  if (resp.error) {
    console.error("[bingo/loadBoardById]", resp.error);
    return null;
  }
  return resp.data;
}

/** 참가자 홈에서 노출할 라이브 보드. 같은 기관 + LIVE 상태만. */
export async function loadLiveBoardsForOrg(
  orgId: string
): Promise<BingoBoardRow[]> {
  if (!orgId) return [];
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_boards" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<{ data: BingoBoardRow[] | null; error: SbErr }>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "LIVE")
    .order("created_at", { ascending: false })) as {
    data: BingoBoardRow[] | null;
    error: SbErr;
  };
  if (resp.error) {
    console.error("[bingo/loadLiveBoardsForOrg]", resp.error);
    return [];
  }
  return resp.data ?? [];
}

/* -------------------------------------------------------------------------- */
/* Entries (피드)                                                              */
/* -------------------------------------------------------------------------- */

export interface BingoEntryWithUser extends BingoEntryRow {
  parent_name: string;
  child_name: string | null;
}

export async function loadEntriesForBoard(
  boardId: string
): Promise<BingoEntryWithUser[]> {
  if (!boardId) return [];
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: BingoEntryRow[] | null; error: SbErr }>;
        };
      };
    }
  )
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })) as {
    data: BingoEntryRow[] | null;
    error: SbErr;
  };
  if (resp.error) {
    console.error("[bingo/loadEntriesForBoard]", resp.error);
    return [];
  }
  const entries = resp.data ?? [];
  if (entries.length === 0) return [];

  // 보호자명 + 대표 자녀명 조회.
  const userIds = Array.from(new Set(entries.map((e) => e.user_id)));
  const usersResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{
          data: Array<{ id: string; parent_name: string | null }> | null;
        }>;
      };
    }
  )
    .select("id, parent_name")
    .in("id", userIds)) as {
    data: Array<{ id: string; parent_name: string | null }> | null;
  };
  const parentMap = new Map<string, string>();
  for (const u of usersResp.data ?? []) {
    parentMap.set(u.id, u.parent_name ?? "");
  }

  const childResp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{
            data: Array<{ user_id: string; name: string }> | null;
          }>;
        };
      };
    }
  )
    .select("user_id, name")
    .in("user_id", userIds)
    .order("created_at", { ascending: true })) as {
    data: Array<{ user_id: string; name: string }> | null;
  };
  const childMap = new Map<string, string>();
  for (const c of childResp.data ?? []) {
    if (!childMap.has(c.user_id) && c.name?.trim()) {
      childMap.set(c.user_id, c.name.trim());
    }
  }

  return entries.map((e) => ({
    ...e,
    parent_name: parentMap.get(e.user_id) ?? "",
    child_name: childMap.get(e.user_id) ?? null,
  }));
}

export async function loadEntryByUser(
  boardId: string,
  userId: string
): Promise<BingoEntryRow | null> {
  if (!boardId || !userId) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_entries" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: BingoEntryRow | null;
              error: SbErr;
            }>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle()) as {
    data: BingoEntryRow | null;
    error: SbErr;
  };
  if (resp.error) {
    console.error("[bingo/loadEntryByUser]", resp.error);
    return null;
  }
  return resp.data;
}

/* -------------------------------------------------------------------------- */
/* Grid + cells                                                               */
/* -------------------------------------------------------------------------- */

export async function loadGridForUser(
  boardId: string,
  userId: string
): Promise<{
  grid: BingoGridRow | null;
  cells: BingoGridCellRow[];
}> {
  if (!boardId || !userId) return { grid: null, cells: [] };
  const supabase = await createClient();
  const gridResp = (await (
    supabase.from("org_bingo_grids" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: BingoGridRow | null;
              error: SbErr;
            }>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle()) as {
    data: BingoGridRow | null;
    error: SbErr;
  };
  if (gridResp.error) {
    console.error("[bingo/loadGridForUser] grid", gridResp.error);
    return { grid: null, cells: [] };
  }
  const grid = gridResp.data;
  if (!grid) return { grid: null, cells: [] };

  const cellsResp = (await (
    supabase.from("org_bingo_grid_cells" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: BingoGridCellRow[] | null; error: SbErr }>;
        };
      };
    }
  )
    .select("*")
    .eq("grid_id", grid.id)
    .order("position", { ascending: true })) as {
    data: BingoGridCellRow[] | null;
    error: SbErr;
  };
  if (cellsResp.error) {
    console.error("[bingo/loadGridForUser] cells", cellsResp.error);
    return { grid, cells: [] };
  }
  return { grid, cells: cellsResp.data ?? [] };
}

/* -------------------------------------------------------------------------- */
/* Leaderboard                                                                */
/* -------------------------------------------------------------------------- */

export interface LeaderboardRow {
  user_id: string;
  parent_name: string;
  child_name: string | null;
  lines_completed: number;
  cells_filled: number;
  finished_at: string | null;
}

export async function loadLeaderboard(
  boardId: string,
  limit = 50
): Promise<LeaderboardRow[]> {
  if (!boardId) return [];
  const supabase = await createClient();
  const gridsResp = (await (
    supabase.from("org_bingo_grids" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => {
            order: (
              c: string,
              o: { ascending: boolean; nullsFirst: boolean }
            ) => {
              limit: (n: number) => Promise<{
                data: BingoGridRow[] | null;
                error: SbErr;
              }>;
            };
          };
        };
      };
    }
  )
    .select("*")
    .eq("board_id", boardId)
    .order("lines_completed", { ascending: false })
    .order("finished_at", { ascending: true, nullsFirst: false })
    .limit(limit)) as {
    data: BingoGridRow[] | null;
    error: SbErr;
  };
  if (gridsResp.error) {
    console.error("[bingo/loadLeaderboard]", gridsResp.error);
    return [];
  }
  const grids = gridsResp.data ?? [];
  if (grids.length === 0) return [];

  const userIds = grids.map((g) => g.user_id);
  const usersResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{
          data: Array<{ id: string; parent_name: string | null }> | null;
        }>;
      };
    }
  )
    .select("id, parent_name")
    .in("id", userIds)) as {
    data: Array<{ id: string; parent_name: string | null }> | null;
  };
  const parentMap = new Map<string, string>();
  for (const u of usersResp.data ?? []) parentMap.set(u.id, u.parent_name ?? "");

  const childResp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{
            data: Array<{ user_id: string; name: string }> | null;
          }>;
        };
      };
    }
  )
    .select("user_id, name")
    .in("user_id", userIds)
    .order("created_at", { ascending: true })) as {
    data: Array<{ user_id: string; name: string }> | null;
  };
  const childMap = new Map<string, string>();
  for (const c of childResp.data ?? []) {
    if (!childMap.has(c.user_id) && c.name?.trim()) {
      childMap.set(c.user_id, c.name.trim());
    }
  }

  return grids.map((g) => ({
    user_id: g.user_id,
    parent_name: parentMap.get(g.user_id) ?? "",
    child_name: childMap.get(g.user_id) ?? null,
    lines_completed: g.lines_completed,
    cells_filled: g.cells_filled,
    finished_at: g.finished_at,
  }));
}

export async function loadRankingsForBoard(
  boardId: string
): Promise<BingoRankingRow[]> {
  if (!boardId) return [];
  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_bingo_rankings" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: BingoRankingRow[] | null; error: SbErr }>;
        };
      };
    }
  )
    .select("*")
    .eq("board_id", boardId)
    .order("rank", { ascending: true })) as {
    data: BingoRankingRow[] | null;
    error: SbErr;
  };
  if (resp.error) {
    console.error("[bingo/loadRankings]", resp.error);
    return [];
  }
  return resp.data ?? [];
}
