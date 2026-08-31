import { describe, expect, it } from "vitest";
import {
  pickOpen,
  pickPending,
  pickPlaying,
  pickQueued,
  pickTopHearted,
} from "./request-split";
import type { FmRequestRow, RequestStatus } from "./types";

function req(
  id: string,
  status: RequestStatus,
  createdAt: string,
  extra: Partial<FmRequestRow> = {}
): FmRequestRow {
  return {
    id,
    session_id: "s1",
    user_id: "u1",
    song_title: "곡",
    artist: null,
    story: null,
    child_name: null,
    song_normalized: "곡",
    heart_count: 0,
    status,
    queue_id: null,
    queue_position: null,
    kind: "SONG",
    is_anonymous: false,
    boost_amount: 0,
    last_boost_at: null,
    created_at: createdAt,
    ...extra,
  } as FmRequestRow;
}

const ROWS: FmRequestRow[] = [
  req("a", "PENDING", "2026-08-31T01:00:00Z"),
  req("b", "PENDING", "2026-08-31T03:00:00Z"),
  req("c", "QUEUED", "2026-08-31T02:00:00Z", { queue_position: 2 }),
  req("d", "QUEUED", "2026-08-31T02:30:00Z", { queue_position: 1 }),
  req("e", "QUEUED", "2026-08-31T02:40:00Z", { queue_position: null }),
  req("f", "PLAYING", "2026-08-31T04:00:00Z"),
  req("g", "PLAYING", "2026-08-31T03:30:00Z"),
  req("h", "HIDDEN", "2026-08-31T05:00:00Z"),
  req("i", "PLAYED", "2026-08-31T00:30:00Z", { heart_count: 99 }),
  req("j", "APPROVED", "2026-08-31T00:40:00Z", {
    heart_count: 3,
    boost_amount: 4,
  }),
];

describe("pickPending", () => {
  it("PENDING 만, 최신이 위", () => {
    expect(pickPending(ROWS).map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("pickQueued", () => {
  it("queue_position 오름차순", () => {
    expect(pickQueued(ROWS).map((r) => r.id)).toEqual(["d", "c", "e"]);
  });

  it("순서를 못 정한 줄(null)은 맨 뒤", () => {
    const only = [
      req("x", "QUEUED", "2026-01-01T00:00:00Z", { queue_position: null }),
      req("y", "QUEUED", "2026-01-01T00:00:00Z", { queue_position: 9 }),
    ];
    expect(pickQueued(only).map((r) => r.id)).toEqual(["y", "x"]);
  });
});

describe("pickPlaying", () => {
  it("먼저 신청한 사연이 위", () => {
    expect(pickPlaying(ROWS).map((r) => r.id)).toEqual(["g", "f"]);
  });
});

describe("pickOpen", () => {
  it("숨김만 빠지고 나머지 전부, 최신이 위", () => {
    const ids = pickOpen(ROWS).map((r) => r.id);
    expect(ids).not.toContain("h");
    expect(ids).toHaveLength(ROWS.length - 1);
    expect(ids[0]).toBe("f"); // 04:00 이 가장 최신
  });
});

describe("pickTopHearted", () => {
  it("하트+부스트 합이 큰 순, 0점과 방송끝난 곡은 뺀다", () => {
    // i 는 하트 99 지만 PLAYED 라 빠진다. j 는 3+4=7.
    expect(pickTopHearted(ROWS).map((r) => r.id)).toEqual(["j"]);
  });

  it("limit 은 1~20 사이로 잡힌다", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      req(String(i).padStart(2, "0"), "QUEUED", "2026-01-01T00:00:00Z", {
        heart_count: 30 - i,
      })
    );
    expect(pickTopHearted(many, 999)).toHaveLength(20);
    expect(pickTopHearted(many, 0)).toHaveLength(1);
  });
});

describe("입력을 건드리지 않는다", () => {
  it("원본 배열 순서가 그대로", () => {
    const before = ROWS.map((r) => r.id);
    pickPending(ROWS);
    pickQueued(ROWS);
    pickPlaying(ROWS);
    pickOpen(ROWS);
    pickTopHearted(ROWS);
    expect(ROWS.map((r) => r.id)).toEqual(before);
  });
});
