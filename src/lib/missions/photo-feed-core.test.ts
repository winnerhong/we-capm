import { describe, expect, it } from "vitest";
import {
  describeAutoShare,
  formatFamilyName,
  formatFeedMeta,
  formatRelativeTime,
  resolveLikeGate,
  resolveLikeGrant,
  resolvePhotoVisibility,
} from "./photo-feed-core";

const NOW = Date.parse("2026-09-12T12:00:00+09:00");

describe("resolvePhotoVisibility", () => {
  const ok = { feedEnabled: true, status: "AUTO_APPROVED" };

  it("기관이 켰고 확인이 끝났으면 보인다", () => {
    expect(resolvePhotoVisibility(ok)).toEqual({ visible: true });
  });

  it("관리자 승인 사진도 보인다", () => {
    expect(
      resolvePhotoVisibility({ ...ok, status: "APPROVED" }).visible
    ).toBe(true);
  });

  it("기관 스위치가 꺼져 있으면 확인된 사진도 안 보인다", () => {
    const r = resolvePhotoVisibility({ ...ok, feedEnabled: false });
    expect(r.visible).toBe(false);
    if (!r.visible) expect(r.reason).toContain("기관");
  });

  it("검토 중인 사진은 절대 오르지 않는다 — 기관이 먼저 봐야 한다", () => {
    for (const status of ["SUBMITTED", "PENDING_REVIEW"]) {
      expect(resolvePhotoVisibility({ ...ok, status }).visible).toBe(false);
    }
  });

  it("반려·회수된 사진도 오르지 않는다", () => {
    for (const status of ["REJECTED", "REVOKED"]) {
      expect(resolvePhotoVisibility({ ...ok, status }).visible).toBe(false);
    }
  });

  it("모르는 상태값은 막는다 (기본은 비공개)", () => {
    expect(
      resolvePhotoVisibility({ ...ok, status: "WHATEVER" }).visible
    ).toBe(false);
  });
});

describe("describeAutoShare", () => {
  it("기관이 안 켰으면 아무 줄도 띄우지 않는다", () => {
    expect(
      describeAutoShare({ feedEnabled: false, status: "AUTO_APPROVED" })
    ).toBeNull();
  });

  it("확인이 끝났으면 이미 보이고 있다고 알린다", () => {
    const n = describeAutoShare({ feedEnabled: true, status: "APPROVED" });
    expect(n?.state).toBe("live");
    expect(n?.text).toContain("볼 수 있어요");
  });

  it("검토 중이면 아직이라고 알린다 — 이미 보인다고 하면 거짓말이 된다", () => {
    const n = describeAutoShare({ feedEnabled: true, status: "PENDING_REVIEW" });
    expect(n?.state).toBe("waiting");
    expect(n?.text).toContain("기관 확인");
  });

  it("제출 전(상태 없음)에도 곧 보인다고 미리 알려준다", () => {
    expect(describeAutoShare({ feedEnabled: true })?.state).toBe("waiting");
  });
});

describe("formatFamilyName", () => {
  it("아이 이름을 먼저 쓴다", () => {
    expect(
      formatFamilyName({ childNames: ["이지안"], parentName: "홍길동" })
    ).toBe("이지안");
  });

  it("반이 있으면 앞에 붙인다 — 부모들은 서로를 '몇 반 누구' 로 안다", () => {
    expect(
      formatFamilyName({ childNames: ["홍길동"], className: "햇살반" })
    ).toBe("햇살반 홍길동");
  });

  it("반이 비어 있으면 접두 없이 이름만", () => {
    expect(
      formatFamilyName({ childNames: ["홍길동"], className: null })
    ).toBe("홍길동");
    expect(
      formatFamilyName({ childNames: ["홍길동"], className: "   " })
    ).toBe("홍길동");
  });

  it("형제자매도 반은 한 번만 붙는다", () => {
    expect(
      formatFamilyName({ childNames: ["장시연", "장서현"], className: "나비반" })
    ).toBe("나비반 장시연·장서현");
  });

  it("보호자 이름으로 떨어져도 반은 붙는다", () => {
    expect(
      formatFamilyName({ className: "나비반", parentName: "홍길동" })
    ).toBe("나비반 홍길동");
  });

  it("반만 있고 쓸 이름이 없으면 반도 안 붙인다 — '나비반 가족' 은 누구인지 모른다", () => {
    expect(
      formatFamilyName({ className: "나비반", parentName: "학부모_0914" })
    ).toBe("");
  });

  it("형제자매는 · 로 잇는다", () => {
    expect(formatFamilyName({ childNames: ["이세빈", "이고은"] })).toBe(
      "이세빈·이고은"
    );
  });

  it("빈 이름은 걸러낸다", () => {
    expect(formatFamilyName({ childNames: ["", "  ", "김건"] })).toBe("김건");
  });

  it("아이가 없으면 보호자 이름", () => {
    expect(formatFamilyName({ childNames: [], parentName: "홍길동" })).toBe(
      "홍길동"
    );
  });

  it("자동 생성 보호자 이름은 쓰지 않는다 — 계정 번호가 캡션에 뜬다", () => {
    expect(formatFamilyName({ parentName: "학부모_0914" })).toBe("");
    expect(formatFamilyName({ childNames: null, parentName: "학부모_354" })).toBe(
      ""
    );
  });

  it("둘 다 없으면 빈 문자열 — 캡션은 시각만 남는다", () => {
    expect(formatFamilyName({})).toBe("");
    expect(formatFeedMeta(formatFamilyName({}), "2026-09-12T11:57:00+09:00", NOW)).toBe(
      "3분 전"
    );
  });

  it("자동 생성 이름이어도 아이 이름이 있으면 그쪽을 쓴다", () => {
    expect(
      formatFamilyName({ childNames: ["주원우"], parentName: "학부모_1234" })
    ).toBe("주원우");
  });
});

describe("resolveLikeGate", () => {
  const base = {
    feedEnabled: true,
    status: "AUTO_APPROVED",
    isMine: false,
    alreadyLiked: false,
    usedInMission: 0,
  };

  it("남의 사진 · 확인 끝 · 여유 있으면 누를 수 있다", () => {
    expect(resolveLikeGate(base)).toEqual({ canLike: true });
  });

  it("내 사진에는 못 누른다", () => {
    const r = resolveLikeGate({ ...base, isMine: true });
    expect(r.canLike).toBe(false);
    if (!r.canLike) expect(r.reason).toContain("내 사진");
  });

  it("미션당 3개를 다 쓰면 막힌다", () => {
    expect(resolveLikeGate({ ...base, usedInMission: 2 }).canLike).toBe(true);
    const r = resolveLikeGate({ ...base, usedInMission: 3 });
    expect(r.canLike).toBe(false);
    if (!r.canLike) expect(r.reason).toContain("3개");
  });

  it("다 썼어도 이미 누른 사진은 취소할 수 있어야 한다", () => {
    expect(
      resolveLikeGate({ ...base, usedInMission: 3, alreadyLiked: true }).canLike
    ).toBe(true);
  });

  it("취소는 내 사진·검토중·피드 꺼짐 조건보다 앞선다 — 되돌릴 길은 막지 않는다", () => {
    expect(
      resolveLikeGate({
        ...base,
        alreadyLiked: true,
        feedEnabled: false,
        status: "PENDING_REVIEW",
      }).canLike
    ).toBe(true);
  });

  it("검토 중·반려 사진에는 못 누른다", () => {
    for (const status of ["PENDING_REVIEW", "SUBMITTED", "REJECTED"]) {
      expect(resolveLikeGate({ ...base, status }).canLike).toBe(false);
    }
  });

  it("피드를 안 쓰는 행사면 못 누른다", () => {
    expect(resolveLikeGate({ ...base, feedEnabled: false }).canLike).toBe(false);
  });
});

describe("resolveLikeGrant", () => {
  it("좋아요 수만큼 도토리 — 상한 아래에서는 1:1", () => {
    expect(resolveLikeGrant({ likeCount: 1, granted: 0 })).toEqual({
      target: 1,
      delta: 1,
    });
    expect(resolveLikeGrant({ likeCount: 3, granted: 2 })).toEqual({
      target: 3,
      delta: 1,
    });
  });

  it("한 사진당 5개에서 멈춘다", () => {
    expect(resolveLikeGrant({ likeCount: 27, granted: 5 })).toEqual({
      target: 5,
      delta: 0,
    });
  });

  it("상한을 넘은 구간에서는 취소해도 도토리가 안 줄어든다", () => {
    // 10개 → 9개로 줄어도 min(5, 9) = 5 그대로.
    expect(resolveLikeGrant({ likeCount: 9, granted: 5 }).delta).toBe(0);
  });

  it("상한 아래에서 취소하면 회수한다", () => {
    expect(resolveLikeGrant({ likeCount: 2, granted: 3 })).toEqual({
      target: 2,
      delta: -1,
    });
  });

  it("전부 취소되면 0으로 돌아간다", () => {
    expect(resolveLikeGrant({ likeCount: 0, granted: 4 })).toEqual({
      target: 0,
      delta: -4,
    });
  });

  it("이미 맞으면 아무것도 적지 않는다 — 재계산이 원장을 더럽히지 않게", () => {
    expect(resolveLikeGrant({ likeCount: 4, granted: 4 }).delta).toBe(0);
  });

  it("회수가 덜 된 상태(잔액 부족)에서 다시 눌러도 과지급되지 않는다", () => {
    // 잔액이 없어 3까지만 깎였다면 granted=3, 좋아요가 다시 4개가 되면 +1 만.
    expect(resolveLikeGrant({ likeCount: 4, granted: 3 }).delta).toBe(1);
  });
});

describe("formatRelativeTime", () => {
  const at = (iso: string) => formatRelativeTime(iso, NOW);

  it("1분 미만은 방금", () => {
    expect(at("2026-09-12T11:59:30+09:00")).toBe("방금");
  });

  it("분·시간·일·주", () => {
    expect(at("2026-09-12T11:57:00+09:00")).toBe("3분 전");
    expect(at("2026-09-12T09:00:00+09:00")).toBe("3시간 전");
    expect(at("2026-09-10T12:00:00+09:00")).toBe("2일 전");
    expect(at("2026-08-29T12:00:00+09:00")).toBe("2주 전");
  });

  it("미래 시각(시계 어긋남)도 방금으로 — 음수가 새지 않게", () => {
    expect(at("2026-09-12T12:05:00+09:00")).toBe("방금");
  });

  it("빈 값·깨진 값은 빈 문자열", () => {
    expect(formatRelativeTime(null, NOW)).toBe("");
    expect(formatRelativeTime("", NOW)).toBe("");
    expect(formatRelativeTime("not-a-date", NOW)).toBe("");
  });
});

describe("formatFeedMeta", () => {
  it("이름 + 상대 시각", () => {
    expect(formatFeedMeta("홍길동", "2026-09-12T11:57:00+09:00", NOW)).toBe(
      "홍길동 가족 · 3분 전"
    );
  });

  it("시각이 없으면 이름만", () => {
    expect(formatFeedMeta("홍길동", null, NOW)).toBe("홍길동 가족");
  });

  it("이름이 없으면 시각만 — '가족' 이 홀로 남지 않게", () => {
    expect(formatFeedMeta("  ", "2026-09-12T11:57:00+09:00", NOW)).toBe(
      "3분 전"
    );
  });

  it("둘 다 없으면 빈 문자열", () => {
    expect(formatFeedMeta(null, null, NOW)).toBe("");
  });
});
