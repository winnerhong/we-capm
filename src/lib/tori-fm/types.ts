// 토리FM interactive layer 공용 타입 — chat / requests / hearts / polls / reactions.
// DB migration 20260519000000_tori_fm_interactive.sql 과 1:1 대응.

export type ChatSenderType = "USER" | "DJ" | "SYSTEM";
export type RequestStatus = "PENDING" | "APPROVED" | "PLAYED" | "HIDDEN";
export type PollStatus = "ACTIVE" | "ENDED" | "CANCELLED";
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

export interface FmRequestRow {
  id: string;
  session_id: string;
  user_id: string;
  song_title: string;
  artist: string | null;
  story: string | null;
  child_name: string | null;
  song_normalized: string;
  heart_count: number;
  status: RequestStatus;
  queue_id: string | null;
  created_at: string;
}

export interface FmPollOption {
  id: string;
  label: string;
  votes: number;
}

export interface FmPollRow {
  id: string;
  session_id: string;
  question: string;
  options: FmPollOption[];
  duration_sec: number;
  starts_at: string;
  ends_at: string;
  status: PollStatus;
  winner_option_id: string | null;
  created_at: string;
}

export interface FmPollVoteRow {
  id: string;
  poll_id: string;
  user_id: string;
  option_id: string;
  created_at: string;
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
