/**
 * 본사가 제공하는 기능(capability) 카탈로그 + 지사 보유(grant) 타입
 * - DB: platform_features / partner_feature_grants / platform_feature_audit
 * - 마이그레이션: supabase/migrations/20260619000000_platform_features.sql
 */

export const PACK_TIERS = ["BASIC", "OPTIONAL", "HIDDEN"] as const;
export type PackTier = (typeof PACK_TIERS)[number];

export const FEATURE_STATUSES = ["DRAFT", "BETA", "GA", "DEPRECATED"] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export const FEATURE_CATEGORIES = [
  "BROADCAST",
  "MISSION",
  "CONTENT",
  "ANALYTICS",
  "MARKETING",
  "CORE",
  "OTHER",
] as const;
export type FeatureCategory = (typeof FEATURE_CATEGORIES)[number];

export const GRANT_SOURCES = [
  "DEFAULT_PACK",
  "ADMIN_GRANT",
  "PURCHASE",
  "TRIAL",
  "GRANDFATHERED",
] as const;
export type GrantSource = (typeof GRANT_SOURCES)[number];

export type PlatformFeature = {
  code: string;
  name: string;
  short_desc: string | null;
  long_desc: string | null;
  icon: string | null;
  cover_image_url: string | null;
  category: FeatureCategory;
  pack_tier: PackTier;
  status: FeatureStatus;
  setup_fee_krw: number;
  monthly_fee_krw: number;
  trial_days: number;
  requires_features: string[];
  sort_order: number;
  released_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PartnerFeatureGrant = {
  id: string;
  partner_id: string;
  feature_code: string;
  source: GrantSource;
  status: "ACTIVE" | "REVOKED";
  granted_at: string;
  granted_by: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export const PACK_TIER_META: Record<
  PackTier,
  { label: string; emoji: string; desc: string }
> = {
  BASIC: {
    label: "기본팩",
    emoji: "🎁",
    desc: "신규 지사 가입 시 자동 부여 · 영구 무료",
  },
  OPTIONAL: {
    label: "유료팩",
    emoji: "🛒",
    desc: "본사가 수동 부여 · 추후 결제로 자동 구매",
  },
  HIDDEN: {
    label: "비공개",
    emoji: "🔒",
    desc: "스토어 미노출 · 베타·내부용",
  },
};

export const FEATURE_STATUS_META: Record<
  FeatureStatus,
  { label: string; bg: string; text: string }
> = {
  DRAFT: { label: "초안", bg: "bg-slate-100", text: "text-slate-700" },
  BETA: { label: "베타", bg: "bg-amber-100", text: "text-amber-800" },
  GA: { label: "정식", bg: "bg-emerald-100", text: "text-emerald-800" },
  DEPRECATED: { label: "단종", bg: "bg-rose-100", text: "text-rose-800" },
};

export const FEATURE_CATEGORY_META: Record<FeatureCategory, string> = {
  BROADCAST: "📻 방송",
  MISSION: "🎯 미션",
  CONTENT: "📦 콘텐츠",
  ANALYTICS: "📊 분석",
  MARKETING: "📣 마케팅",
  CORE: "🏕️ 코어",
  OTHER: "🔧 기타",
};
