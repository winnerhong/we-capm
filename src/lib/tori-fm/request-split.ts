// 한 세션의 신청곡 목록을 화면이 쓰는 모양으로 나누는 **순수** 함수들.
//
// 왜 있나:
//   토리FM 스튜디오(관제실)와 참가자 라디오 화면은 같은 세션의 tori_fm_requests
//   를 네 번 읽고 있었다 — PENDING, QUEUED, PLAYING, 그리고 "숨김 아닌 전부".
//   그런데 앞의 셋은 마지막 하나의 **부분집합**이다. 정렬이 다를 뿐이다.
//   한 번 읽어 와서 여기서 나누면 왕복이 넷에서 하나로 준다.
//
// 순수하게 둔 이유는 정렬이 조용히 틀릴 수 있는 종류의 코드이기 때문이다.
// PostgREST 의 order 를 JS 로 옮기는 일이라, 테스트로 못 박아 둔다.

import type { FmRequestRow } from "./types";

/** created_at 내림차순. 같은 시각이면 id 로 갈라 순서를 고정한다. */
function newestFirst(rows: FmRequestRow[]): FmRequestRow[] {
  return [...rows].sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)
  );
}

/** created_at 오름차순 — 먼저 신청한 사연이 위로. */
function oldestFirst(rows: FmRequestRow[]): FmRequestRow[] {
  return [...rows].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
  );
}

/** DJ 승인 대기 — created_at DESC. */
export function pickPending(rows: FmRequestRow[]): FmRequestRow[] {
  return newestFirst(rows.filter((r) => r.status === "PENDING"));
}

/**
 * 방송 대기 큐 — queue_position ASC.
 *
 * PostgREST 쪽은 `nullsFirst: false` 였다. queue_position 이 비어 있는 줄은
 * 순서를 못 정한 줄이므로 맨 뒤로 보낸다.
 */
export function pickQueued(rows: FmRequestRow[]): FmRequestRow[] {
  return [...rows]
    .filter((r) => r.status === "QUEUED")
    .sort((a, b) => {
      const ap = a.queue_position;
      const bp = b.queue_position;
      if (ap === null && bp === null) return a.id.localeCompare(b.id);
      if (ap === null) return 1;
      if (bp === null) return -1;
      return ap - bp || a.id.localeCompare(b.id);
    });
}

/** 지금 나가는 곡 묶음 — 같은 곡에 사연이 여럿일 수 있다. created_at ASC. */
export function pickPlaying(rows: FmRequestRow[]): FmRequestRow[] {
  return oldestFirst(rows.filter((r) => r.status === "PLAYING"));
}

/** 숨김 아닌 전부 — created_at DESC. */
export function pickOpen(rows: FmRequestRow[]): FmRequestRow[] {
  return newestFirst(rows.filter((r) => r.status !== "HIDDEN"));
}

/**
 * 인기 신청곡 — popularity = heart_count + boost_amount 내림차순.
 * 방송이 끝난 곡(PLAYED)과 지금 나가는 곡은 빼고, 0점짜리도 뺀다.
 */
export function pickTopHearted(
  rows: FmRequestRow[],
  limit = 5
): FmRequestRow[] {
  const popularity = (r: FmRequestRow) =>
    (r.heart_count ?? 0) + (r.boost_amount ?? 0);
  return rows
    .filter(
      (r) =>
        (r.status === "PENDING" ||
          r.status === "APPROVED" ||
          r.status === "QUEUED") &&
        popularity(r) > 0
    )
    .sort((a, b) => popularity(b) - popularity(a) || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, Math.min(limit, 20)));
}
