// 초대장 입장가능시간 — 순수 로직 (서버/클라이언트 공용, DB 접근 없음).
//
// 예전에는 초대장 두 자리(히어로 배지 · 상세 행)가 각자 `20 * 60_000` 을 계산하고
// "(20분 전)" 문구도 각자 박아뒀다. 값이 설정 가능해지면 그 방식은 한쪽만 고쳐지는
// 종류의 버그를 부른다. 계산과 문구를 여기 한 곳에 모은다.
//
// 편집 폼도 같은 함수로 미리보기를 그린다 — 저장 전후가 어긋날 수 없게.

import { fmtAmPmClockKst } from "@/lib/datetime/kst";

/** 기본 입장 리드타임(분). DB 기본값·컬럼 미적용 폴백과 같은 값. */
export const DEFAULT_ENTRY_LEAD_MIN = 20;

/** 입력 상한 — 이보다 이르면 입장 안내가 아니라 별도 공지의 영역. */
export const MAX_ENTRY_LEAD_MIN = 240;

export type EntryTime = {
  /** 입장 가능 시각 (ISO). */
  at: string;
  /** 행사 시작 몇 분 전인지. */
  leadMin: number;
  /** "오전 09:20" */
  clock: string;
  /** "오전 09:20부터 (20분 전)" — 상세 행에 그대로 쓰는 문구. */
  label: string;
};

/**
 * 입장 가능 시각을 푼다. **숨겨야 하면 null** 을 돌려주고, 호출부는 그 자리를
 * 통째로 렌더하지 않는다.
 *
 * 숨김 조건:
 *   · leadMin 이 null / 0 / 음수 / 숫자가 아님 — 관리자가 "안 씀" 으로 둔 것
 *   · 행사 시작 시각이 없거나 깨진 값 — 기준이 없으면 계산할 수 없다
 *
 * @param leadMin `undefined` 는 **컬럼 미적용 배포 창**을 뜻한다. 이때는 기본값
 *   20분으로 폴백해 지금과 같은 화면을 유지한다(빈칸이 되지 않게).
 *   명시적인 `null` 은 "숨김" 이므로 폴백하지 않는다 — 둘을 구분하는 게 핵심이다.
 */
export function resolveEntryTime(
  startsAt: string | null | undefined,
  leadMin: number | null | undefined
): EntryTime | null {
  const effective =
    leadMin === undefined ? DEFAULT_ENTRY_LEAD_MIN : leadMin;

  if (
    effective === null ||
    typeof effective !== "number" ||
    !Number.isFinite(effective) ||
    effective <= 0
  ) {
    return null;
  }

  if (!startsAt) return null;
  const startMs = new Date(startsAt).getTime();
  if (!Number.isFinite(startMs)) return null;

  const lead = Math.min(MAX_ENTRY_LEAD_MIN, Math.floor(effective));
  const at = new Date(startMs - lead * 60_000).toISOString();
  const clock = fmtAmPmClockKst(at);
  // fmtAmPmClockKst 는 자정을 "시간 미지정" 으로 보고 빈 문자열을 준다.
  // 그 경우 문구가 "부터 (20분 전)" 으로 깨지므로 표시하지 않는다.
  if (!clock) return null;

  return { at, leadMin: lead, clock, label: `${clock}부터 (${lead}분 전)` };
}

/**
 * 폼 입력값("40" / "" / "0") → 저장값.
 * 빈 값·0·숫자가 아니면 null(숨김). 범위를 벗어나면 잘라낸다.
 */
export function parseEntryLeadInput(raw: string): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const n = Math.floor(Number(s));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(MAX_ENTRY_LEAD_MIN, n);
}
