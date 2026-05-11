// KST(한국 표준시) 일관 표시 유틸.
//
// 배경:
//   행사 시작/종료 시각이 timezone 없는 naive 문자열("2026-05-16T09:00:00")로
//   저장되어 있고, JS `new Date()` 는 그런 문자열을 UTC 로 해석합니다.
//   결과:
//     - Vercel(UTC) 서버 SSR 에서 d.getHours() → 9
//     - 한국(KST) 브라우저 클라이언트 컴포넌트에서 d.getHours() → 18
//   이로 인해 헤더(SSR-only)는 "09:00" 인데 타임라인(use client)은 "18:00" 같은
//   불일치가 발생.
//
// 정책: 표시 계층(SSR / 클라이언트 무관)에서 무조건 `timeZone: "Asia/Seoul"`
//   강제. 서버 timezone 환경과 무관하게 항상 KST 로 보임.

const KST = "Asia/Seoul";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Asia/Seoul 기준으로 Date 의 분리된 필드를 반환. SSR/CSR 결과 동일. */
function partsKst(d: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
} {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of f.formatToParts(d)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const wkLookup: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === "24" ? "00" : map.hour),
    minute: Number(map.minute),
    weekday: wkLookup[map.weekday] ?? 0,
  };
}

/** "HH:MM" 24h — 자정이면 빈 문자열 (시간 미지정으로 간주). */
export function fmtClockKst(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const { hour, minute } = partsKst(d);
  if (hour === 0 && minute === 0) return "";
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** 자정도 포함해서 강제로 "HH:MM" 반환. 타임라인 누적 표시처럼 0시 표기가 필요할 때. */
export function fmtClockKstAlways(iso: string | null | undefined): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  const { hour, minute } = partsKst(d);
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** Number(ms) → "HH:MM" — timeline-editor.tsx 의 fmtClock(ms) 대응. */
export function fmtClockKstFromMs(ms: number): string {
  if (!Number.isFinite(ms)) return "--:--";
  return fmtClockKstAlways(new Date(ms).toISOString());
}

/** "2026.05.16(토)" */
export function fmtDateKst(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const { year, month, day, weekday } = partsKst(d);
  return `${year}.${pad2(month)}.${pad2(day)}(${WEEKDAY[weekday]})`;
}

/** "2026.05.16 (토)" — 공백 한 칸 변형. */
export function fmtFullDateKst(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const { year, month, day, weekday } = partsKst(d);
  return `${year}.${pad2(month)}.${pad2(day)} (${WEEKDAY[weekday]})`;
}

/** "2026년 5월 16일 (토)" — 초대장처럼 풀라벨용. */
export function fmtKoreanLongDateKst(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const { year, month, day, weekday } = partsKst(d);
  return `${year}년 ${month}월 ${day}일 (${WEEKDAY[weekday]})`;
}

/** "오전 09:30" / "오후 02:15" — 시계 라벨. */
export function fmtAmPmClockKst(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const { hour, minute } = partsKst(d);
  if (hour === 0 && minute === 0) return "";
  const period = hour < 12 ? "오전" : "오후";
  const hh = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${period} ${pad2(hh)}:${pad2(minute)}`;
}

/**
 * datetime-local 입력값("2026-05-16T09:00") → DB 저장용 ISO with KST 오프셋.
 *  - 사용자가 폼에 입력한 시각은 KST 로 가정.
 *  - 출력: "2026-05-16T09:00:00+09:00" — JS new Date() 가 정확한 instant 로 파싱.
 *  - 빈 값/잘못된 값은 null.
 */
export function toIsoKstFromLocalInput(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const m = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${s ?? "00"}+09:00`;
}

/**
 * DB ISO → datetime-local input 값("2026-05-16T09:00"). KST 기준.
 *  - 폼 초기값 채울 때 사용.
 *  - 빈 값/잘못된 값은 빈 문자열.
 */
export function toLocalInputFromIsoKst(
  iso: string | null | undefined
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const { year, month, day, hour, minute } = partsKst(d);
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}`;
}
