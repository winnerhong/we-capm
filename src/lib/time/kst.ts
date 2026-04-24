// KST(대한민국 표준시, UTC+9) 기준 날짜/시각 경계 헬퍼.
//
// "오늘 자정" 같은 절대 기준점을 만들 때 사용. 과거엔 `now - 24h` 로 근사했지만,
// 자정 직후~새벽 구간에 어제 23시 이후 데이터가 "오늘"로 섞이는 문제가 있어
// Intl.DateTimeFormat 으로 KST 달력상 실제 자정을 계산하도록 교체했다.
//
// "지난 6시간" / "지난 7일" 같은 **상대** 기준은 그대로 `Date.now() - N*ms` 가 정확하므로
// 이 파일은 **오늘(N일전) 자정 경계**에만 집중한다.

/**
 * 대한민국 표준시(KST, UTC+9) 기준 오늘 00:00 의 ISO 문자열.
 * 예: 2026-04-25T00:00:00+09:00
 *
 * DB 컬럼이 `timestamptz` 면 이 문자열을 `gte` 에 그대로 넘겨도 올바르게 비교된다
 * (Postgres 가 UTC 로 정규화).
 */
export function startOfTodayKstIso(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}T00:00:00+09:00`;
}

/**
 * KST 기준 N일 전 00:00 의 ISO 문자열.
 * daysAgo=0 이면 오늘, 1 이면 어제, 7 이면 일주일 전.
 */
export function startOfDaysAgoKstIso(daysAgo: number): string {
  const now = new Date();
  now.setDate(now.getDate() - daysAgo);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}T00:00:00+09:00`;
}
