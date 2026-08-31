// 기관 포털 홈(`/org/[orgId]`) 대시보드 타입 계약서.
// Frontend 에이전트가 이 파일을 import 해서 사용 — 필드명·형태 변경 금지.

import type { ProfileGroupSummary } from "./onboarding";

export type NextActionKind =
  | "PENDING_OLD"
  | "PROFILE"
  | "DRAFT_EVENT"
  | "NO_PARTICIPANTS"
  | "DOCUMENTS"
  | "BROADCAST_READY"
  | "NONE";

export interface OrgHomeNextAction {
  kind: NextActionKind;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string; // /org/{orgId}/... 등
  accent: "amber" | "pink" | "green" | "violet" | "zinc" | "cyan";
  progressPct?: number; // 프로필 완성도용
}

export interface OrgHomeDashboard {
  orgName: string;
  managerName: string;
  todayStats: {
    participantsTotal: number;
    participantsAddedToday: number;
    stampsToday: number;
    pendingReview: number;
  };
  profileCompleteness: {
    percent: number;
    done: number;
    total: number;
    /**
     * 그룹별 진행과 **아직 안 채운 항목 그 자체.**
     *
     * 예전엔 홈이 calcCompleteness 를 끝까지 돌려 놓고 위 숫자 셋만 남기고
     * 나머지를 버렸다. 그래서 "42%" 는 보여 주면서 무엇을 채우면 100% 가
     * 되는지는 화면 어디에도 없었다. 조회는 그대로다 — 버리던 걸 넘길 뿐.
     */
    groups: ProfileGroupSummary[];
  };
  /** 이 기관이 지금까지 만든 행사 수(상태 무관). 0 이면 홈이 준비 모드가 된다. */
  eventCount: number;
  nextAction: OrgHomeNextAction | null;
  controlRoomPreview: {
    fmLive: boolean;
    todayActive: number;
    todayStamps: number;
  };
  resources: {
    stampbooks: { total: number; live: number; draft: number };
    programs: { total: number; active: number };
    trails: number;
    partnerMissionCatalog: { total: number; newThisWeek: number };
  };
  fm: {
    mode: "LIVE" | "UPCOMING" | "NONE";
    sessionName: string | null;
    scheduledStart: string | null;
    scheduledEnd: string | null;
  };
  partnerNew: {
    partnerName: string;
    newPresetsThisWeek: number;
    newMissionsThisWeek: number;
  };
  documents: { submitted: number; required: number; overdue: number };
}
