// 행사 시각 입력의 순수 로직 — 새 행사 등록과 행사 편집이 **같은 것**을 쓴다.
//
// 왜 모았나:
//   두 폼이 시작 일시·기간 슬라이더·종료 계산을 각자 복붙해 갖고 있었다. 상수도
//   함수도 글자 하나까지 같았는데, 한쪽에만 입장가능시간이 붙으면서 갈라졌다.
//   "새 행사에는 왜 없지" 가 여기서 나왔다. 한 곳에 두면 갈라질 수가 없다.
//
// 시간대 주의:
//   여기서 다루는 문자열은 전부 datetime-local 모양("YYYY-MM-DDTHH:mm")이고
//   **KST 로 읽는다**. 서버로 보낼 때 "+09:00" 을 붙이는 건 부르는 쪽 몫이다 —
//   예전에 naive 문자열을 서버(UTC)가 그대로 해석해 9시간이 깎인 적이 있다.

export const MIN_DURATION = 5; // 5분
export const MAX_DURATION_MIN = 60 * 10; // 10시간
export const DEFAULT_DURATION = 60 * 2; // 2시간

export const DURATION_PRESETS: { label: string; mins: number }[] = [
  { label: "30분", mins: 30 },
  { label: "1시간", mins: 60 },
  { label: "2시간", mins: 120 },
  { label: "3시간", mins: 180 },
  { label: "4시간", mins: 240 },
  { label: "6시간", mins: 360 },
  { label: "8시간", mins: 480 },
  { label: "10시간", mins: 600 },
];

/** 0..23 */
export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
/** 0,5,10,…,55 — 5분 단위 */
export const MIN_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);

export function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Date → "YYYY-MM-DDTHH:mm" (datetime-local 호환, 로컬 시각 기준) */
export function toLocalIsoMinute(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** 분 → "2시간 50분". 0 분은 "0분". */
export function formatDuration(min: number): string {
  if (min < 60) return `${min}분`;
  const days = Math.floor(min / (60 * 24));
  const hours = Math.floor((min % (60 * 24)) / 60);
  const mins = min % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}일`);
  if (hours) parts.push(`${hours}시간`);
  if (mins) parts.push(`${mins}분`);
  return parts.join(" ");
}

/** 날짜·시·분 → "YYYY-MM-DDTHH:mm". 날짜가 없으면 빈 문자열. */
export function composeStartsAt(
  startDate: string,
  startHour: number,
  startMin: number
): string {
  if (!startDate) return "";
  return `${startDate}T${pad(startHour)}:${pad(startMin)}`;
}

/** 시작 + 기간(분) → 종료. 시작이 없거나 못 읽으면 빈 문자열. */
export function computeEndsAt(startsAt: string, durationMin: number): string {
  if (!startsAt) return "";
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "";
  return toLocalIsoMinute(new Date(start.getTime() + durationMin * 60 * 1000));
}
