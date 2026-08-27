// 참가 신청서 개인정보 동의 — 순수 로직 (서버/클라이언트 공용, DB 접근 없음).
//
// application-core.ts · entry-time.ts 와 같은 규약을 따른다: 부수효과 없음,
// 서버 액션이 최종 검증에 쓰고 클라이언트 폼이 같은 함수로 화면을 그린다.
// 문구가 두 벌로 갈라지지 않게 하는 것이 이 파일의 존재 이유.
//
// 동의는 [필수] 와 [선택] 두 갈래다:
//   필수 — 이 행사에 참가하려면 반드시 필요한 수집·이용 (법 제15조)
//   선택 — 계열사 제3자 제공 (법 제17조). 참가 조건으로 걸 수 없다
//          (제22조 제5항: 선택 항목 미동의를 이유로 서비스 제공을 거부하지 못한다)
// 그래서 이 파일에는 "선택 미동의" 를 막는 함수가 아예 없다.
//
// "공동이용" 이 아니라 "제3자 제공" 으로 쓰는 이유:
//   한국 개인정보보호법에는 일본 개인정보보호법 같은 '공동이용' 이라는 별도
//   법정 유형이 없다. 계열사가 같이 쓰는 것은 제17조 제3자 제공에 해당하고,
//   그래서 고지 항목도 제17조 제2항이 요구하는 5가지(제공받는 자 · 이용 목적 ·
//   제공 항목 · 보유 기간 · 거부권과 불이익)를 그대로 채웠다.

/** 문구 안에서 기관명으로 치환되는 토큰. */
export const CONSENT_ORG_TOKEN = "{기관명}";

/** 한 문구의 길이 상한 — 이보다 길면 신청서 안에서 읽히지 않는다. */
export const MAX_CONSENT_BODY_LENGTH = 4000;

/**
 * [필수] 기본 문구.
 *
 * DB 에 백필하지 않고 코드에 두는 이유: 백필해 두면 나중에 여기를 고쳐도 이미
 * 복사된 기관들은 옛 문구에 묶인다. NULL 로 두면 손대지 않은 기관은 항상 최신
 * 기본값을 따라온다.
 */
export const DEFAULT_CONSENT_BODY = `[개인정보 수집·이용 동의 (필수)]

「개인정보 보호법」 제15조에 따라 아래와 같이 안내드립니다.

1. 수집·이용 목적
   · 행사 참가 신청 접수 및 승인 여부 안내
   · 참가자 확인, 인원 파악, 안전관리, 비상 시 보호자 연락
   · 준비물·일정 변경 등 행사 운영에 필요한 안내

2. 수집 항목
   보호자 성명·휴대전화번호, 참가 아동의 성명 및 반명,
   동반 참가자의 관계와 인원
   ※ 주민등록번호 등 고유식별정보와 민감정보는 수집하지 않습니다.

3. 보유 및 이용 기간
   행사 종료 후 1년까지 보관한 뒤 지체 없이 파기합니다.
   관계 법령에 보존 의무가 있는 경우 해당 기간까지 보관합니다.
   동의를 철회하시면 위 기간 전이라도 지체 없이 파기합니다.

4. 동의를 거부할 권리 및 거부에 따른 불이익
   동의를 거부하실 권리가 있습니다. 다만 위 항목은 참가자 확인과
   안전관리에 반드시 필요하여, 동의하지 않으시면 행사 참가 신청이
   제한됩니다.

5. 만 14세 미만 아동의 개인정보
   참가 아동의 개인정보는 「개인정보 보호법」 제22조의2에 따라
   법정대리인(보호자)의 동의를 받아 수집하며, 보호자께서 이 신청서를
   제출하시는 것으로 그 동의에 갈음합니다.

6. 정보주체의 권리
   언제든지 개인정보의 열람·정정·삭제·처리정지를 요구하실 수 있습니다.
   ${CONSENT_ORG_TOKEN}으로 연락 주시면 지체 없이 조치해 드립니다.`;

/**
 * [선택] 계열사 제3자 제공 기본 문구.
 *
 * 제공받는 자를 회사명으로 특정한다 — "및 관련 계열사" 같은 포괄 표현은
 * 제17조가 요구하는 "제공받는 자" 특정에 미달해 지적 대상이 된다. 계열사가
 * 늘면 목록에 이름을 추가하고 다시 동의를 받는 것이 맞다.
 */
export const DEFAULT_CONSENT_OPTIONAL_BODY = `[개인정보 제3자 제공 동의 (선택)]

「개인정보 보호법」 제17조에 따라 아래와 같이 안내드립니다.
${CONSENT_ORG_TOKEN}은 아래 회사에 개인정보를 제공하여 함께 이용합니다.

1. 제공받는 자
   (주)위너그룹, 위너키즈스포츠, 위너기획, 위니키즈카페,
   (주)더위너케어, 더플레이위너
   ※ 제공받는 회사가 추가되면 미리 알려드리고 다시 동의를 받습니다.

2. 제공받는 자의 이용 목적
   · 계열사 프로그램·행사 정보 안내
   · 참가 이력 통합 관리 및 서비스 개선
   · 참가자 통계 분석

3. 제공하는 항목
   보호자 성명·휴대전화번호, 참가 아동의 성명 및 반명
   ※ 광고성 정보 전송은 별도 수신 동의를 받은 경우에만 이루어집니다.

4. 제공받는 자의 보유·이용 기간
   동의를 철회하시거나 회원 탈퇴하실 때까지 보유하며,
   그 즉시 지체 없이 파기합니다.

5. 동의를 거부할 권리 및 거부에 따른 불이익
   동의를 거부하실 수 있으며, 거부하시더라도 행사 참가 신청과 승인에
   어떠한 불이익도 없습니다.

6. 동의 철회 방법
   ${CONSENT_ORG_TOKEN}에 연락하시면 언제든지 동의를 철회하실 수 있습니다.`;

/** 화면에 그대로 뿌릴 수 있는, 치환까지 끝난 문구 한 벌. */
export type OrgConsent = {
  required: string;
  /** 선택 항목을 끈 기관은 null — 신청서에 줄 자체를 띄우지 않는다. */
  optional: string | null;
};

/** partner_orgs 의 동의 관련 컬럼. 미적용 배포 창에서는 전부 undefined 다. */
export type OrgConsentSettings = {
  application_consent_body?: string | null;
  application_consent_optional_body?: string | null;
  application_consent_optional_enabled?: boolean | null;
  application_consent_updated_at?: string | null;
};

/**
 * 동의 문구를 그리는 데 필요한 전부 — 설정 + {기관명} 에 넣을 이름.
 *
 * 이름을 따로 조회하지 않는 이유: 둘 다 partner_orgs 의 **같은 행**에 있다.
 * 예전에는 loadOrgApplicationConsent 와 loadOrgNameById 를 나란히 불러
 * 같은 행을 두 번 왕복했다. 초대장처럼 왕복 하나가 그대로 체감 지연이 되는
 * 화면에서는 그 한 번이 아깝다.
 */
export type OrgConsentContext = OrgConsentSettings & { org_name: string };

/** 신청서에 저장되는 동의 스냅샷 — 기관이 문구를 고쳐도 바뀌지 않는다. */
export type ConsentSnapshot = { required: string; optional: string | null };

export type ConsentCheck = { ok: true } | { ok: false; message: string };

/** {기관명} 치환. 기관명이 비면 무난한 대체어를 쓴다(빈칸이 남지 않게). */
export function renderConsentBody(template: string, orgName: string): string {
  const name = (orgName ?? "").trim() || "소속 기관";
  return (template ?? "").split(CONSENT_ORG_TOKEN).join(name);
}

/**
 * DB row → 실제로 화면에 뿌릴 문구.
 *
 * `undefined`(컬럼 미적용) 와 `null`(기관이 지운 적 없음) 을 구분하지 않는 이유:
 * 둘 다 "기관이 문구를 정하지 않았다" 로 귀결돼 기본값이 정답이다. 동의문은
 * 입장시간과 달라서 "안 씀" 이라는 선택지가 없다 — 필수 문구는 언제나 있어야 한다.
 *
 * 선택 항목만 다르다. `optional_enabled === false` 는 기관이 명시적으로 끈 것이라
 * 존중해서 null 을 돌려주고, 호출부는 그 줄을 통째로 렌더하지 않는다.
 */
export function resolveOrgConsent(
  row: OrgConsentSettings | null | undefined,
  orgName: string
): OrgConsent {
  const requiredRaw = trimmedOrNull(row?.application_consent_body);
  const required = renderConsentBody(
    requiredRaw ?? DEFAULT_CONSENT_BODY,
    orgName
  );

  if (row?.application_consent_optional_enabled === false) {
    return { required, optional: null };
  }

  const optionalRaw = trimmedOrNull(row?.application_consent_optional_body);
  return {
    required,
    optional: renderConsentBody(
      optionalRaw ?? DEFAULT_CONSENT_OPTIONAL_BODY,
      orgName
    ),
  };
}

/** 관리자 저장 검증 — 빈 문구·길이 초과 차단. */
export function validateConsentBodies(input: {
  body: string;
  optionalBody: string;
  optionalEnabled: boolean;
}): ConsentCheck {
  const body = (input.body ?? "").trim();
  if (!body) {
    return {
      ok: false,
      message: "필수 동의 문구는 비워둘 수 없어요 (법적으로 필요한 안내예요)",
    };
  }
  if (body.length > MAX_CONSENT_BODY_LENGTH) {
    return {
      ok: false,
      message: `필수 동의 문구가 너무 길어요 (${MAX_CONSENT_BODY_LENGTH}자까지)`,
    };
  }

  // 선택 항목을 껐다면 그 문구는 검사하지 않는다 — 쓰이지 않는 글이다.
  if (input.optionalEnabled) {
    const opt = (input.optionalBody ?? "").trim();
    if (!opt) {
      return {
        ok: false,
        message:
          "선택 동의를 켜두셨는데 문구가 비어 있어요. 문구를 넣거나 선택 동의를 꺼주세요",
      };
    }
    if (opt.length > MAX_CONSENT_BODY_LENGTH) {
      return {
        ok: false,
        message: `선택 동의 문구가 너무 길어요 (${MAX_CONSENT_BODY_LENGTH}자까지)`,
      };
    }
  }

  return { ok: true };
}

/**
 * 제출 검증 — 필수 동의를 안 했으면 막는다.
 * 클라이언트가 이미 버튼을 잠그지만, 서버 액션이 링크만 알면 호출 가능한
 * 경로라 같은 함수로 다시 확인한다.
 */
export function checkConsentAgreed(agreed: boolean): ConsentCheck {
  if (agreed === true) return { ok: true };
  return {
    ok: false,
    message: "개인정보 수집·이용 동의(필수)에 체크해 주세요",
  };
}

/**
 * 화면에 보인 문구와 서버의 현재 문구가 같은지 대조하는 지문 (FNV-1a 32bit).
 *
 * 신청자가 문구를 읽는 동안 관리자가 문구를 고치는 드문 경우가 있다. 그때
 * 그대로 저장하면 **읽지 않은 문구에 동의한 기록**이 남는다 — 동의 기록으로서
 * 가장 나쁜 상태다. 지문이 다르면 제출을 되돌리고 새 문구를 다시 보여준다.
 *
 * 암호학적 용도가 아니다(위조 방지가 아니라 변경 감지). 서버가 스냅샷을 직접
 * 만들기 때문에 클라이언트가 지문을 위조해도 저장되는 내용은 바뀌지 않는다.
 */
export function consentFingerprint(consent: OrgConsent): string {
  const payload = `${consent.required} ${consent.optional ?? ""}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    // FNV prime 16777619 — Math.imul 로 32bit 곱을 유지한다.
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** jsonb → 타입 확정된 스냅샷. 깨진 값이면 null(= 기록 없음)로 본다. */
export function parseConsentSnapshot(raw: unknown): ConsentSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const required = typeof o.required === "string" ? o.required : "";
  if (!required) return null;
  const optional = typeof o.optional === "string" ? o.optional : null;
  return { required, optional };
}

function trimmedOrNull(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length > 0 ? s : null;
}
