// 행사 워크스페이스의 5단계 — 순수 로직(서버/클라이언트 공용, DB 접근 없음).
//
// 왜 5단계인가:
//   예전에는 기관 상단 메뉴(6그룹)와 행사 상세 탭(9개)이 따로 있었고, 참가자·
//   스탬프북·프로그램·숲길·타임테이블·성과가 **양쪽에 다** 있었다. "참가자를
//   어디서 보지" 를 매번 다시 고민하게 되는 구조였다.
//
//   행사 하나를 준비해서 치르고 돌아보는 일은 실제로 한 줄로 흐른다:
//     내 행사 → 초대장 → 참가자 → 진행 → 결과
//   그래서 화면도 그 한 줄로 세운다. 상단 메뉴는 "어느 행사?" 만 고르고,
//   나머지는 전부 그 행사 안에서 끝난다.
//
// 하위 탭까지 여기서 정의하는 이유: 링크를 만드는 곳(행사 화면·메뉴·안내 배너)이
// 여러 군데라, 어디선가 오타가 나면 조용히 "개요" 로 떨어진다. 한 곳에서 정의하고
// 파서를 공유한다.

export type StepKey = "event" | "invite" | "people" | "run" | "result";

export type SubTab = {
  key: string;
  label: string;
};

export type Step = {
  key: StepKey;
  /** 화면에 걸 이름 — 초등학생도 읽는 말로. */
  label: string;
  icon: string;
  subs: SubTab[];
};

export const EVENT_STEPS: Step[] = [
  {
    key: "event",
    label: "내 행사",
    icon: "📋",
    subs: [
      { key: "overview", label: "개요" },
      { key: "timeline", label: "타임테이블" },
    ],
  },
  {
    key: "invite",
    label: "초대장",
    icon: "💌",
    subs: [
      { key: "content", label: "내용 쓰기" },
      { key: "share", label: "발행·공유" },
      { key: "templates", label: "템플릿" },
    ],
  },
  {
    key: "people",
    label: "참가자",
    icon: "🙋",
    subs: [
      { key: "applications", label: "접수" },
      { key: "roster", label: "명단" },
    ],
  },
  {
    key: "run",
    label: "진행",
    icon: "🎪",
    subs: [
      { key: "questpacks", label: "스탬프북" },
      { key: "programs", label: "프로그램" },
      { key: "trails", label: "숲길" },
      { key: "fm", label: "토리FM" },
      { key: "tools", label: "운영 도구" },
    ],
  },
  {
    key: "result",
    label: "결과",
    icon: "📊",
    subs: [
      { key: "analytics", label: "성과" },
      { key: "survey", label: "설문" },
    ],
  },
];

/**
 * 예전 ?tab= 값 → 새 단계/하위탭.
 *
 * 북마크·카톡으로 돌아다니는 링크와 코드 곳곳의 ?tab= 링크가 있다. 매핑을 두지
 * 않으면 그 링크들이 전부 조용히 "개요" 로 떨어진다.
 */
const LEGACY_TAB: Record<string, { step: StepKey; sub: string }> = {
  overview: { step: "event", sub: "overview" },
  timeline: { step: "event", sub: "timeline" },
  applications: { step: "people", sub: "applications" },
  participants: { step: "people", sub: "roster" },
  questpacks: { step: "run", sub: "questpacks" },
  programs: { step: "run", sub: "programs" },
  trails: { step: "run", sub: "trails" },
  fm: { step: "run", sub: "fm" },
  analytics: { step: "result", sub: "analytics" },
};

export type Resolved = { step: StepKey; sub: string };

/**
 * 주소창의 step/sub/tab 을 실제로 그릴 단계와 하위탭으로 정리한다.
 *
 * 규칙:
 *   1) step 이 유효하면 그걸 쓴다. sub 가 그 단계에 없는 값이면 첫 하위탭.
 *   2) step 이 없고 예전 tab 이 있으면 매핑해서 쓴다.
 *   3) 둘 다 없거나 모르는 값이면 첫 단계의 첫 하위탭.
 */
export function resolveStep(params: {
  step?: string | null;
  sub?: string | null;
  tab?: string | null;
}): Resolved {
  const step = EVENT_STEPS.find((s) => s.key === params.step);
  if (step) {
    const sub = step.subs.find((x) => x.key === params.sub);
    return { step: step.key, sub: (sub ?? step.subs[0]).key };
  }

  const legacy = params.tab ? LEGACY_TAB[params.tab] : undefined;
  if (legacy) return legacy;

  return { step: EVENT_STEPS[0].key, sub: EVENT_STEPS[0].subs[0].key };
}

/** 이 단계의 정의. 모르는 키면 첫 단계. */
export function stepOf(key: StepKey): Step {
  return EVENT_STEPS.find((s) => s.key === key) ?? EVENT_STEPS[0];
}

/** 행사 화면 링크. 첫 단계·첫 하위탭이면 쿼리 없이 깔끔한 주소로. */
export function stepHref(
  base: string,
  step: StepKey,
  sub?: string
): string {
  const s = stepOf(step);
  const subKey = s.subs.find((x) => x.key === sub)?.key ?? s.subs[0].key;
  const isFirst = step === EVENT_STEPS[0].key && subKey === s.subs[0].key;
  if (isFirst) return base;
  const needSub = subKey !== s.subs[0].key;
  return needSub
    ? `${base}?step=${step}&sub=${subKey}`
    : `${base}?step=${step}`;
}

/* -------------------------------------------------------------------------- */
/* 단계 상태 — 막대에 한 단어로 적는다                                          */
/* -------------------------------------------------------------------------- */

export type StepState = "done" | "current" | "todo";

export type StepStatus = {
  state: StepState;
  /** "발행됨", "12명 승인" 처럼 짧게. 없으면 아무것도 안 적는다. */
  hint?: string;
};

/**
 * 각 단계가 끝났는지 — 설명문 대신 이걸 보고 다음 할 일을 안다.
 *
 * "current" 를 따로 두지 않는 이유: 지금 보고 있는 단계는 화면이 이미 알려준다.
 * 여기서는 **끝났는지 아닌지**만 말한다. 초등학생이 봐도 ✓ 가 없으면 할 일이다.
 */
export function resolveStepStatuses(input: {
  hasName: boolean;
  hasSchedule: boolean;
  invitationReady: boolean;
  invitationPublished: boolean;
  pendingApplications: number;
  participantCount: number;
  questPackCount: number;
  surveyResponseCount: number;
  eventEnded: boolean;
}): Record<StepKey, StepStatus> {
  return {
    event: {
      state: input.hasName && input.hasSchedule ? "done" : "todo",
      hint: input.hasSchedule ? undefined : "날짜를 정해주세요",
    },
    invite: {
      state: input.invitationPublished
        ? "done"
        : input.invitationReady
          ? "current"
          : "todo",
      hint: input.invitationPublished
        ? "발행됨"
        : input.invitationReady
          ? "발행 전"
          : "내용 비어 있음",
    },
    people: {
      state: input.participantCount > 0 ? "done" : "todo",
      hint:
        input.pendingApplications > 0
          ? `${input.pendingApplications}명 대기`
          : input.participantCount > 0
            ? `${input.participantCount}명`
            : undefined,
    },
    run: {
      state: input.questPackCount > 0 ? "done" : "todo",
      hint: input.questPackCount > 0 ? "준비됨" : "스탬프북 없음",
    },
    result: {
      state: input.eventEnded ? "current" : "todo",
      hint:
        input.surveyResponseCount > 0
          ? `설문 ${input.surveyResponseCount}`
          : input.eventEnded
            ? "행사 종료"
            : undefined,
    },
  };
}
