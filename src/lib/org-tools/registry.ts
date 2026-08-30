// 기관 포털의 도구 목록 — **단 하나의 원본.**
//
// 예전에는 이 24줄이 _home/all-tools-card.tsx 안에 박혀 있었고, 그 파일에는
// 이런 경고가 붙어 있었다:
//
//     ⚠ 새 org 화면을 만들면 여기에도 한 줄 추가할 것.
//        안 그러면 또 "감춰진 기능"이 된다.
//
// 이제 상단 메뉴까지 같은 목록을 봐야 한다. 두 곳에 베껴 두면 저 경고가 두 배로
// 위험해진다 — 한쪽만 고쳐진 채로 "홈에는 있는데 상단에는 없는" 도구가 생긴다.
// 그래서 목록을 여기 하나로 옮기고, 세 화면이 전부 이걸 읽는다:
//
//     _home/all-tools-card.tsx        기관 홈 「모든 기능」
//     _nav/org-nav.tsx                상단 메뉴 (상단으로 올린 것만)
//     partner/… 기능 스위치판          지사가 켜고 끄는 곳
//
// 순수 모듈이다 — DB 도 React 도 없다. 서버·클라이언트 어디서나 import 한다.
//
// ⚠ key 는 **DB 에 저장된다**(org_feature_switches·partner_feature_defaults).
//   라벨이나 경로는 바꿔도 되지만 key 는 바꾸지 말 것. 바꾸면 지사가 해 둔
//   설정이 조용히 기본값으로 되돌아간다.

export type OrgToolGroup = "run" | "gift" | "make" | "manage";

export type OrgTool = {
  /** DB 에 저장되는 안정적 식별자. 절대 바꾸지 말 것. */
  key: string;
  label: string;
  icon: string;
  /** 기관 상대경로(/org/{orgId} 뒤). abs 와 둘 중 하나. */
  path?: string;
  /** 기관 밖 경로(전광판 등). orgId 가 뒤에 붙는다. */
  abs?: string;
  /** 프로젝터·TV 로 띄우는 화면 — 새 탭으로 연다. */
  newTab?: boolean;
  /**
   * 이 도구를 여닫는 기능 코드(lib/features/codes.ts).
   * 없으면 **코어** — 끌 수 없다. 끄면 기관 포털이 못 쓰게 되는 것들이다.
   * (상단에 올리는 것은 코어도 된다. 참가자·서류는 오히려 상단에 있을 만하다)
   */
  featureCode?: string;
  group: OrgToolGroup;
};

export const ORG_TOOL_GROUPS: Record<
  OrgToolGroup,
  { title: string; hint: string }
> = {
  run: { title: "행사 진행", hint: "행사 당일 손에 들고 쓰는 것" },
  gift: { title: "선물 · 쿠폰", hint: "무엇을 주고 어떻게 받게 할지" },
  make: { title: "만들기", hint: "행사 전에 미리 준비하는 것" },
  manage: { title: "관리", hint: "사람 · 서류 · 기관 설정" },
};

/** 화면에 그리는 순서 그대로. group 이 같은 것끼리 붙어 있어야 한다. */
export const ORG_TOOLS: OrgTool[] = [
  // ── 행사 진행 ──────────────────────────────────────────────
  { key: "control-room", label: "관제실", icon: "🛰", path: "/control-room", featureCode: "CONTROL_ROOM", group: "run" },
  { key: "control-room-tv", label: "관제실 TV 모드", icon: "📺", path: "/control-room/tv", featureCode: "CONTROL_ROOM", group: "run" },
  { key: "tori-fm", label: "토리FM 방송", icon: "🎙", path: "/tori-fm", featureCode: "TORI_FM", group: "run" },
  // 참가자가 보는 쪽 화면. 프로젝터에 띄우는 용도라 새 탭.
  { key: "fm-screen", label: "보이는 라디오(전광판)", icon: "📻", abs: "/screen/tori-fm/", newTab: true, featureCode: "TORI_FM", group: "run" },
  { key: "fm-stories", label: "사연 관리", icon: "💌", path: "/missions/radio", featureCode: "TORI_FM", group: "run" },
  { key: "mission-review", label: "미션 검수", icon: "🔍", path: "/missions/review", featureCode: "STAMPBOOK", group: "run" },
  { key: "broadcast", label: "돌발 미션 방송", icon: "⚡", path: "/missions/broadcast", featureCode: "BROADCAST", group: "run" },
  { key: "toritalk", label: "토리톡", icon: "💬", path: "/toritalk", featureCode: "TORITALK", group: "run" },
  { key: "bingo", label: "토리 빙고", icon: "🎯", path: "/bingo", featureCode: "BINGO", group: "run" },

  // ── 선물 · 쿠폰 ────────────────────────────────────────────
  { key: "gifts", label: "선물함", icon: "🎁", path: "/gifts", featureCode: "GIFT", group: "gift" },
  { key: "gift-redeem", label: "선물 수령 QR", icon: "📷", path: "/gifts/redeem", featureCode: "GIFT", group: "gift" },
  { key: "gift-templates", label: "쿠폰 만들기", icon: "🎟", path: "/gifts/templates", featureCode: "GIFT", group: "gift" },

  // ── 만들기 ────────────────────────────────────────────────
  { key: "quest-packs", label: "스탬프북", icon: "📚", path: "/quest-packs", featureCode: "STAMPBOOK", group: "make" },
  { key: "programs", label: "프로그램", icon: "🗂", path: "/programs", group: "make" },
  { key: "trails", label: "My 코스관리", icon: "🗺", path: "/trails", featureCode: "TRAIL", group: "make" },
  { key: "mission-catalog", label: "미션 카탈로그", icon: "🧩", path: "/missions/catalog", featureCode: "MISSION_LIB", group: "make" },
  { key: "event-templates", label: "행사 템플릿", icon: "🗓", path: "/event-templates", featureCode: "EVENT_TEMPLATE", group: "make" },
  { key: "invitation-templates", label: "초대장 템플릿", icon: "✉️", path: "/invitations/templates", group: "make" },
  { key: "program-templates", label: "프로그램 템플릿 둘러보기", icon: "🔎", path: "/templates", group: "make" },

  // ── 관리 ──────────────────────────────────────────────────
  { key: "users", label: "참가자", icon: "👨‍👩‍👧", path: "/users", group: "manage" },
  { key: "members", label: "담당자", icon: "🧑‍💼", path: "/members", group: "manage" },
  { key: "documents", label: "서류", icon: "📄", path: "/documents", group: "manage" },
  { key: "mission-stats", label: "미션 통계", icon: "📊", path: "/missions/stats", featureCode: "MISSION_LIB", group: "manage" },
  // 토리FM 표시명(우리 기관 라디오 이름)도 여기 있다.
  { key: "settings", label: "기관 설정", icon: "⚙️", path: "/settings", group: "manage" },
];

/** 그룹 순서 — 화면에 그리는 순서. */
export const ORG_TOOL_GROUP_ORDER: OrgToolGroup[] = [
  "run",
  "gift",
  "make",
  "manage",
];

const BY_KEY = new Map(ORG_TOOLS.map((t) => [t.key, t]));

export function toolByKey(key: string): OrgTool | undefined {
  return BY_KEY.get(key);
}

export function toolsInGroup(group: OrgToolGroup): OrgTool[] {
  return ORG_TOOLS.filter((t) => t.group === group);
}

/** 이 도구의 실제 주소. abs 인 것은 기관 밖이라 orgId 를 뒤에 붙인다. */
export function toolHref(tool: OrgTool, orgId: string): string {
  if (tool.abs) return `${tool.abs}${orgId}?tv=1`;
  return `/org/${orgId}${tool.path ?? ""}`;
}

/** 끌 수 없는 도구인가 — 기능 코드가 없으면 코어다. */
export function isCoreTool(tool: OrgTool): boolean {
  return !tool.featureCode;
}

/**
 * 상단 메뉴에 올릴 수 있는 최대 개수.
 *
 * 가로 한 줄이다. 로고·계정 메뉴가 양끝을 쓰고 [내 행사]·[공지사항]이 고정이라
 * 남는 자리가 이만큼이다. 안 막으면 lg 화면에서 가운데가 터지는데, 정작 그
 * 화면을 보는 건 지사가 아니라 기관이라 터진 걸 아무도 모른다.
 */
export const MAX_PINNED_TOOLS = 5;
