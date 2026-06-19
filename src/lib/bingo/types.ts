// 토리 빙고 공용 타입.

export type BingoStatus = "DRAFT" | "LIVE" | "ENDED";
export type BingoSize = 3 | 4 | 5 | 6;
export type BingoLines = 1 | 2 | 3;

export interface BingoBoardRow {
  id: string;
  org_id: string;
  event_id: string | null;
  name: string;
  size: BingoSize;
  lines_to_win: BingoLines;
  keyword_theme: string | null;
  status: BingoStatus;
  show_ranking: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BingoEntryRow {
  id: string;
  board_id: string;
  user_id: string;
  photo_url: string;
  keyword: string;
  created_at: string;
}

export interface BingoGridRow {
  id: string;
  board_id: string;
  user_id: string;
  lines_completed: number;
  cells_filled: number;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BingoGridCellRow {
  grid_id: string;
  position: number;
  entry_id: string;
  placed_at: string;
}

export interface BingoRankingRow {
  board_id: string;
  rank: number;
  user_id: string;
  prize: string | null;
  set_at: string;
}

export const BINGO_SIZES: BingoSize[] = [3, 4, 5, 6];
export const BINGO_LINE_OPTIONS: BingoLines[] = [1, 2, 3];

export const BINGO_STATUS_META: Record<
  BingoStatus,
  { label: string; chip: string }
> = {
  DRAFT: { label: "초안", chip: "bg-zinc-100 text-zinc-700 ring-zinc-200" },
  LIVE: { label: "진행중", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  ENDED: { label: "종료", chip: "bg-sky-50 text-sky-700 ring-sky-200" },
};

export function isBingoSize(n: unknown): n is BingoSize {
  return n === 3 || n === 4 || n === 5 || n === 6;
}

export function isBingoLines(n: unknown): n is BingoLines {
  return n === 1 || n === 2 || n === 3;
}
