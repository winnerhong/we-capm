// 빙고 라인 카운팅 — 순수 함수.
// 행 + 열 + 두 대각선 중 모든 칸이 채워진 라인의 개수.
// position = row * size + col (0-indexed).

import type { BingoSize } from "./types";

/**
 * filled 셋의 position 들로 완성된 라인 수.
 * size=3 → 최대 8 (행3 + 열3 + 대각2)
 * size=4 → 최대 10
 * size=5 → 최대 12
 * size=6 → 최대 14
 */
export function countCompletedLines(
  size: BingoSize,
  filledPositions: Iterable<number>
): number {
  const filled = new Set<number>(filledPositions);
  let count = 0;

  // rows
  for (let r = 0; r < size; r++) {
    let all = true;
    for (let c = 0; c < size; c++) {
      if (!filled.has(r * size + c)) {
        all = false;
        break;
      }
    }
    if (all) count++;
  }

  // cols
  for (let c = 0; c < size; c++) {
    let all = true;
    for (let r = 0; r < size; r++) {
      if (!filled.has(r * size + c)) {
        all = false;
        break;
      }
    }
    if (all) count++;
  }

  // main diagonal (top-left → bottom-right)
  {
    let all = true;
    for (let i = 0; i < size; i++) {
      if (!filled.has(i * size + i)) {
        all = false;
        break;
      }
    }
    if (all) count++;
  }

  // anti diagonal (top-right → bottom-left)
  {
    let all = true;
    for (let i = 0; i < size; i++) {
      if (!filled.has(i * size + (size - 1 - i))) {
        all = false;
        break;
      }
    }
    if (all) count++;
  }

  return count;
}

/**
 * 각 라인이 완성됐는지 여부 — UI 강조용.
 * 반환: { rows: boolean[], cols: boolean[], diag: boolean, antiDiag: boolean }
 */
export function computeLineFlags(
  size: BingoSize,
  filledPositions: Iterable<number>
): {
  rows: boolean[];
  cols: boolean[];
  diag: boolean;
  antiDiag: boolean;
} {
  const filled = new Set<number>(filledPositions);
  const rows: boolean[] = [];
  const cols: boolean[] = [];

  for (let r = 0; r < size; r++) {
    let all = true;
    for (let c = 0; c < size; c++) {
      if (!filled.has(r * size + c)) {
        all = false;
        break;
      }
    }
    rows.push(all);
  }

  for (let c = 0; c < size; c++) {
    let all = true;
    for (let r = 0; r < size; r++) {
      if (!filled.has(r * size + c)) {
        all = false;
        break;
      }
    }
    cols.push(all);
  }

  let diag = true;
  for (let i = 0; i < size; i++) {
    if (!filled.has(i * size + i)) {
      diag = false;
      break;
    }
  }

  let antiDiag = true;
  for (let i = 0; i < size; i++) {
    if (!filled.has(i * size + (size - 1 - i))) {
      antiDiag = false;
      break;
    }
  }

  return { rows, cols, diag, antiDiag };
}
