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

export interface ControlRoomActivityItem {
  id: string; // submission.id
  missionTitle: string;
  missionIcon: string | null;
  userDisplayName: string; // "홍길동 가족" 형식
  acornsAwarded: number; // submission.awarded_acorns (null → 0)
  submittedAt: string; // ISO
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
  activityFeed: ControlRoomActivityItem[]; // 최신순 30건
  leaderboard: ControlRoomLeaderItem[]; // TOP 10
  // Phase 3 widgets
  broadcast: ControlRoomBroadcastStat;
  heatmap: ControlRoomHeatmap; // K) 지난 24시간 시간대별 활동량
}
