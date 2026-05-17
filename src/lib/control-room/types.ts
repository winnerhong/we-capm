// 기관 "관제실(Control Room)" 대시보드 타입 계약서.
// Frontend 에이전트가 이 이름을 import 해서 씁니다 — 필드명/형태 변경 금지.

export interface ControlRoomFmRequest {
  id: string;
  songTitle: string;
  artist: string | null;
  childName: string | null;
  heartCount: number;
  status: string; // 'PENDING' | 'APPROVED' | 'PLAYED' | 'HIDDEN'
  createdAt: string;
}

export interface ControlRoomFmSessionSummary {
  id: string;
  name: string;
  isLive: boolean;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface ControlRoomChatMessage {
  id: string;
  roomName: string;
  eventName: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export interface ControlRoomPendingItem {
  id: string;
  missionTitle: string;
  submitterName: string;
  submittedAt: string;
  packName: string | null;
}

export interface ControlRoomStamps {
  submissionsToday: number; // 오늘 APPROVED + AUTO_APPROVED 제출 수
  avgPackCompletePct: number; // LIVE 상태 quest pack 들 평균 완료% (0~100 정수)
  participantsSubmittedToday: number; // 오늘 1건 이상 제출한 distinct user_id
}

export interface ControlRoomAcorns {
  awardedToday: number; // 오늘 amount > 0 합계
  awardedAllTime: number; // 전체 기간 amount > 0 합계
  perHourLast6h: number; // 최근 6시간 amount > 0 합 / 6 (반올림)
}

export interface ControlRoomLeaderItem {
  userId: string;
  displayName: string; // "홍길동 가족"
  childrenLabel: string | null; // 자녀 이름들 · 연결 (없으면 null)
  totalAcorns: number; // 기간 내 누적 (amount > 0)
  rank: number; // 1~10
}

export interface ControlRoomBroadcastStat {
  sentLast24h: number; // 지난 24시간 발송(fires_at) 건수
  avgResponseRatePct: number; // 지난 24h 평균 응답률 (응답/발송 대상, %, 0~100 정수)
  avgResponseTimeMinutes: number | null; // 평균 응답 시간(분). 데이터 없으면 null
  lastSentAt: string | null; // 가장 최근 발송 ISO
  lastSentTitle: string | null; // 가장 최근 발송 제목 (org_missions.title)
}

export interface ControlRoomHeatmapHour {
  hourLabel: string; // "14시" 형식
  count: number;
  intensity: number; // 0~1 (해당 기간 max 대비 비율, 소수 2자리 반올림)
}

export interface ControlRoomHeatmap {
  hours: ControlRoomHeatmapHour[]; // 정확히 24개. 인덱스 0=현재시-23h, 23=현재시
  peakHour: string | null; // 가장 많은 시간의 hourLabel, 전부 0건이면 null
  totalLast24h: number;
}

/**
 * Phase 1 관제 — 실시간 사진 월.
 * 최근 제출된 사진 미션 결과를 갤러리로 모아 본다.
 */
export interface ControlRoomPhotoItem {
  submissionId: string;
  /** 어떤 미션에서 올라온 사진인지 — 미션별 필터링에 사용. */
  missionId: string;
  /** 미션 종류 — PHOTO/PHOTO_APPROVAL/COOP/BROADCAST */
  missionKind: string;
  /** 스템프북 순서 — 미션 칩 정렬 키. 같으면 missionId tiebreaker. */
  missionDisplayOrder: number;
  url: string;
  missionTitle: string;
  missionIcon: string | null;
  userDisplayName: string;
  submittedAt: string;
  status: string; // SUBMITTED | AUTO_APPROVED | APPROVED | PENDING_REVIEW
}

/**
 * Phase 1 관제 — 미션별 진행 현황.
 * 미션마다 "몇 명 완료했는지 / 검수 대기 / 미시작" 한눈에.
 */
export interface ControlRoomMissionProgressRow {
  missionId: string;
  title: string;
  icon: string | null;
  kind: string; // PHOTO | QR_QUIZ | TREASURE | ...
  completedCount: number; // AUTO_APPROVED + APPROVED
  pendingCount: number; // SUBMITTED + PENDING_REVIEW
  rejectedCount: number;
  totalParticipants: number; // org 활성 참가자 수 (분모)
  completionPct: number; // completed / total * 100 (정수)
}

/**
 * Phase 1 관제 — 가족 × 미션 진행 매트릭스.
 * perMission 의 각 셀: "DONE" | "WAITING" | "REJECTED" | null(미시작).
 */
export type FamilyMissionCellState =
  | "DONE"
  | "WAITING"
  | "REJECTED"
  | null;

export interface ControlRoomFamilyRow {
  userId: string;
  displayName: string;
  totalAcorns: number;
  doneCount: number;
  /** missionId → 셀 상태. 미션 목록은 missionsForGrid 와 동일 순서. */
  perMission: Record<string, FamilyMissionCellState>;
  /** 자녀들의 반명 (unique). 형제가 다른 반이면 여러 개. 없으면 빈 배열. */
  classNames: string[];
  /**
   * 자녀별 (이름, 반) 매핑 — enrolled 만, created_at ASC 순.
   * 형제가 다른 반일 때 "파랑반 김다민, 초록2반 김다나" 식 라벨에 사용.
   * 자녀 메타 없으면 빈 배열.
   */
  children: Array<{ name: string; className: string | null }>;
}

export interface ControlRoomFamilyGrid {
  /** 그리드 컬럼 — org 의 active missions, 표시 순서 보장. */
  missions: Array<{ id: string; title: string; icon: string | null }>;
  rows: ControlRoomFamilyRow[];
}

/**
 * Phase 2 관제 — 라이브 미션 수행 현황.
 *  - "지금 N분째 OOO 미션 진행 중인 가족" 표시용.
 *  - last_seen_at 이 최근 3분 이내이고 completed_submission_id IS NULL.
 */
export interface ControlRoomLiveAttempt {
  attemptId: string;
  userId: string;
  userDisplayName: string;
  missionId: string;
  missionTitle: string;
  missionIcon: string | null;
  missionKind: string;
  openedAt: string;
  lastSeenAt: string;
  /** 클라이언트 표시용 — 서버 now() 기준 경과 분 (반올림). */
  elapsedMinutes: number;
  /** opened_at 이 stuckThreshold 보다 오래됐고 last_seen 신선하면 true. */
  stuck: boolean;
}

export interface ControlRoomLive {
  attempts: ControlRoomLiveAttempt[]; // active, 최신 last_seen 순
  /** 정체 의심 — opened_at >= STUCK_MIN 이상 + last_seen 신선. */
  stuckCount: number;
  /** 활동 중인 distinct user 수. */
  activeFamilies: number;
}

export interface ControlRoomSnapshot {
  orgName: string;
  serverNowIso: string;
  liveEventCount: number;
  liveEventNames: string[];
  todayActiveParticipants: number;
  totalParticipants: number;
  fm: {
    session: ControlRoomFmSessionSummary | null;
    recentRequests: ControlRoomFmRequest[]; // 최신순 상위 8개
    totalHeartsToday: number;
    listenersPresence: number | null; // MVP 는 항상 null
  };
  chat: ControlRoomChatMessage[]; // 최신순 상위 20개
  pending: {
    total: number;
    oldestWaitingMinutes: number | null;
    items: ControlRoomPendingItem[]; // 오래된 순 상위 10개
  };
  // Phase 2 widgets
  stamps: ControlRoomStamps;
  acorns: ControlRoomAcorns;
  leaderboard: ControlRoomLeaderItem[]; // TOP 10
  // Phase 3 widgets
  broadcast: ControlRoomBroadcastStat;
  heatmap: ControlRoomHeatmap; // K) 지난 24시간 시간대별 활동량
  // Phase 4 widgets — 실시간 관제 (사진 월, 미션별 진행, 가족 매트릭스)
  photoWall: ControlRoomPhotoItem[]; // 최근 30장
  missionProgress: ControlRoomMissionProgressRow[]; // 활성 미션 전부
  familyGrid: ControlRoomFamilyGrid;
  // Phase 2 — 라이브 수행 telemetry
  live: ControlRoomLive;
  /** COOP 미션 세션 현황 (대기/매칭/완료 등) */
  coopSessions: ControlRoomCoopSession[];
}

/**
 * Phase 4 관제 — COOP(짝꿍) 세션 한 건.
 * 사진월처럼 그리드 + 필터 + 페이지네이션으로 보기 위한 enriched 형태.
 */
export interface ControlRoomCoopSession {
  sessionId: string;
  missionId: string;
  missionTitle: string;
  missionIcon: string | null;
  missionDisplayOrder: number;
  pairCode: string;
  state: string; // WAITING | PAIRED | A_DONE | B_DONE | COMPLETED | EXPIRED | CANCELLED
  initiatorDisplayName: string;
  partnerDisplayName: string | null;
  sharedPhotoUrl: string | null;
  expiresAt: string;
  pairedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
