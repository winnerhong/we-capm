import { describe, expect, it } from "vitest";
import { PHASE_ORDER, resolveEventAccess } from "./event-access";

// 스샷의 실제 두 행사를 그대로 쓴다.
const MARATHON = "2026-09-12T09:40:00+09:00"; // D-13 (예정)
const WALK = "2026-08-11T14:00:00+09:00"; // D+19 (지난)
const NOW = "2026-08-30T12:00:00+09:00";

const at = (o: {
  status?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  now?: string;
}) =>
  resolveEventAccess({
    status: o.status ?? "LIVE",
    startsAt: o.startsAt === undefined ? MARATHON : o.startsAt,
    endsAt: o.endsAt ?? null,
    now: o.now ?? NOW,
  });

describe("① 회색 = 날짜가 지났다 (자동)", () => {
  it("19일 전에 끝난 행사는 LIVE 여도 회색 '지난 행사' 다 — 아무도 종료를 안 눌러도", () => {
    const a = at({ status: "LIVE", startsAt: WALK });
    expect(a.phase).toBe("past");
    expect(a.dimmed).toBe(true);
    expect(a.badgeLabel).toBe("지난 행사");
    expect(a.ddayLabel).toBe("D+19");
  });

  it("지났어도 기관이 종료를 안 눌렀으면 들어가고 활동도 된다 — 잠금은 기관의 몫", () => {
    const a = at({ status: "LIVE", startsAt: WALK });
    expect(a.canEnter).toBe(true);
    expect(a.canPlay).toBe(true);
  });

  it("아직 안 온 행사는 초록이 아니라 예정이다", () => {
    const a = at({ status: "DRAFT", startsAt: MARATHON });
    expect(a.phase).toBe("upcoming");
    expect(a.ddayLabel).toBe("D-13");
  });
});

describe("'지났다' 의 기준은 시각이 아니라 날짜다", () => {
  it("오전에 시작한 행사는 그날 점심에 회색이 되지 않는다", () => {
    const a = at({
      status: "LIVE",
      startsAt: "2026-08-30T09:40:00+09:00",
      now: "2026-08-30T13:00:00+09:00",
    });
    expect(a.phase).toBe("live");
    expect(a.ddayLabel).toBe("D-DAY");
  });

  it("자정을 넘겨 다음 날이 되면 그때 지난 행사가 된다", () => {
    const a = at({
      status: "LIVE",
      startsAt: "2026-08-30T09:40:00+09:00",
      now: "2026-08-31T00:10:00+09:00",
    });
    expect(a.phase).toBe("past");
  });

  it("여러 날 행사는 끝나는 날을 기준으로 센다", () => {
    const a = at({
      status: "LIVE",
      startsAt: "2026-08-25T09:00:00+09:00",
      endsAt: "2026-09-05T18:00:00+09:00",
    });
    expect(a.phase).toBe("live");
  });

  it("서버가 UTC 여도 한국 날짜로 판단한다 — 한국 새벽 1시는 아직 그날이다", () => {
    // UTC 로는 아직 08-30 16:00 이지만 KST 로는 08-31 01:00.
    const a = at({
      status: "LIVE",
      startsAt: "2026-08-31T10:00:00+09:00",
      now: "2026-08-30T16:00:00Z",
    });
    expect(a.phase).toBe("live");
    expect(a.ddayLabel).toBe("D-DAY");
  });

  it("날짜가 하나도 없으면 저절로 지나지 않는다 — 기관이 종료해야 닫힌다", () => {
    const a = at({ status: "LIVE", startsAt: null });
    expect(a.phase).toBe("live");
    expect(a.dday).toBeNull();
    expect(a.ddayLabel).toBeNull();
  });

  it("날짜가 깨져 있어도 터지지 않는다", () => {
    const a = at({ status: "LIVE", startsAt: "not-a-date" });
    expect(a.phase).toBe("live");
    expect(a.dday).toBeNull();
  });
});

describe("② 잠금 = 기관이 종료를 눌렀다 (수동)", () => {
  it("종료하면 활동은 잠기지만 문은 열려 있다 — 사진·설문을 봐야 하니까", () => {
    const a = at({ status: "ENDED", startsAt: WALK });
    expect(a.phase).toBe("closed");
    expect(a.canEnter).toBe(true);
    expect(a.canPlay).toBe(false);
    expect(a.canJoin).toBe(false);
    expect(a.notice).toContain("사진");
  });

  it("종료는 날짜와 무관하다 — 오늘 행사도 종료를 누르면 그 순간 잠긴다", () => {
    const a = at({
      status: "ENDED",
      startsAt: "2026-08-30T09:00:00+09:00",
    });
    expect(a.phase).toBe("closed");
    expect(a.canPlay).toBe(false);
  });

  it("보관은 완전히 닫는다 — 문도 안 열린다", () => {
    const a = at({ status: "ARCHIVED", startsAt: WALK });
    expect(a.phase).toBe("archived");
    expect(a.canEnter).toBe(false);
    expect(a.canPlay).toBe(false);
  });
});

describe("예정(DRAFT)", () => {
  it("초대장·일정은 보되 활동은 아직 없다", () => {
    const a = at({ status: "DRAFT" });
    expect(a.canEnter).toBe(true);
    expect(a.canPlay).toBe(false);
    // 초대장은 행사 전에 돌린다 — 그때 못 들어오면 초대장이 무용지물이다.
    expect(a.canJoin).toBe(true);
    expect(a.dimmed).toBe(false);
  });

  it("예정인 채로 날짜가 지나면 지난 행사로 내려앉는다", () => {
    const a = at({ status: "DRAFT", startsAt: WALK });
    expect(a.phase).toBe("past");
  });

  it("모르는 상태값은 예정으로 떨어진다 (컬럼 미적용·오타 방어)", () => {
    expect(at({ status: "WAT" }).phase).toBe("upcoming");
    expect(at({ status: "" }).phase).toBe("upcoming");
  });
});

describe("참가 접수", () => {
  it("끝나기 전까지는 언제든 들어올 수 있다 — 예정·진행중·지난 행사 모두", () => {
    expect(at({ status: "DRAFT" }).canJoin).toBe(true);
    expect(at({ status: "LIVE" }).canJoin).toBe(true);
    expect(at({ status: "LIVE", startsAt: WALK }).canJoin).toBe(true);
  });

  it("기관이 종료·보관하면 새로 들어올 수 없다", () => {
    expect(at({ status: "ENDED" }).canJoin).toBe(false);
    expect(at({ status: "ARCHIVED" }).canJoin).toBe(false);
  });
});

describe("목록 정렬", () => {
  it("열린 것 → 예정 → 지난 → 종료 → 보관 순으로 내려간다", () => {
    expect(PHASE_ORDER.live).toBeLessThan(PHASE_ORDER.upcoming);
    expect(PHASE_ORDER.upcoming).toBeLessThan(PHASE_ORDER.past);
    expect(PHASE_ORDER.past).toBeLessThan(PHASE_ORDER.closed);
    expect(PHASE_ORDER.closed).toBeLessThan(PHASE_ORDER.archived);
  });
});

describe("문구는 한 곳에서만 나온다", () => {
  it("들어갈 수 있으면 잠금 안내가 없다 — 그 자리를 통째로 비우려고 null", () => {
    expect(at({ status: "LIVE" }).notice).toBeNull();
    expect(at({ status: "LIVE", startsAt: WALK }).notice).toBeNull();
  });

  it("잠긴 상태는 반드시 이유 한 줄을 들고 온다", () => {
    for (const s of ["ENDED", "ARCHIVED", "DRAFT"]) {
      expect(at({ status: s }).notice).toBeTruthy();
    }
  });
});
