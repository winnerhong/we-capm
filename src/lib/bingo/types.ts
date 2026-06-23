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
  /** 배열 마감 시각. null=미세팅, 미래=진행중 카운트다운, 과거=종료(잠금). */
  arrange_ends_at: string | null;
  /** 📷 QR 모드. true면 호명한 그림 QR을 참가자가 찍어야 ⭕ (자동 호명 대신). */
  signature_mode: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BingoEntryRow {
  id: string;
  board_id: string;
  /** 가족 entry 면 소유자. 기관 문구 타일(is_org)이면 null. */
  user_id: string | null;
  /** 기관 문구 타일이면 빈 문자열 — keyword 가 문구. */
  photo_url: string;
  keyword: string;
  /** 운영자가 만든 문구 타일 여부. */
  is_org: boolean;
  /** 기관 타일 고정 칸(0-base). null=미배치. 값이면 모든 가족 판 그 칸에 자동 노출. */
  fixed_position: number | null;
  /** 운영자 호명 시각. null=미호명. */
  called_at: string | null;
  /** 호명 방식. CIRCLE=자동 ⭕, QR=참가자가 QR 찍어야 ⭕. called_at 있을 때만 의미. */
  call_mode: "CIRCLE" | "QR";
  /** 싸인 모드용 가족별 고유 4자리 인증번호. 기관 타일은 null. (현재 미사용) */
  signature_code: string | null;
  created_at: string;
}

export interface BingoGridRow {
  id: string;
  board_id: string;
  user_id: string;
  lines_completed: number;
  cells_filled: number;
  /** 배치 ∩ 호명된 칸 수 (화면의 ⭕ 개수). 순위 2차 기준. */
  cells_checked: number;
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

export type BingoTemplateScope = "GLOBAL" | "ORG";

export interface BingoTemplateRow {
  id: string;
  scope: BingoTemplateScope;
  /** scope=ORG 일 때만 채워짐. */
  org_id: string | null;
  name: string;
  description: string | null;
  size: BingoSize;
  created_at: string;
  updated_at: string;
}

export interface BingoTemplateTileRow {
  id: string;
  template_id: string;
  keyword: string;
  /** 템플릿 내 고정 칸(0-base). null=미배치. */
  fixed_position: number | null;
  created_at: string;
}

export interface BingoTemplateWithTiles extends BingoTemplateRow {
  tiles: BingoTemplateTileRow[];
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
