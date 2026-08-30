// 초대장 문구의 기본값 — 순수 상수/함수, 서버·클라이언트 공용.
//
// 왜 따로 두나:
//   인사말을 비워두면 초대장은 "함께 즐거운 시간을 만들어요" 를 대신 보여준다.
//   폰 미리보기는 타이핑을 그대로 반영하는데, 이 기본값을 미리보기 쪽에 또 적으면
//   초대장 화면의 문구를 바꿀 때 한쪽만 바뀐다. 그러면 미리보기가 거짓말을 한다.
//   한 곳에서 정한다.

export const DEFAULT_INVITATION_MESSAGE = "함께 즐거운 시간을 만들어요";
export const FALLBACK_EVENT_TITLE = "(이름 없음)";

/** 인사말 — 비었으면 기본 문구. */
export function resolveInvitationMessage(
  value: string | null | undefined
): string {
  return value?.trim() || DEFAULT_INVITATION_MESSAGE;
}

/** 초대장 맨 위 행사명 — 비었으면 자리 표시. */
export function resolveInvitationTitle(
  value: string | null | undefined
): string {
  return value?.trim() || FALLBACK_EVENT_TITLE;
}

/**
 * 미리보기에서 타이핑 즉시 반영되는 글자들.
 *
 * 여기 없는 것(사진·주차장·입장시간·주최/주관)은 구조가 바뀌는 값이라 저장 후
 * 새로고침으로 반영한다. 한 행사에 한두 번 고치는 것들이다.
 */
export type InvitationPreviewFields = {
  name: string;
  message: string;
  body: string;
  dress: string;
  location: string;
  address: string;
};

export const INVITATION_PREVIEW_FIELDS = [
  "name",
  "message",
  "body",
  "dress",
  "location",
  "address",
] as const;

/**
 * 미리보기에서 이 덩어리를 보여줄지 — data-inv-if 값을 읽는다.
 *
 *   "body"              안내문이 차 있으면 보인다
 *   "location|address"  둘 중 하나만 차 있어도 보인다
 *   "location&address"  둘 다 차 있어야 보인다(가운데 ":" 구분자)
 *
 * 값이 비면 그 덩어리째 사라져야 한다 — 빈 "안내문" 카드가 남아 있으면 실제
 * 초대장에는 없는 것을 보여주는 셈이고, 그게 미리보기의 거짓말이다.
 */
export function isPreviewBlockVisible(
  expr: string,
  fields: Record<string, unknown>
): boolean {
  const keys = expr.split(/[|&]/).map((k) => k.trim());
  const filled = keys.map((k) => {
    const v = fields[k];
    return typeof v === "string" && v.trim() !== "";
  });
  return expr.includes("&") ? filled.every(Boolean) : filled.some(Boolean);
}

/** 부모(편집 폼) → iframe 으로 보내는 메시지. */
export const INVITATION_PREVIEW_MESSAGE = "inv-preview";
/** iframe → 부모. "이제 받을 준비가 됐다" (로드 타이밍을 부모가 못 맞춰도 된다). */
export const INVITATION_PREVIEW_READY = "inv-preview-ready";
