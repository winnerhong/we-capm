// 기관 포털 홈(`/org/[orgId]`) 대시보드 타입 계약서.
// Frontend 에이전트가 이 파일을 import 해서 사용 — 필드명·형태 변경 금지.

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
  profileCompleteness: { percent: number; done: number; total: number };
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
