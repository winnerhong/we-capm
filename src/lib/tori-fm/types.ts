// 토리FM interactive layer 공용 타입 — chat / requests / hearts / reactions.
// DB migration 20260519000000_tori_fm_interactive.sql 과 1:1 대응.
// (Poll 관련 타입은 투표 기능 제거로 삭제. 마이그레이션의 tori_fm_polls /
//  tori_fm_poll_votes 테이블은 보존되지만 더 이상 코드에서 참조하지 않음.)

export type ChatSenderType = "USER" | "DJ" | "SYSTEM";
/**
 * 신청곡 상태 머신.
 *  - PENDING  : 청취자 신청 직후 (호스트 모더레이션 대기)
 *  - APPROVED : (legacy) 과거 "승인" 액션 결과. 신규 흐름에서는 사용 안 함.
 *               기존 row 와의 호환을 위해 union 에 유지.
 *  - QUEUED   : 방송 대기 큐에 올림 (queue_position 순서로 재생 대기)
 *  - PLAYING  : 현재 NOW PLAYING (세션당 1개)
 *  - PLAYED   : 재생 완료
 *  - HIDDEN   : 부적절·중복 등 숨김
 */
export type RequestStatus =
  | "PENDING"
  | "APPROVED"
  | "QUEUED"
  | "PLAYING"
  | "PLAYED"
  | "HIDDEN";
// NOTE: "🌱" 는 기존 acorn 리액션을 대체 (acorn 이모지 제거 정책).
// DB 에 이미 기존 acorn 이모지로 저장된 row 가 있으면 별도 마이그레이션으로 "🌱" 또는 "🌲" 로 정규화해야 합니다.
export type ReactionEmoji = "❤" | "👏" | "🎉" | "🌲" | "🌱" | "😂";

export const REACTION_EMOJIS: ReactionEmoji[] = [
  "❤",
  "👏",
  "🎉",
  "🌲",
  "🌱",
  "😂",
];

export interface FmChatMessageRow {
  id: string;
  session_id: string;
  user_id: string | null;
  sender_type: ChatSenderType;
  sender_name: string;
  message: string;
  is_deleted: boolean;
  created_at: string;
}

/**
 * 신청 종류:
 *  - song_request : 신청곡 + 사연 (기존 동작, 작성자 표시)
 *  - story_only   : 사연만, 익명 표시 (곡명 없음)
 */
export type FmRequestKind = "song_request" | "story_only";

export interface FmRequestRow {
  id: string;
  session_id: string;
  user_id: string;
  /** story_only 일 때 NULL */
  song_title: string | null;
  artist: string | null;
  story: string | null;
  child_name: string | null;
  song_normalized: string;
  heart_count: number;
  status: RequestStatus;
  queue_id: string | null;
  /** QUEUED 일 때 큐 순서 (작을수록 먼저 재생). 그 외엔 NULL. */
  queue_position: number | null;
  kind: FmRequestKind;
  is_anonymous: boolean;
  /** 누적 boost 도토리 (default 0). HIDDEN/REJECTED 시 환불 후 0 리셋. */
  boost_amount: number;
  /** 마지막 boost 시각 — 'boost' 정렬 tiebreaker. NULL 이면 boost 이력 없음. */
  last_boost_at: string | null;
  created_at: string;
}

/**
 * boost 원장 한 줄.
 *  - CHARGE : 청취자가 boost 지불 시 insert
 *  - REFUND : HIDDEN/REJECTED 처리로 환불 시 insert (amount 는 양수, kind 로 구분)
 */
export interface FmRequestBoostRow {
  id: string;
  request_id: string;
  user_id: string;
  kind: "CHARGE" | "REFUND";
  amount: number;
  created_at: string;
}

/**
 * "{이름} 가족" 라벨 안전 부착 — 이미 "가족" 으로 끝나면 그대로 반환.
 * child_name 에 이미 가족 라벨이 저장된 경우 (예: "최시윤 가족")
 * "최시윤 가족 가족" 중복 출력 방지.
 */
export function withFamilySuffix(name: string | null | undefined): string {
  const v = (name ?? "").trim();
  if (!v) return "";
  return /가족\s*$/.test(v) ? v : `${v} 가족`;
}

/**
 * 익명 표시 라벨 — user_id 해시 4글자로 같은 사람의 여러 사연을 묶음.
 * "익명의 청취자 #A1B2" 형태.
 */
export function anonLabelFromUserId(userId: string): string {
  if (!userId) return "익명의 청취자";
  // 단순 해시 — user_id 의 hex/숫자 문자만 추출해서 4글자 코드 생성.
  // (uuid 라면 마지막 4글자 사용; 아니면 char code 합으로 fallback)
  const cleaned = userId.replace(/-/g, "");
  if (cleaned.length >= 4) {
    return `익명의 청취자 #${cleaned.slice(-4).toUpperCase()}`;
  }
  let sum = 0;
  for (let i = 0; i < userId.length; i++) sum += userId.charCodeAt(i);
  return `익명의 청취자 #${sum.toString(16).toUpperCase().slice(-4).padStart(4, "0")}`;
}

export interface FmReactionRow {
  id: string;
  session_id: string;
  user_id: string | null;
  emoji: ReactionEmoji;
  target_request_id: string | null;
  created_at: string;
}

export interface FmRequestHeartRow {
  id: string;
  request_id: string;
  user_id: string;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/* Ranking view rows                                                          */
/* -------------------------------------------------------------------------- */

export interface FmTopSongRow {
  session_id: string;
  song_title: string;
  artist: string;
  request_count: number;
  total_hearts: number;
}

export interface FmTopArtistRow {
  session_id: string;
  artist: string;
  request_count: number;
  total_hearts: number;
}

export interface FmTopStoryRow {
  request_id: string;
  session_id: string;
  user_id: string;
  song_title: string;
  artist: string | null;
  story: string | null;
  child_name: string | null;
  heart_count: number;
  parent_name: string | null;
}

export interface FmTopFamilyRow {
  session_id: string;
  user_id: string;
  parent_name: string | null;
  request_count: number;
  total_hearts: number;
}

export interface FmTopChatterRow {
  session_id: string;
  user_id: string | null;
  sender_name: string;
  message_count: number;
}
