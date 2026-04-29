// 사용자 선물함(user_gifts) — 공용 타입 / 라벨 / 순수 헬퍼.
// DB migration 20260613000000_user_gifts.sql 와 1:1 대응.
// 클라이언트 / 서버 양쪽에서 import 가능 (server-only import 금지).

export type GiftStatus = "pending" | "redeemed" | "expired" | "cancelled";

export type GiftSourceType =
  | "rps_winner"
  | "manual_grant"
  | "mission_reward"
  | "event_lottery";

/**
 * user_gifts row — DB 컬럼과 1:1.
 */
export interface UserGiftRow {
  id: string;
  user_id: string;
  org_id: string;
  source_type: GiftSourceType;
  source_id: string | null;
  display_name: string;
  gift_label: string;
  gift_url: string | null;
  message: string | null;
  coupon_code: string;
  status: GiftStatus;
  granted_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
  redeemed_by: string | null;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/* 라벨                                                                       */
/* -------------------------------------------------------------------------- */

export const GIFT_STATUS_LABELS: Record<GiftStatus, string> = {
  pending: "수령 가능",
  redeemed: "수령 완료",
  expired: "기간 만료",
  cancelled: "취소됨",
};

export const GIFT_SOURCE_LABELS: Record<GiftSourceType, string> = {
  rps_winner: "토리FM 가위바위보 우승",
  manual_grant: "관리자 직접 지급",
  mission_reward: "미션 완료 보상",
  event_lottery: "행사 추첨",
};

/**
 * SOURCE_LABELS — 짧은 라벨 (RPS 발급/SMS 등 헤드라인용).
 * GIFT_SOURCE_LABELS 는 상세 페이지용 풀버전 — 두 라벨을 함께 제공.
 */
export const SOURCE_LABELS: Record<GiftSourceType, string> = {
  rps_winner: "가위바위보 우승",
  manual_grant: "관리자 지급",
  mission_reward: "미션 보상",
  event_lottery: "행사 추첨",
};

/* -------------------------------------------------------------------------- */
/* 쿠폰 코드 상수                                                              */
/* -------------------------------------------------------------------------- */

/** 쿠폰 코드 길이 (8자리 영숫자). */
export const COUPON_CODE_LENGTH = 8;

/**
 * 쿠폰 코드 알파벳 — 영숫자에서 헷갈리는 0/O/1/I/L 제외.
 * (총 31자: A-Z 중 22자 + 2-9 중 8자)
 */
export const COUPON_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/* -------------------------------------------------------------------------- */
/* 순수 함수                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * 만료일 기준으로 expired 처리 대상인지 판정.
 * - DB status 가 'pending' 인데 expires_at < now 면 사실상 expired.
 * - 실제 status 갱신은 redeem 시점이나 배치에서.
 */
export function isGiftEffectivelyExpired(
  gift: UserGiftRow,
  now: Date = new Date()
): boolean {
  if (gift.status !== "pending") return false;
  return !!gift.expires_at && new Date(gift.expires_at) < now;
}

/**
 * UI 표시용 쿠폰 코드 포맷터.
 *  - 'KMA29R8K' → 'KMA2-9R8K'
 *  - 8자리가 아니면 원본 대문자 반환.
 */
export function formatCouponCode(code: string): string {
  if (!code) return "";
  const c = code.toUpperCase();
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/**
 * 사용자 입력 쿠폰 코드 정규화 — 매장 직원이 직접 입력 / QR 페이로드 파싱 후 사용.
 *  - 하이픈/공백/탭 제거
 *  - 대문자로 통일
 *  - 영숫자 외 문자 제거 (혹시 모를 한글 등)
 */
export function normalizeCouponCode(input: string): string {
  if (!input) return "";
  return input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}
