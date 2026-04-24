// Coupon domain types — shared between server actions and client forms.
// NOTE: 기존 coupons 테이블(2026-04-20 Phase C)은 affiliate 중심 스키마라
// coupon_type · code · auto_issue · per_user_limit · max_discount 는
// description에 JSON 메타로 부착해 저장합니다. Phase 2에서 정규 컬럼으로 분리 예정.

export type CouponType =
  | "WELCOME"
  | "FIRST_PURCHASE"
  | "REFERRAL"
  | "BIRTHDAY"
  | "REVIEW"
  | "WEEKDAY"
  | "GROUP"
  | "SEASONAL";

// DB에서는 PERCENT / AMOUNT / FREE 지원. UI는 PERCENT / FIXED 로 노출하고
// FIXED → AMOUNT 로 매핑해 저장합니다.
export type DiscountType = "PERCENT" | "FIXED";

export type CouponTypeDef = {
  key: CouponType;
  icon: string;
  label: string;
  desc: string;
  autoRule: string;
};

export const COUPON_TYPES: readonly CouponTypeDef[] = [
  {
    key: "WELCOME",
    icon: "👋",
    label: "신규 환영",
    desc: "가입하자마자 자동 발급",
    autoRule: "회원가입 시 자동",
  },
  {
    key: "FIRST_PURCHASE",
    icon: "🎉",
    label: "첫 예약",
    desc: "첫 예약 시 자동 적용",
    autoRule: "첫 예약 체크아웃",
  },
  {
    key: "REFERRAL",
    icon: "🎁",
    label: "추천인",
    desc: "친구 초대 시 둘 다 발급",
    autoRule: "추천 코드 가입 성공",
  },
  {
    key: "BIRTHDAY",
    icon: "🎂",
    label: "생일",
    desc: "생일 주간에 발급",
    autoRule: "생일 7일 전 자동",
  },
  {
    key: "REVIEW",
    icon: "⭐",
    label: "리뷰",
    desc: "리뷰 작성 시 발급",
    autoRule: "리뷰 승인 후",
  },
  {
    key: "WEEKDAY",
    icon: "📅",
    label: "평일",
    desc: "평일 예약에만 적용",
    autoRule: "평일 날짜 체크아웃",
  },
  {
    key: "GROUP",
    icon: "👨‍👩‍👧‍👦",
    label: "단체",
    desc: "N명 이상 예약 시",
    autoRule: "인원 조건 충족",
  },
  {
    key: "SEASONAL",
    icon: "🍃",
    label: "시즌",
    desc: "특정 기간 한정",
    autoRule: "기간 내 예약",
  },
] as const;

export const COUPON_TYPE_MAP: Record<CouponType, CouponTypeDef> = Object.fromEntries(
  COUPON_TYPES.map((t) => [t.key, t])
) as Record<CouponType, CouponTypeDef>;

// DB row (실제 컬럼)
export type CouponRow = {
  id: string;
  affiliate_name: string;
  affiliate_phone: string | null;
  title: string;
  description: string | null;
  discount_type: "PERCENT" | "AMOUNT" | "FREE";
  discount_value: number | null;
  min_amount: number | null;
  category: string | null;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  used_count: number;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED";
  created_at: string;
};

// description 뒤에 붙는 메타 JSON (Phase 1 우회 저장)
export type CouponMeta = {
  code?: string;
  coupon_type?: CouponType;
  auto_issue?: boolean;
  per_user_limit?: number;
  max_discount?: number;
};

// 화면에 노출할 병합 뷰
export type CouponView = CouponRow & {
  name: string;
  code: string;
  coupon_type: CouponType | null;
  auto_issue: boolean;
  per_user_limit: number | null;
  max_discount: number | null;
  plain_description: string; // meta 제거본
  is_active: boolean;
};

const META_MARK_BEGIN = "<!--meta:";
const META_MARK_END = "-->";

export function encodeDescription(plain: string | null, meta: CouponMeta): string {
  const base = (plain ?? "").trim();
  const safe: CouponMeta = {};
  if (meta.code) safe.code = meta.code;
  if (meta.coupon_type) safe.coupon_type = meta.coupon_type;
  if (typeof meta.auto_issue === "boolean") safe.auto_issue = meta.auto_issue;
  if (typeof meta.per_user_limit === "number") safe.per_user_limit = meta.per_user_limit;
  if (typeof meta.max_discount === "number") safe.max_discount = meta.max_discount;
  const payload = META_MARK_BEGIN + JSON.stringify(safe) + META_MARK_END;
  return base ? `${base}\n\n${payload}` : payload;
}

export function decodeDescription(raw: string | null): {
  plain: string;
  meta: CouponMeta;
} {
  if (!raw) return { plain: "", meta: {} };
  const startIdx = raw.indexOf(META_MARK_BEGIN);
  if (startIdx === -1) return { plain: raw.trim(), meta: {} };
  const endIdx = raw.indexOf(META_MARK_END, startIdx);
  if (endIdx === -1) return { plain: raw.trim(), meta: {} };
  const json = raw.slice(startIdx + META_MARK_BEGIN.length, endIdx);
  let meta: CouponMeta = {};
  try {
    meta = JSON.parse(json) as CouponMeta;
  } catch {
    meta = {};
  }
  const plain = (raw.slice(0, startIdx) + raw.slice(endIdx + META_MARK_END.length))
    .trim();
  return { plain, meta };
}

export function toCouponView(row: CouponRow): CouponView {
  const { plain, meta } = decodeDescription(row.description);
  return {
    ...row,
    name: row.title,
    code: meta.code ?? "",
    coupon_type: meta.coupon_type ?? null,
    auto_issue: meta.auto_issue ?? false,
    per_user_limit: typeof meta.per_user_limit === "number" ? meta.per_user_limit : null,
    max_discount: typeof meta.max_discount === "number" ? meta.max_discount : null,
    plain_description: plain,
    is_active: row.status === "ACTIVE",
  };
}

export function classifyCoupon(row: CouponRow): "active" | "expired" | "upcoming" | "inactive" {
  const now = Date.now();
  if (row.status === "PAUSED" || row.status === "DRAFT") return "inactive";
  if (row.valid_until && new Date(row.valid_until).getTime() < now) return "expired";
  if (row.status === "EXPIRED") return "expired";
  if (row.valid_from && new Date(row.valid_from).getTime() > now) return "upcoming";
  if (row.status === "ACTIVE") return "active";
  return "inactive";
}

export function formatDiscount(row: CouponRow): string {
  if (row.discount_type === "FREE") return "무료";
  const v = row.discount_value ?? 0;
  if (row.discount_type === "PERCENT") return `${v}%`;
  return `${v.toLocaleString("ko-KR")}원`;
}

export function randomCode(prefix = "TORIRO"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동 방지
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${out}`;
}
