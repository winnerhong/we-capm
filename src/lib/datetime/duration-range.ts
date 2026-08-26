// 시작 일시 + 기간 → 종료 일시. 순수 로직 (React·DB 의존 없음).
//
// 배경:
//   행사 편집 화면은 "시작 일시 + 기간 슬라이더 → 종료 일시 자동 계산" 이라
//   날짜를 두 번 고를 필요가 없다. 반면 스탬프북(퀘스트팩) 화면은 아직
//   datetime-local 두 칸이라, 종료를 시작보다 앞으로 찍는 실수가 그대로 통과했다
//   (제출 시점에야 "시작 일시가 종료 일시보다 늦어요" 로 막힌다).
//
//   같은 UI 를 화면마다 다시 짜면 지금 세 벌인 계산이 네 벌이 된다. 계산과
//   포맷을 여기 한 곳에 모으고, 화면은 <DurationRangePicker /> 하나를 쓴다.
//
// 눈금(scale) 을 나누는 이유:
//   행사는 몇 시간짜리라 5분 단위가 맞지만, 스탬프북은 몇 주~몇 달을 간다.
//   같은 슬라이더(5분~10시간)를 그대로 쓰면 1주짜리 스탬프북을 아예 만들 수
//   없다. 눈금만 바꿔 끼우고 나머지 동작은 공유한다.
//
// 시각 해석은 전부 KST 고정 — 서버 액션(toIsoKstFromLocalInput)과 같은 기준.

import { toIsoKstFromLocalInput, toLocalInputFromIsoKst } from "./kst";

export type DurationScale = "hours" | "days";

const DAY = 60 * 24;

export type DurationPreset = { label: string; mins: number };

export type ScaleConfig = {
  /** 슬라이더 최소/최대/스텝 (분) */
  minMin: number;
  maxMin: number;
  stepMin: number;
  /** 기존 값이 없을 때 쓰는 기본 기간 (분) */
  defaultMin: number;
  presets: DurationPreset[];
  /** 슬라이더 양끝 눈금 라벨 */
  minLabel: string;
  maxLabel: string;
  /** "📏 진행 기간 (1일 단위)" 의 괄호 안 */
  unitNote: string;
  /** 시작 일시 셀렉터의 분 단위 (5 = 5분 단위) */
  minuteStep: number;
};

export const DURATION_SCALES: Record<DurationScale, ScaleConfig> = {
  // 행사 — 반나절 이내
  hours: {
    minMin: 5,
    maxMin: 60 * 10,
    stepMin: 5,
    defaultMin: 120,
    presets: [
      { label: "30분", mins: 30 },
      { label: "1시간", mins: 60 },
      { label: "2시간", mins: 120 },
      { label: "3시간", mins: 180 },
      { label: "4시간", mins: 240 },
      { label: "6시간", mins: 360 },
      { label: "8시간", mins: 480 },
      { label: "10시간", mins: 600 },
    ],
    minLabel: "5분",
    maxLabel: "10시간",
    unitNote: "5분 단위",
    minuteStep: 5,
  },
  // 스탬프북·시즌 — 며칠에서 몇 달
  days: {
    minMin: DAY,
    maxMin: 180 * DAY,
    stepMin: DAY,
    defaultMin: 7 * DAY,
    presets: [
      { label: "1일", mins: DAY },
      { label: "3일", mins: 3 * DAY },
      { label: "1주", mins: 7 * DAY },
      { label: "2주", mins: 14 * DAY },
      { label: "1개월", mins: 30 * DAY },
      { label: "2개월", mins: 60 * DAY },
      { label: "3개월", mins: 90 * DAY },
    ],
    minLabel: "1일",
    maxLabel: "6개월",
    unitNote: "1일 단위",
    minuteStep: 5,
  },
};

/** 170 → "2시간 50분", 10080 → "7일". 주·달로 뭉치지 않는다(윤달 오차가 생기므로). */
export function formatDurationKo(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "-";
  const m = Math.round(min);
  if (m < 60) return `${m}분`;
  const days = Math.floor(m / DAY);
  const hours = Math.floor((m % DAY) / 60);
  const mins = m % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}일`);
  if (hours) parts.push(`${hours}시간`);
  if (mins) parts.push(`${mins}분`);
  return parts.join(" ");
}

/** "2026-09-12T09:30" → { date, hour, minute }. 형식이 아니면 null. */
export function splitLocalInput(
  value: string | null | undefined
): { date: string; hour: number; minute: number } | null {
  if (!value) return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return { date: m[1], hour: Number(m[2]), minute: Number(m[3]) };
}

export function composeLocalInput(
  date: string,
  hour: number,
  minute: number
): string {
  if (!date) return "";
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  const mi = Math.max(0, Math.min(59, Math.floor(minute)));
  return `${date}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

/**
 * 두 datetime-local 값의 간격(분).
 * 값이 없거나 종료가 시작보다 빠르면 **그 눈금의 기본 기간**으로 떨어진다 —
 * 슬라이더에는 언제나 잡을 손잡이가 있어야 하기 때문.
 * 범위를 벗어난 기존 값(예: 1년짜리)은 잘라서 슬라이더 안에 넣는다.
 */
export function deriveDurationMin(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  scale: DurationScale
): number {
  const cfg = DURATION_SCALES[scale];
  const s = localInputToMs(startsAt);
  const e = localInputToMs(endsAt);
  if (s === null || e === null) return cfg.defaultMin;
  const diff = Math.round((e - s) / 60_000);
  if (diff <= 0) return cfg.defaultMin;
  return Math.max(cfg.minMin, Math.min(cfg.maxMin, diff));
}

/** "2026-09-12T09:30" + 170분 → "2026-09-12T12:20". 못 읽으면 빈 문자열. */
export function addMinutesToLocalInput(
  startLocal: string | null | undefined,
  minutes: number
): string {
  const ms = localInputToMs(startLocal);
  if (ms === null || !Number.isFinite(minutes)) return "";
  return toLocalInputFromIsoKst(
    new Date(ms + Math.round(minutes) * 60_000).toISOString()
  );
}

/**
 * 분 셀렉터 항목. 기본은 0·5·…·55 지만, 이미 저장된 값이 5의 배수가 아니면
 * (예전 화면에서 09:33 으로 저장됐다면) 그 값도 목록에 넣는다.
 * 그러지 않으면 셀렉터가 빈칸이 되고, 손대지도 않은 시각이 저장 때 바뀐다.
 */
export function minuteOptions(current: number, step = 5): number[] {
  const base: number[] = [];
  for (let m = 0; m < 60; m += step) base.push(m);
  if (
    Number.isFinite(current) &&
    current >= 0 &&
    current < 60 &&
    !base.includes(current)
  ) {
    base.push(current);
    base.sort((a, b) => a - b);
  }
  return base;
}

function localInputToMs(value: string | null | undefined): number | null {
  const iso = toIsoKstFromLocalInput(value);
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}
