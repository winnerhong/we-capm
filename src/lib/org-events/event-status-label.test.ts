import { describe, expect, it } from "vitest";
import { describeEventStatus } from "./event-status-label";
import { pickRepresentativeEvent } from "./event-access";

const MARATHON = "2026-09-12T09:40:00+09:00";
const WALK_START = "2026-08-11T14:00:00+09:00";
const TRACK_START = "2026-05-16T09:50:00+09:00";
const TRACK_END = "2026-05-16T13:00:00+09:00";
const NOW = "2026-08-30T12:00:00+09:00";

describe("상태가 스스로 날짜를 들고 다닌다", () => {
  it("예정은 언제 열리는지 말한다", () => {
    const r = describeEventStatus({ status: "DRAFT", startsAt: MARATHON });
    expect(r.label).toBe("9/12(토) 예정");
    expect(r.emoji).toBe("📝");
  });

  it("종료는 언제 끝났는지 말한다", () => {
    const r = describeEventStatus({
      status: "ENDED",
      startsAt: TRACK_START,
      endsAt: TRACK_END,
    });
    expect(r.label).toBe("5/16(토) 종료");
  });

  it("끝난 날이 없으면 시작한 날이라도 적는다 — 하루짜리 행사가 대부분이다", () => {
    const r = describeEventStatus({
      status: "ENDED",
      startsAt: TRACK_START,
      endsAt: null,
    });
    expect(r.label).toBe("5/16(토) 종료");
  });

  it("진행·보관은 시점이 아니라 상태라 날짜를 안 붙인다", () => {
    expect(describeEventStatus({ status: "LIVE", startsAt: MARATHON }).label).toBe(
      "진행중"
    );
    expect(
      describeEventStatus({ status: "ARCHIVED", startsAt: MARATHON }).label
    ).toBe("보관중");
  });

  it("날짜가 없으면 짧은 말로 떨어진다 — 화면이 비지 않게", () => {
    expect(describeEventStatus({ status: "DRAFT" }).label).toBe("예정");
    expect(describeEventStatus({ status: "ENDED" }).label).toBe("종료");
  });

  it("날짜가 깨져 있어도 터지지 않는다", () => {
    expect(
      describeEventStatus({ status: "DRAFT", startsAt: "not-a-date" }).label
    ).toBe("예정");
  });

  it("좁은 칸에는 날짜 없는 짧은 말을 쓴다", () => {
    const r = describeEventStatus({ status: "DRAFT", startsAt: MARATHON });
    expect(r.short).toBe("예정");
  });

  it("모르는 상태값은 예정으로 떨어진다", () => {
    expect(describeEventStatus({ status: "WAT" }).tone).toBe("draft");
    expect(describeEventStatus({ status: null }).tone).toBe("draft");
  });
});

describe("기관을 대표하는 행사 하나 고르기", () => {
  const ev = (status: string, starts: string | null, ends?: string | null) => ({
    status,
    starts_at: starts,
    ends_at: ends ?? null,
  });

  it("진행 중인 행사가 있으면 그게 먼저다", () => {
    const pick = pickRepresentativeEvent(
      [ev("ENDED", TRACK_START, TRACK_END), ev("LIVE", NOW), ev("DRAFT", MARATHON)],
      NOW
    );
    expect(pick?.status).toBe("LIVE");
  });

  it("진행 중이 없으면 가장 임박한 예정", () => {
    const pick = pickRepresentativeEvent(
      [
        ev("DRAFT", "2026-12-25T10:00:00+09:00"),
        ev("DRAFT", MARATHON),
        ev("ENDED", TRACK_START, TRACK_END),
      ],
      NOW
    );
    expect(pick?.starts_at).toBe(MARATHON);
  });

  it("앞으로 올 일이 없으면 가장 최근에 끝난 행사", () => {
    const pick = pickRepresentativeEvent(
      [
        ev("ENDED", TRACK_START, TRACK_END),
        ev("ENDED", "2025-05-16T09:00:00+09:00"),
      ],
      NOW
    );
    expect(pick?.starts_at).toBe(TRACK_START);
  });

  it("날짜가 지난 LIVE 는 진짜 진행 중보다 뒤로 간다", () => {
    const pick = pickRepresentativeEvent(
      [ev("LIVE", WALK_START), ev("LIVE", NOW)],
      NOW
    );
    expect(pick?.starts_at).toBe(NOW);
  });

  it("보관된 행사는 맨 뒤 — 다른 게 있으면 그쪽을 고른다", () => {
    const pick = pickRepresentativeEvent(
      [ev("ARCHIVED", MARATHON), ev("ENDED", TRACK_START, TRACK_END)],
      NOW
    );
    expect(pick?.status).toBe("ENDED");
  });

  it("행사가 없으면 null — 호출부가 그 자리를 통째로 비운다", () => {
    expect(pickRepresentativeEvent([], NOW)).toBeNull();
  });

  it("참가자 홈 정렬과 같은 규칙이다 (맨 앞이 대표)", () => {
    const list = [
      ev("ENDED", TRACK_START, TRACK_END),
      ev("LIVE", WALK_START),
      ev("LIVE", NOW),
    ];
    const pick = pickRepresentativeEvent(list, NOW);
    expect(pick?.starts_at).toBe(NOW);
  });
});
