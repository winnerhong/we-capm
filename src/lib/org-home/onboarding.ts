// 처음 온 기관이 밟는 세 걸음 — 순수 모듈(DB·React 없음).
//
// 왜 필요했나:
//   홈의 「프로필 완성도 42%」 카드는 버튼이 /settings 하나뿐이었다. 그런데 12항목
//   중 5개는 서류 업로드고, 그 다섯은 각각 주소가 다르다
//   (/documents/upload?type=BANKBOOK …). 그래서 설정을 아무리 성실히 채워도
//   7/12 = 58% 에서 멈췄다. 길이 아주 없진 않았다 — 설정 페이지 맨 밑
//   (657줄 중 614줄) 미완료 목록에서 갈 수 있었다. 찾아낸 사람만 100% 가 됐다.
//
// 그래서 홈이 **남은 항목 자체를** 보여준다. 조회는 안 는다 — 홈은 이미
// calcCompleteness 를 끝까지 돌려 놓고 숫자 셋만 남기고 버리고 있었다.

import type { ProfileField } from "@/lib/profile-completeness/types";

export type OnboardingStepKey = "info" | "docs" | "event";

/** 홈이 받는 그룹 요약 — CompletenessResult["groups"] 의 원소와 같은 모양. */
export type ProfileGroupSummary = {
  id: string;
  label: string;
  icon: string;
  completed: number;
  total: number;
  percent: number;
  missing: ProfileField[];
};

export type OnboardingStep = {
  key: OnboardingStepKey;
  label: string;
  icon: string;
  /** 이 걸음이 왜 필요한지 한 줄. */
  hint: string;
  completed: number;
  total: number;
  done: boolean;
  /** 아직 안 채운 항목 — 눌러서 바로 가는 줄이 된다. */
  missing: ProfileField[];
  /** 채울 항목이 아니라 한 번 누르면 되는 걸음(첫 행사)의 버튼. */
  cta?: { label: string; href: string };
};

/**
 * 프로필 스키마의 그룹 셋(basic·business·docs)을 두 걸음으로 접는다.
 *
 * basic 과 business 를 나누지 않는 이유 — 원장님 입장에서 둘 다 "설정 화면에
 * 적어 넣는 것" 한 가지다. 화면이 같은데 걸음을 둘로 쪼개면 같은 데를 두 번
 * 다녀오는 기분이 든다. 반대로 서류는 화면도 다르고 지사 승인까지 기다려야
 * 하므로 반드시 따로 세운다.
 */
const INFO_GROUP_IDS = ["basic", "business"];
const DOC_GROUP_IDS = ["docs"];

function fold(
  groups: ProfileGroupSummary[],
  ids: string[]
): { completed: number; total: number; missing: ProfileField[] } {
  let completed = 0;
  let total = 0;
  const missing: ProfileField[] = [];
  // 스키마 순서를 그대로 따른다 — 화면에 뜨는 차례가 매번 같아야 한다.
  for (const id of ids) {
    const g = groups.find((x) => x.id === id);
    if (!g) continue;
    completed += g.completed;
    total += g.total;
    missing.push(...g.missing);
  }
  return { completed, total, missing };
}

/**
 * 준비 모드인가 — **아직 행사를 한 번도 안 열었나** 하나로 정한다.
 *
 * 완성도를 조건에 넣지 않는 이유: 서류 승인은 지사가 하는 일이라 기관이
 * 아무리 서둘러도 며칠 걸린다. 완성도를 걸면 행사를 열 번 치른 기관이
 * 지사 결재 하나 때문에 영영 "준비 중" 화면을 보게 된다.
 */
export function isOnboarding(eventCount: number): boolean {
  return eventCount === 0;
}

export function buildOnboardingSteps(
  orgId: string,
  groups: ProfileGroupSummary[],
  eventCount: number
): OnboardingStep[] {
  const info = fold(groups, INFO_GROUP_IDS);
  const docs = fold(groups, DOC_GROUP_IDS);

  return [
    {
      key: "info",
      label: "기관 정보",
      icon: "🌿",
      hint: "초대장과 서류에 그대로 들어가요",
      completed: info.completed,
      total: info.total,
      done: info.total > 0 && info.completed === info.total,
      missing: info.missing,
    },
    {
      key: "docs",
      label: "필수 서류",
      icon: "📄",
      hint: "올리면 지사가 확인해요",
      completed: docs.completed,
      total: docs.total,
      done: docs.total > 0 && docs.completed === docs.total,
      missing: docs.missing,
    },
    {
      key: "event",
      label: "첫 행사 만들기",
      icon: "🎪",
      hint: "서류 승인을 기다리는 동안 미리 만들어 둬도 돼요",
      completed: eventCount > 0 ? 1 : 0,
      total: 1,
      done: eventCount > 0,
      missing: [],
      cta: { label: "새 행사 만들기", href: `/org/${orgId}/events/new` },
    },
  ];
}

/**
 * 지금 손대야 할 걸음 — 첫 미완료. 다 끝났으면 -1.
 *
 * 앞 걸음이 안 끝났어도 뒤 걸음을 **막지는 않는다.** 여기서 정하는 건 어느
 * 걸음을 펼쳐 둘지뿐이다.
 */
export function currentStepIndex(steps: OnboardingStep[]): number {
  return steps.findIndex((s) => !s.done);
}

/** 접힌 한 줄에 쓸 요약 — "7/12 · 필수 서류 4개 남음". */
export function summarize(steps: OnboardingStep[]): {
  completed: number;
  total: number;
  nextLabel: string | null;
  nextRemaining: number;
} {
  let completed = 0;
  let total = 0;
  for (const s of steps) {
    completed += s.completed;
    total += s.total;
  }
  const idx = currentStepIndex(steps);
  const next = idx >= 0 ? steps[idx] : null;
  return {
    completed,
    total,
    nextLabel: next ? next.label : null,
    nextRemaining: next ? next.total - next.completed : 0,
  };
}
