// 참가자가 행사에 들어갈 수 있는지 — 순수 로직(서버/클라이언트 공용, DB 접근 없음).
//
// 왜 이 파일이 생겼나:
//   "행사가 끝났다" 가 두 가지 뜻으로 뒤섞여 있었다.
//     ① 날짜가 지났다      — 저절로 일어난다. 아무도 안 누른다.
//     ② 기관이 종료를 눌렀다 — 사람의 결정이다.
//   화면마다 `status === "LIVE"` 를 각자 쓰다 보니 둘이 구분되지 않았고,
//   그래서 19일 전에 끝난 행사가 부모 화면에서 계속 초록불(진행중)이었다.
//   반대로 기관이 종료를 눌러도 목록에서 사라질 뿐, 북마크·QR 로는 그냥
//   들어가졌다 — 숨기기만 하고 잠그지는 않았다.
//
//   두 축을 갈라서 여기 한 곳에서 판단한다.
//     회색 = 날짜가 지났다 (자동)
//     잠금 = 기관이 종료를 눌렀다 (수동)
//
// 종료(ENDED)가 사진·설문까지 막지 않는 이유:
//   기관의 진행 순서가 `내 행사 → 초대장 → 참가자 → 진행 → 결과[설문]` 이다.
//   설문은 **끝난 뒤에** 받는 것이라, 종료가 문을 완전히 잠그면 설문 링크가
//   같이 죽는다. 사진도 마찬가지다. 그래서 종료는 **활동만** 잠근다.
//   완전히 닫고 싶으면 보관(ARCHIVED) 이 그 자리다.

import { kstDayIndex } from "@/lib/datetime/kst";
import type { OrgEventStatus } from "./types";

export type EventPhase =
  /** 아직 안 열림 — 예정(DRAFT)이고 날짜도 안 지남 */
  | "upcoming"
  /** 열려 있음 */
  | "live"
  /** 날짜는 지났지만 기관이 종료를 안 누름 — 회색이되 들어갈 수 있다 */
  | "past"
  /** 기관이 종료함 — 활동은 잠기고 사진·기록·설문만 열린다 */
  | "closed"
  /** 기관이 보관함 — 완전히 닫힘 */
  | "archived";

export type EventAccess = {
  phase: EventPhase;
  /** 목록 카드 뱃지 */
  badgeEmoji: string;
  badgeLabel: string;
  /** 카드를 회색으로 죽일지 */
  dimmed: boolean;
  /** 행사 안(/e/{id})으로 들어갈 수 있나 */
  canEnter: boolean;
  /** 스탬프·미션·좋아요·선물 — 뭔가를 남길 수 있나 */
  canPlay: boolean;
  /**
   * 새로 신청·참가할 수 있나.
   *
   * 예정(DRAFT)에도 true 인 이유: 초대장은 행사 전에 돌린다. 그때 못 들어오면
   * 초대장이 초대장 노릇을 못 한다. 닫히는 건 기관이 종료를 누른 뒤부터다.
   */
  canJoin: boolean;
  /** 카드 아래 한 줄 */
  cta: string;
  /**
   * 활동이 잠겼을 때 화면에 적을 한 줄. 열려 있으면 null 이라,
   * 호출부는 `notice && <p>{notice}</p>` 로 그 자리를 통째로 비운다.
   */
  notice: string | null;
  /** 0 = 오늘, 양수 = 남은 날, 음수 = 지난 날. 날짜가 없으면 null. */
  dday: number | null;
  /** "D-13" / "D-DAY" / "D+19". 날짜가 없으면 null. */
  ddayLabel: string | null;
};

/** 목록 정렬 순서 — 열린 것부터, 지난 것은 아래로. */
export const PHASE_ORDER: Record<EventPhase, number> = {
  live: 0,
  upcoming: 1,
  past: 2,
  closed: 3,
  archived: 4,
};

/**
 * 여러 행사 중 "지금 이 기관을 대표하는" 하나.
 *
 * 숲지기 대시보드의 기관 한 줄처럼 딱 하나만 보여줄 수 있는 자리에서 쓴다.
 * 고르는 규칙은 참가자 홈의 정렬과 **같다** — 열린 것이 먼저, 지난 것이 뒤.
 * 두 화면이 다른 행사를 대표로 뽑으면 "어느 게 맞는 거지" 가 된다.
 *
 * 같은 칸 안에서는 앞으로 올 일은 가까운 것부터, 지나간 일은 방금 것부터.
 */
export function pickRepresentativeEvent<
  T extends {
    status?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
  },
>(events: T[], now?: Date | string): T | null {
  let best: { event: T; order: number; time: number; dim: boolean } | null =
    null;

  for (const event of events) {
    const access = resolveEventAccess({
      status: event.status,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      now,
    });
    const order = PHASE_ORDER[access.phase];
    const time = event.starts_at ? new Date(event.starts_at).getTime() : 0;
    const cand = { event, order, time, dim: access.dimmed };

    if (!best || cand.order < best.order) {
      best = cand;
      continue;
    }
    if (cand.order > best.order) continue;
    // 같은 칸 — 열린 행사는 임박한 순, 끝난 행사는 최근 순.
    const better = best.dim ? cand.time > best.time : cand.time < best.time;
    if (better) best = cand;
  }

  return best?.event ?? null;
}

function ddayLabelOf(d: number): string {
  if (d === 0) return "D-DAY";
  return d > 0 ? `D-${d}` : `D+${-d}`;
}

/**
 * 행사가 "지난" 날인지.
 *
 * 기준은 **끝나는 날**이다. ends_at 이 있으면 그 날, 없으면 시작 날.
 * 그 날이 통째로 지나야 지난 행사다 — 오전에 시작한 행사가 점심에 회색이
 * 되면 안 된다. 날짜가 하나도 없는 행사는 영원히 지나지 않는다(기관이
 * 종료를 눌러야 닫힌다).
 */
function isPastDay(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: Date
): boolean {
  const boundary = kstDayIndex(endsAt) ?? kstDayIndex(startsAt);
  if (boundary === null) return false;
  const today = kstDayIndex(now);
  if (today === null) return false;
  return boundary < today;
}

/**
 * 참가자 화면 전부가 쓰는 단일 판단.
 *
 * 홈 카드 · 행사 레이아웃 탭 · 잠금 화면 · 신청 폼 · 서버 액션이 **전부**
 * 이 함수를 부른다. 각자 `status === "LIVE"` 를 쓰면 한쪽만 고쳐지는 종류의
 * 버그가 난다 — 화면은 잠겼는데 서버는 계속 받아준다든가.
 *
 * @param now 테스트에서 시각을 고정하기 위해 주입 가능. 생략하면 지금.
 */
export function resolveEventAccess(input: {
  status: OrgEventStatus | string | null | undefined;
  startsAt: string | null | undefined;
  endsAt: string | null | undefined;
  now?: Date | string;
}): EventAccess {
  const now =
    input.now === undefined
      ? new Date()
      : input.now instanceof Date
        ? input.now
        : new Date(input.now);
  const nowSafe = Number.isNaN(now.getTime()) ? new Date() : now;

  const startDay = kstDayIndex(input.startsAt);
  const today = kstDayIndex(nowSafe);
  const dday = startDay !== null && today !== null ? startDay - today : null;

  const base = {
    dday,
    ddayLabel: dday === null ? null : ddayLabelOf(dday),
  };

  if (input.status === "ARCHIVED") {
    return {
      ...base,
      phase: "archived",
      badgeEmoji: "📦",
      badgeLabel: "보관됨",
      dimmed: true,
      canEnter: false,
      canPlay: false,
      canJoin: false,
      cta: "닫힌 행사",
      notice: "보관된 행사예요. 기관에 문의해 주세요.",
    };
  }

  if (input.status === "ENDED") {
    return {
      ...base,
      phase: "closed",
      badgeEmoji: "🏁",
      badgeLabel: "종료됨",
      dimmed: true,
      canEnter: true,
      canPlay: false,
      canJoin: false,
      cta: "추억 보기 →",
      notice: "끝난 행사예요. 사진과 기록은 계속 볼 수 있어요.",
    };
  }

  if (isPastDay(input.startsAt, input.endsAt, nowSafe)) {
    return {
      ...base,
      phase: "past",
      badgeEmoji: "🕗",
      badgeLabel: "지난 행사",
      dimmed: true,
      canEnter: true,
      canPlay: true,
      canJoin: true,
      cta: "행사 보기 →",
      notice: null,
    };
  }

  if (input.status === "LIVE") {
    return {
      ...base,
      phase: "live",
      badgeEmoji: "🟢",
      badgeLabel: "진행중",
      dimmed: false,
      canEnter: true,
      canPlay: true,
      canJoin: true,
      cta: "행사 입장하기 →",
      notice: null,
    };
  }

  // DRAFT — 아직 준비 중. 초대장과 일정은 미리 볼 수 있다.
  return {
    ...base,
    phase: "upcoming",
    badgeEmoji: "🌱",
    badgeLabel: "예정",
    dimmed: false,
    canEnter: true,
    canPlay: false,
    canJoin: true,
    cta: "초대장·일정 보기 →",
    notice: "아직 시작 전이에요. 곧 만나요!",
  };
}
