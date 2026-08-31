// 순위 점수 — 순수 계산. DB 도 server-only 도 없다(그래야 테스트로 못 박을 수 있다).
//
// ============================================================================
// 왜 도토리로 등수를 매기지 않는가
// ============================================================================
// 도토리는 **쓰는 재화**다. 원장에 SPEND_COUPON · SPEND_DECORATION 이 있고
// app_users.acorn_balance 가 실제로 줄어든다. 그런데 등수를 매기려면 「대충 해서
// 반려당하면 깎인다」 같은 감점이 필요하다. 이미 도토리를 써버린 집에서 깎으면
// 잔액이 음수가 되고, 지금 코드가 Math.max(0, …) 로 막고 있어서 **원장과 잔액이
// 조용히 어긋난다.** 쓴 걸 되물릴 수는 없다.
//
// 그래서 둘로 나눈다:
//   도토리 = 지갑. 늘기만 한다(승인 취소 회수는 예외).
//   점수   = 등수. 깎일 수 있고, 아무것도 살 수 없다.
//
// ============================================================================
// 왜 동점이 났는가
// ============================================================================
// 미션마다 acorns 가 고정(0~20 정수)이라, 미션 10개짜리 행사의 만점은 정확히 한
// 값이다. 다 한 집은 전부 같은 점수가 된다. **정수 상수만 더하면 동점은 필연이다.**
//
// 동점을 없애려면 연속량이 필요하다. 초 단위 소요시간이 그것이다.
//
// ============================================================================
// 왜 속도는 가산점만인가
// ============================================================================
// 숲에서 아이와 함께 하는 체험이다. 느리다고 깎으면 보호자가 아이를 재촉하고,
// 뛰게 만든다. 다칠 일을 시스템이 만들면 안 된다.
//   빠르면 더 받는다.  느려도 기본점은 그대로 받는다.  깎는 건 반려뿐이다.
//
// ============================================================================
// 「너무 빠름」을 왜 의심하는가
// ============================================================================
// 소요시간은 mission_attempts.opened_at 부터 잰다. 그런데 그 행은 미션 페이지에
// 들어올 때마다 opened_at 을 now 로 덮는다(attempt-actions.startMissionAttemptAction).
// 즉 **새로고침하면 시계가 0으로 돌아간다.** 빠를수록 무조건 이득이면 준비를 다
// 해놓고 새로고침 후 제출하는 것이 최적 전략이 된다 — 그건 미션이 아니다.
//
// 그래서 보너스 곡선은 0 에서 최대가 아니라 **바닥(floor)에서 최대**다.
//   floor 미만  : 보너스 0 (사진을 찍을 시간도 아니다)
//   floor       : 보너스 최대
//   par 이상    : 보너스 0 (기본점만)
// 새로고침 꼼수를 쓰려면 floor 만큼은 실제로 기다려야 하고, 그 정도면 그냥 한 것이다.

export type MissionKind =
  | "PHOTO"
  | "QR_QUIZ"
  | "PHOTO_APPROVAL"
  | "COOP"
  | "BROADCAST"
  | "TREASURE"
  | "RADIO"
  | "FINAL_REWARD";

/** 도토리 1개 = 점수 100. 100 을 곱해 두면 보너스·감점을 정수로 나눠도 자리가 남는다. */
export const POINTS_PER_ACORN = 100;

/** 속도 보너스는 기본점의 최대 50%. 실력 차이는 벌리되 기본점을 못 이기게. */
export const SPEED_BONUS_RATIO = 0.5;

/** 반려 1회당 기본점의 25% 차감. */
export const REJECT_PENALTY_RATIO = 0.25;

/**
 * 미션 종류별 기준 시간(초). 이 시간 안에 끝내면 속도 보너스가 붙는다.
 *
 * 값의 근거는 「그 미션을 성의껏 하면 걸리는 시간」이다. QR 은 찍으면 끝이라 짧고,
 * 보물찾기는 돌아다녀야 해서 길다. 기관이 미션별로 조정할 수 있어야 하므로
 * org_missions.config_json.par_seconds 가 있으면 그쪽이 이긴다.
 */
export const PAR_SECONDS: Record<MissionKind, number> = {
  QR_QUIZ: 90,
  PHOTO: 180,
  PHOTO_APPROVAL: 180,
  RADIO: 120,
  BROADCAST: 120,
  COOP: 300,
  TREASURE: 600,
  FINAL_REWARD: 60,
};

/** 기준 시간을 못 찾았을 때. */
const PAR_FALLBACK = 180;

/**
 * 「이보다 빠르면 실제로 한 게 아니다」 경계.
 *
 * 종류마다 다르므로 기준 시간에 비례시킨다(10%, 최소 5초). QR 은 9초, 보물찾기는
 * 60초가 된다 — QR 을 10초에 찍는 건 정상이고 보물을 10초에 찾는 건 아니다.
 */
export function floorSeconds(par: number): number {
  return Math.max(5, Math.round(par * 0.1));
}

/**
 * 속도 계수 0 ~ 1. 1이면 속도 보너스 만점.
 *
 *        1 ┤      ╱▔▔╲__
 *          │     ╱      ╲___
 *        0 ┼────┴──────────╲────
 *          0  floor        par   (초)
 */
export function speedFactor(elapsedSeconds: number, par: number): number {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return 0;
  const p = Number.isFinite(par) && par > 0 ? par : PAR_FALLBACK;
  const floor = floorSeconds(p);
  if (p <= floor) return 0; // 기준이 바닥보다 짧으면 잴 것이 없다
  if (elapsedSeconds < floor) return 0; // 너무 빠름 — 의심
  if (elapsedSeconds >= p) return 0; // 기준 초과 — 기본점만
  return (p - elapsedSeconds) / (p - floor);
}

/** 이 미션의 기준 시간 — 미션 설정이 있으면 그것, 없으면 종류 기본값. */
export function parSecondsFor(
  kind: string,
  config?: { par_seconds?: unknown } | null
): number {
  const raw = config?.par_seconds;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  return PAR_SECONDS[kind as MissionKind] ?? PAR_FALLBACK;
}

export type MissionScore = {
  /** 미션 도토리에서 오는 몫. 누구나 같다. */
  base: number;
  /** 빨리 끝낸 몫. 0 ~ base×0.5. 여기서 등수가 갈린다. */
  speedBonus: number;
  /** base + speedBonus */
  total: number;
  /** 화면에 한 줄로 적을 이유. */
  note: string;
};

/**
 * 승인된 제출 하나가 받는 점수.
 *
 * @param acorns   미션에 걸린 도토리(org_missions.acorns)
 * @param elapsedSeconds 소요 시간. 못 쟀으면 null — 보너스 없이 기본점만.
 * @param par      기준 시간
 */
export function scoreForApproved(params: {
  acorns: number;
  elapsedSeconds: number | null;
  par: number;
}): MissionScore {
  const acorns = Math.max(0, Math.round(params.acorns || 0));
  const base = acorns * POINTS_PER_ACORN;

  if (base === 0) {
    return { base: 0, speedBonus: 0, total: 0, note: "점수 없는 미션" };
  }
  if (params.elapsedSeconds === null) {
    return { base, speedBonus: 0, total: base, note: "기본 점수" };
  }

  const f = speedFactor(params.elapsedSeconds, params.par);
  const speedBonus = Math.round(base * SPEED_BONUS_RATIO * f);
  const total = base + speedBonus;

  let note: string;
  if (speedBonus === 0) {
    const floor = floorSeconds(params.par);
    note =
      params.elapsedSeconds < floor
        ? "기본 점수 (너무 빨라 속도 점수 없음)"
        : "기본 점수";
  } else {
    note = `기본 ${base} + 속도 ${speedBonus}`;
  }
  return { base, speedBonus, total, note };
}

/**
 * 반려 1건의 감점. **음수**를 돌려준다.
 *
 * 재제출해서 나중에 승인받으면 기본점은 그대로 받는다 — 감점은 원장에 따로 남아
 * 합계에서 빠진다. 「대충 냈다가 다시 제대로 낸 집」이 「처음부터 제대로 낸 집」을
 * 못 이기게 하는 게 목적이지, 만회를 막는 게 목적이 아니다.
 */
export function penaltyForRejected(acorns: number): number {
  const base = Math.max(0, Math.round(acorns || 0)) * POINTS_PER_ACORN;
  if (base === 0) return 0;
  return -Math.round(base * REJECT_PENALTY_RATIO);
}

/** 초 → "1분 20초" (화면 표시용). */
export function formatElapsed(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "-";
  const s = Math.round(seconds);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}분` : `${m}분 ${r}초`;
}
