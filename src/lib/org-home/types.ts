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

export interface OrgHomeRecentParticipant {
  userId: string;
  displayName: string; // "{parent_name} 가족" or "보호자 가족"
  joinedAt: string;
  avatarInitial: string; // parent_name 첫 글자 또는 "🌱"
}

export interface OrgHomeNextAction {
  kind: NextActionKind;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string; // /org/{orgId}/... 등
  accent: "amber" | "pink" | "green" | "violet" | "zinc" | "cyan";
  progressPct?: number; // 프로필 완성도용
}

export interface OrgHomeLiveEvent {
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  participantCount: number;
  questPackCount: number;
  programCount: number;
  fmSessionCount: number;
  activityRatePct: number; // 오늘 제출한 참가자 / 전체 × 100, 정수
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
  liveEvent: OrgHomeLiveEvent | null;
  recentParticipants: OrgHomeRecentParticipant[]; // 최신 5명
  thisWeekSubmissions: number;
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
