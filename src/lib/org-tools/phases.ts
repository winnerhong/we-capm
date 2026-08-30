// 기관을 묶는 기준 — 순수 모듈(서버/클라이언트 공용, DB 도 server-only 도 없다).
//
// queries.ts 에 두었더니 목차(클라이언트 컴포넌트)가 그 파일을 import 하면서
// "server-only" 가 클라이언트 번들에 딸려 들어가 500 이 났다. 화면과 서버가 같이
// 쓰는 정의는 데이터 로더와 같은 파일에 두면 안 된다.

/**
 * **그 기관의 행사가 지금 어느 단계인가.**
 *
 * 기관 자체 상태(활성/휴면/정지/해지)로 묶지 않는 이유: 지사가 기능을 설정할 때
 * 궁금한 것은 "이 기관이 계약상 살아 있나" 가 아니라 "지금 행사를 돌리고 있나" 다.
 * 진행 중인 기관을 잘못 건드리면 그 순간 참가자 화면이 바뀐다.
 *
 * 여러 행사가 있으면 **가장 활발한 것**을 따른다(진행중 > 예정 > 종료 > 보관).
 */
export type OrgPhase = "LIVE" | "DRAFT" | "ENDED" | "ARCHIVED" | "NONE";

/**
 * 목차에 그리는 순서 — **행사가 흘러가는 순서** 그대로.
 *
 *   예정 → 진행중 → 종료 → 보관
 *
 * 처음엔 "급한 것부터"라며 진행중을 맨 위에 뒀는데, 그건 이 앱의 다른 화면과
 * 어긋난다. 행사 상태 토글(ORG_EVENT_STATUSES)도, 행사 목록의 상태 칩도 전부
 * 예정 → 진행중 → 종료 → 보관 순이다. 같은 네 단어가 화면마다 다른 순서로
 * 놓이면 볼 때마다 다시 읽어야 한다. 순서 자체가 외워지는 편이 낫다.
 */
export const ORG_PHASE_ORDER: OrgPhase[] = [
  "DRAFT",
  "LIVE",
  "ENDED",
  "ARCHIVED",
  "NONE",
];

export const ORG_PHASE_META: Record<
  OrgPhase,
  { label: string; dot: string; hint: string }
> = {
  LIVE: {
    label: "진행중",
    dot: "bg-emerald-500",
    hint: "지금 행사 중 — 바꾸면 참가자 화면이 바로 바뀝니다",
  },
  DRAFT: { label: "예정", dot: "bg-amber-400", hint: "행사 시작 전" },
  ENDED: { label: "종료", dot: "bg-zinc-400", hint: "행사가 끝났어요" },
  ARCHIVED: {
    label: "보관",
    dot: "bg-stone-400",
    hint: "보관된 행사만 있어요",
  },
  NONE: {
    label: "행사 없음",
    dot: "bg-[#D8D0C4]",
    hint: "아직 만든 행사가 없어요",
  },
};

export type ScopeOption = {
  orgId: string;
  orgName: string;
  /** 전체값과 다르게 설정한 항목 수. 0이면 전체값 그대로. */
  differsCount: number;
  phase: OrgPhase;
  /** 그 단계의 행사가 몇 개인지. */
  eventCount: number;
};
