// 행사 설문 — 순수 로직(서버/클라이언트 공용, DB 접근 없음).
//
// 설문은 "행사가 끝난 뒤 한 번" 이라 조건이 단순해 보이지만, 실제로는 켜짐 여부·
// 행사 상태·시각·이미 냈는지가 얽힌다. 화면과 서버가 각자 판단하면 "버튼은
// 있는데 눌러도 안 되는" 화면이 나온다. 판단을 여기 모은다.
//
// 여는 일을 시계에 맡긴 이유:
//   예전에는 스위치 하나로만 열렸다. 그러면 기관이 **행사 중에** 그 스위치를
//   눌러야 한다. 행사장에서 아이들 챙기는 사람이 그걸 기억할 수 없고, 집에
//   가서 켜면 이미 늦다 — 카톡으로 링크를 보내도 안 읽는다.
//   설문은 아직 행사장에 있을 때 받아야 한다.
//
//     스위치(준비 단계에서 한 번)  ×  종료 30분 전이 됐나(자동)  →  열림

import { fmtAmPmClockKst } from "@/lib/datetime/kst";

export const SURVEY_MIN_RATING = 1;
export const SURVEY_MAX_RATING = 5;
export const SURVEY_COMMENT_MAX = 500;

/** 기본 개방 리드타임(분). DB 기본값·컬럼 미적용 폴백과 같은 값. */
export const DEFAULT_SURVEY_LEAD_MIN = 30;

/** 입력 상한 — 이보다 이르면 "행사 마무리" 가 아니라 행사 도중이다. */
export const MAX_SURVEY_LEAD_MIN = 240;

export type SurveyOpenAt = {
  /** 열리는 시각 (ISO). */
  at: string;
  /** 행사 종료 몇 분 전인지. */
  leadMin: number;
  /** "오후 12:30" */
  clock: string;
  /** "오후 12:30부터 (30분 전)" — 기관 화면에 그대로 쓰는 문구. */
  label: string;
};

/**
 * 설문이 스스로 열리는 시각. **자동으로 열지 않으면 null.**
 *
 * null 인 경우:
 *   · leadMin 이 null / 0 / 음수 — 기관이 "자동 안 씀" 으로 둔 것
 *   · 행사 종료 시각이 없거나 깨진 값 — 기준이 없으면 계산할 수 없다
 *   둘 다 "기관이 🏁 종료를 눌러야 열린다" 로 흘러간다.
 *
 * @param leadMin `undefined` 는 **컬럼 미적용 배포 창**을 뜻한다. 이때는 기본값
 *   30분으로 폴백한다. 명시적인 `null` 은 "자동 안 씀" 이므로 폴백하지 않는다.
 */
export function resolveSurveyOpenAt(
  endsAt: string | null | undefined,
  leadMin: number | null | undefined
): SurveyOpenAt | null {
  const effective = leadMin === undefined ? DEFAULT_SURVEY_LEAD_MIN : leadMin;

  if (
    effective === null ||
    typeof effective !== "number" ||
    !Number.isFinite(effective) ||
    effective <= 0
  ) {
    return null;
  }

  if (!endsAt) return null;
  const endMs = new Date(endsAt).getTime();
  if (!Number.isFinite(endMs)) return null;

  // fmtAmPmClockKst 는 자정을 "시간 미지정" 으로 보고 빈 문자열을 준다.
  // 종료를 날짜만 적은 행사가 그렇다 — 몇 시에 끝나는지 모르면 "30분 전" 도
  // 모른다. 자정 23:30 에 설문을 여는 건 아무에게도 도움이 안 된다.
  if (!fmtAmPmClockKst(endsAt)) return null;

  const lead = Math.min(MAX_SURVEY_LEAD_MIN, Math.floor(effective));
  const at = new Date(endMs - lead * 60_000).toISOString();
  const clock = fmtAmPmClockKst(at);
  if (!clock) return null;

  return { at, leadMin: lead, clock, label: `${clock}부터 (${lead}분 전)` };
}

/** 폼 입력값("40" / "" / "0") → 저장값. 빈 값·0·숫자 아님은 null(자동 안 씀). */
export function parseSurveyLeadInput(raw: string): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const n = Math.floor(Number(s));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(MAX_SURVEY_LEAD_MIN, n);
}

export type SurveyGate =
  | { canAnswer: true; alreadyAnswered: boolean }
  | { canAnswer: false; reason: string; opensAt: string | null };

/**
 * 이 참가자가 지금 설문에 답할 수 있는가.
 *
 * 이미 낸 사람도 canAnswer 다 — 고칠 수 있어야 한다. 대신 alreadyAnswered 로
 * 화면이 "수정" 이라고 말하게 한다.
 *
 * 닫는 시각은 없다. 늦게 낸 답을 버릴 이유가 없다 — 그만 받고 싶으면 기관이
 * 스위치를 끈다.
 *
 * @param now 테스트에서 시각을 고정하기 위해 주입 가능. 생략하면 지금.
 */
export function resolveSurveyGate(args: {
  surveyEnabled: boolean;
  eventStatus: string;
  alreadyAnswered: boolean;
  /** 행사 종료 시각 — 자동 개방의 기준. */
  endsAt?: string | null;
  /** 종료 몇 분 전부터 열지. undefined 는 컬럼 미적용(기본 30분으로 폴백). */
  openLeadMin?: number | null;
  now?: Date | string;
}): SurveyGate {
  if (!args.surveyEnabled) {
    return {
      canAnswer: false,
      reason: "이 행사는 설문을 받지 않아요",
      opensAt: null,
    };
  }
  // DRAFT = 아직 시작도 안 한 행사. 그때 설문을 받으면 답할 게 없다.
  if (args.eventStatus === "DRAFT") {
    return { canAnswer: false, reason: "행사가 시작되면 열려요", opensAt: null };
  }
  // 기관이 끝냈으면 시각을 따지지 않는다 — 사람의 결정이 시계보다 위다.
  if (args.eventStatus !== "LIVE") {
    return { canAnswer: true, alreadyAnswered: args.alreadyAnswered };
  }

  const open = resolveSurveyOpenAt(args.endsAt, args.openLeadMin);
  if (!open) {
    return { canAnswer: false, reason: "행사가 끝나면 열려요", opensAt: null };
  }

  const nowMs =
    args.now === undefined
      ? Date.now()
      : (args.now instanceof Date ? args.now : new Date(args.now)).getTime();
  const safeNow = Number.isFinite(nowMs) ? nowMs : Date.now();

  if (safeNow < new Date(open.at).getTime()) {
    return {
      canAnswer: false,
      reason: `${open.clock}부터 열려요`,
      opensAt: open.at,
    };
  }

  return { canAnswer: true, alreadyAnswered: args.alreadyAnswered };
}

/** 별점 정규화 — 범위를 벗어나면 저장하지 않는다(0점·6점 응답을 막는다). */
export function normalizeRating(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < SURVEY_MIN_RATING || r > SURVEY_MAX_RATING) return null;
  return r;
}

/** 한 줄 의견 정리 — 공백만 남은 입력은 없는 것으로 본다. */
export function normalizeComment(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  return t.slice(0, SURVEY_COMMENT_MAX);
}

/** 별점을 사람 말로 — 숫자만 보여주면 5점이 좋은 건지 나쁜 건지 헷갈린다. */
export function ratingLabel(rating: number): string {
  switch (Math.round(rating)) {
    case 5:
      return "최고예요";
    case 4:
      return "좋았어요";
    case 3:
      return "보통이에요";
    case 2:
      return "아쉬웠어요";
    case 1:
      return "많이 아쉬웠어요";
    default:
      return "";
  }
}

/** "★★★★☆" — 평균에도 쓰므로 반올림해서 채운다. */
export function ratingStars(rating: number): string {
  const n = Math.max(0, Math.min(SURVEY_MAX_RATING, Math.round(rating)));
  return "★".repeat(n) + "☆".repeat(SURVEY_MAX_RATING - n);
}

// 요약(평균·응답 수·의견 수)은 survey-report 의 buildSurveyReport 가 낸다.
// 여기에도 두면 두 군데서 같은 걸 계산하게 되고, 언젠가 한쪽만 고쳐진다.
