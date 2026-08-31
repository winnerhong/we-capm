// 「등수는 어떻게 갈리나」 안내 — 순수 로직(서버/클라이언트 공용).
//
// 손으로 적지 않고 **점수 상수에서 뽑아내는** 이유는 buildAcornGuide 와 같다.
// 규칙을 바꿨는데 안내문이 그대로면, 화면에는 "최대 +50%" 라고 적혀 있는데 실제로는
// +30% 가 붙는 가장 나쁜 종류의 안내가 남는다. core.ts 의 값에서 만들면 틀릴 수 없다.

import {
  PAR_SECONDS,
  POINTS_PER_ACORN,
  REJECT_PENALTY_RATIO,
  SPEED_BONUS_RATIO,
  type MissionKind,
} from "./core";
import { MISSION_KIND_META } from "@/lib/missions/types";
import type { AcornGuideItem } from "@/lib/missions/acorn-guide-core";

export type ScoreRule = {
  icon: string;
  label: string;
  detail: string;
  /** 감점 규칙은 색을 달리 준다 — 받는 것과 잃는 것이 같은 색이면 안 읽힌다. */
  tone: "base" | "bonus" | "penalty";
};

/**
 * 상단 배점표가 그릴 것 전부.
 *
 * ⚠ 이 타입이 **순수 모듈에 있어야 하는 이유**: 버튼은 클라이언트 컴포넌트다.
 *   데이터 로더(guide-queries.ts)에 두고 거기서 가져오면, 예전에 목차 화면이
 *   그랬듯 "server-only" 가 클라이언트 번들에 딸려 들어가 500 이 난다.
 *   화면과 서버가 같이 쓰는 정의는 로더와 같은 파일에 두지 않는다.
 */
export type AcornScoreGuide = {
  /** 어느 행사 기준인지. 없으면 행사가 하나도 없는 기관. */
  eventName: string | null;
  eventStatus: string | null;
  /** 도토리 받는 법 — 이 행사에 켜져 있는 미션에서 뽑아낸다. */
  earn: AcornGuideItem[];
  /** 등수 규칙 — 점수 상수에서 뽑아낸다. */
  rules: ScoreRule[];
};

/** 초 → "3분" / "1분 30초" (기준 시간 표기용). */
function mmss(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}

/**
 * 등수 규칙 세 줄.
 *
 * @param kinds 이 행사에 실제로 켜져 있는 미션 종류들. 기준 시간 예시를 여기서만
 *   뽑는다 — 안 쓰는 미션의 기준 시간을 적으면 읽는 사람이 헷갈린다.
 */
export function buildScoreRules(kinds: string[] = []): ScoreRule[] {
  const rules: ScoreRule[] = [
    {
      icon: "🌰",
      label: "기본 점수",
      detail: `도토리 1개 = ${POINTS_PER_ACORN}점`,
      tone: "base",
    },
  ];

  // 기준 시간 예시 — 켜져 있는 미션 중 짧은 것부터 셋까지.
  const used = [...new Set(kinds)]
    .filter((k): k is MissionKind => k in PAR_SECONDS && k !== "FINAL_REWARD")
    .sort((a, b) => PAR_SECONDS[a] - PAR_SECONDS[b])
    .slice(0, 3);

  const examples = used
    .map((k) => `${MISSION_KIND_META[k]?.label ?? k} ${mmss(PAR_SECONDS[k])}`)
    .join(" · ");

  rules.push({
    icon: "⚡",
    label: "빨리 끝내면",
    detail: examples
      ? `최대 +${Math.round(SPEED_BONUS_RATIO * 100)}% (기준 ${examples})`
      : `기준 시간 안에 끝내면 최대 +${Math.round(SPEED_BONUS_RATIO * 100)}%`,
    tone: "bonus",
  });

  rules.push({
    icon: "⚠️",
    label: "반려되면",
    detail: `한 번에 −${Math.round(REJECT_PENALTY_RATIO * 100)}% (도토리는 안 깎여요)`,
    tone: "penalty",
  });

  return rules;
}

/**
 * 규칙 아래 한 줄로 붙일 주의사항.
 *
 * 이 두 문장이 없으면 안내가 오해를 만든다:
 *   · "느리면 깎이나?" → 보호자가 아이를 재촉한다. 숲에서 뛰게 만들면 안 된다.
 *   · "너무 빨리 내면?" → 새로고침으로 시계를 되돌리는 꼼수를 막아 둔 것을
 *     말해 주지 않으면, 성실히 한 집이 왜 점수가 낮은지 알 수 없다.
 */
export const SCORE_RULE_NOTES = [
  "느려도 기본 점수는 그대로예요 — 속도는 더 받는 것뿐이에요.",
  "너무 빨리 내면 속도 점수가 붙지 않아요.",
];
