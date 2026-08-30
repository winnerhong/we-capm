// 기능 코드 상수 — 서버/클라이언트 공용, DB 접근 없음.
//
// 코드 문자열을 화면마다 직접 적으면 오타 하나가 조용한 버그가 된다:
// canUse(map, "TORIFM") 은 카탈로그에 없는 코드라 **항상 true** 로 통과한다
// (모르는 코드는 켜진 것으로 보는 규칙 — org-switches.ts 참고).
// 그래서 여기서만 정의하고 화면은 이 상수를 쓴다.
//
// 이름·아이콘·설명은 여기 두지 않는다 — platform_features 테이블이 원본이고,
// 지사 스위치판은 DB 에서 읽는다. 여기 있는 건 코드뿐이다.

export const F = {
  // 코어 — 끌 수 없다(행사·참가자·담당자·초대장·일정·설정·서류가 여기 묶인다)
  EVENT_BASIC: "EVENT_BASIC",
  PARTNER_DASHBOARD: "PARTNER_DASHBOARD",

  // 끌 수 있는 것
  STAMPBOOK: "STAMPBOOK",
  QR_STAMP: "QR_STAMP",
  TORI_FM: "TORI_FM",
  TRAIL: "TRAIL",
  MISSION_LIB: "MISSION_LIB",
  EVENT_TEMPLATE: "EVENT_TEMPLATE",
  ACORN: "ACORN",
  GIFT: "GIFT",
  BINGO: "BINGO",
  BROADCAST: "BROADCAST",
  TORITALK: "TORITALK",
  PHOTO: "PHOTO",
  SURVEY: "SURVEY",
  CONTROL_ROOM: "CONTROL_ROOM",
} as const;

export type FeatureCode = (typeof F)[keyof typeof F];

/**
 * 기관 스위치판에 **띄우지 않는** 기능.
 *
 * 끄면 기관 포털이 통째로 못 쓰게 되는 것들이다. 스위치를 달아 두면
 * 언젠가 누가 끄고, 그 기관은 로그인은 되는데 아무것도 없는 화면을 본다.
 * 애초에 스위치를 주지 않는 것이 맞다.
 */
export const ALWAYS_ON: readonly string[] = [
  F.EVENT_BASIC,
  F.PARTNER_DASHBOARD,
];

export function isAlwaysOn(code: string): boolean {
  return ALWAYS_ON.includes(code);
}
