// 단체 가위바위보 서바이벌 — 공용 타입 / 도메인 enum / 순수 헬퍼.
// DB migration 20260612000000_rps_survival.sql 과 1:1 대응.
// (rps_rooms / rps_rounds / rps_picks / rps_participants / rps_gifts)

export type RpsPick = "rock" | "paper" | "scissors";
export type RpsOutcome = "win" | "lose" | "tie";
export type RpsRoomStatus = "idle" | "running" | "finished" | "cancelled";
export type RpsGiftStatus = "pending" | "sent" | "failed";

/**
 * 라운드 종료 후 호스트에게 권장하는 다음 행동.
 *  - next_round : 살아남은 사람이 target 보다 많음 → 다음 라운드 진행.
 *  - revival    : 0 < winners < target → 직전 탈락자 부활전.
 *  - replay     : winners === 0 → 전원 패배·무승부, 같은 풀로 재시도.
 *  - finished   : winners === target → 게임 종료(자동 finalize 됨).
 */
export type RpsRoundRecommendation =
  | "next_round"
  | "revival"
  | "replay"
  | "finished";

/* -------------------------------------------------------------------------- */
/* Row 타입 — DB 컬럼과 1:1                                                    */
/* -------------------------------------------------------------------------- */

export interface RpsRoomRow {
  id: string;
  org_id: string;
  event_id: string | null;
  fm_session_id: string | null;
  host_user_id: string | null;
  title: string;
  target_survivors: number;
  status: RpsRoomStatus;
  current_round_no: number;
  pick_window_ms: number;
  /** 게임 시작 시 호스트가 미리 정한 선물 정보. 종료 시 자동으로 우승자 선물함에 등록. */
  gift_label: string | null;
  gift_image_url: string | null;
  gift_message: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface RpsRoundRow {
  id: string;
  room_id: string;
  round_no: number;
  starts_at: string;
  locked_at: string;
  host_pick: RpsPick | null;
  resolved_at: string | null;
  participants_count: number;
  survivors_count: number;
  is_revival: boolean;
}

export interface RpsPickRow {
  id: string;
  round_id: string;
  user_id: string;
  display_name: string;
  pick: RpsPick;
  picked_at: string;
  outcome: RpsOutcome | null;
}

export interface RpsParticipantRow {
  room_id: string;
  user_id: string;
  display_name: string;
  phone: string | null;
  joined_at: string;
  is_active: boolean;
  eliminated_at_round: number | null;
  finished_rank: number | null;
}

export interface RpsGiftRow {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  phone: string;
  gift_label: string;
  gift_url: string | null;
  message: string | null;
  sent_at: string | null;
  status: RpsGiftStatus;
  error: string | null;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/* 라벨 / 이모지                                                              */
/* -------------------------------------------------------------------------- */

export const PICK_LABELS: Record<RpsPick, string> = {
  rock: "바위",
  paper: "보",
  scissors: "가위",
};

export const PICK_EMOJIS: Record<RpsPick, string> = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

/* -------------------------------------------------------------------------- */
/* 순수 함수                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * 호스트의 손과 플레이어의 손을 비교해 플레이어 관점의 결과를 반환.
 *  - rock vs paper    → host:rock, player:paper → player win
 *  - paper vs scissors→ host:paper, player:scissors → player win
 *  - scissors vs rock → host:scissors, player:rock → player win
 *  - 같은 손이면 무승부(서바이벌 규칙상 무승부는 탈락 처리 — actions.ts 참조).
 */
export function comparePick(host: RpsPick, player: RpsPick): RpsOutcome {
  if (host === player) return "tie";
  if (
    (host === "rock" && player === "paper") ||
    (host === "paper" && player === "scissors") ||
    (host === "scissors" && player === "rock")
  ) {
    return "win";
  }
  return "lose";
}

/**
 * 라운드 결과 요약 — actions.resolveRoundAction 의 반환값 셰이프.
 */
export interface RpsRoundResolution {
  survivors: number;
  eliminated: number;
  recommendation: RpsRoundRecommendation;
}
