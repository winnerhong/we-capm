// shared types (client + server) — no runtime imports besides pure constants.

/* -------------------------------------------------------------------------- */
/* Enums / unions                                                             */
/* -------------------------------------------------------------------------- */

export type MissionKind =
  | "PHOTO"
  | "QR_QUIZ"
  | "PHOTO_APPROVAL"
  | "COOP"
  | "BROADCAST"
  | "TREASURE"
  | "RADIO"
  | "FINAL_REWARD";

export type MissionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type MissionVisibility = "DRAFT" | "ALL" | "SELECTED" | "ARCHIVED";
export type QuestPackStatus = "DRAFT" | "LIVE" | "ENDED" | "ARCHIVED";
export type SubmissionStatus =
  | "SUBMITTED"
  | "AUTO_APPROVED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "REVOKED";
export type UnlockRule = "ALWAYS" | "SEQUENTIAL" | "TIER_GATE";
export type ApprovalMode =
  | "AUTO"
  | "MANUAL_TEACHER"
  | "AUTO_24H"
  | "PARTNER_REVIEW";
export type LayoutMode = "GRID" | "LIST" | "TRAIL_MAP";
export type StampIconSet = "FOREST" | "ANIMAL" | "SEASON";

/* -------------------------------------------------------------------------- */
/* Per-kind config shapes                                                     */
/* -------------------------------------------------------------------------- */

export interface PhotoMissionConfig {
  min_photos: number;
  prompt: string;
  require_caption?: boolean;
  geofence?: { lat: number; lng: number; radius_m: number };
}

export interface QrQuizMissionConfig {
  qr_token: string;
  qr_single_use: boolean;
  quiz_type: "MCQ" | "SHORT" | "NONE";
  quiz_text?: string;
  quiz_choices?: Array<{ id: string; label: string }>;
  quiz_answer?: string;
  hint?: string;
}

export interface FinalRewardMissionConfig {
  tiers: Array<{
    threshold: number;
    label: string;
    reward_desc: string;
    icon?: string;
  }>;
  redemption_ttl_hours: number;
  scope: "QUEST_PACK" | "ALL_PACKS";
}

// Stubs — kinds not in Phase 1 MVP still need their shapes for the union.
export interface PhotoApprovalMissionConfig {
  prompt: string;
  min_photos: number;
  reject_reasons: string[];
  sla_hours: number;
}
export interface CoopMissionConfig {
  group_size: number;              // 2 for MVP
  match_window_min: number;        // 30 default (pair_code 유효 시간)
  completion_rule: "BOTH_CONFIRM" | "SHARED_PHOTO";  // default BOTH_CONFIRM
}
export interface BroadcastMissionConfig {
  duration_sec: number;
  prompt: string;
  submission_kind: "PHOTO" | "TEXT";
}
export interface TreasureMissionConfig {
  steps: Array<{
    order: number;
    hint_text: string;
    unlock_rule: "AUTO" | "QR" | "ANSWER";
    answer?: string;
  }>;
  final_qr_token: string;
}
export interface RadioMissionConfig {
  prompt_song: string;
  prompt_story: string;
  max_length: number;
}

export type MissionConfig =
  | ({ kind: "PHOTO" } & PhotoMissionConfig)
  | ({ kind: "QR_QUIZ" } & QrQuizMissionConfig)
  | ({ kind: "PHOTO_APPROVAL" } & PhotoApprovalMissionConfig)
  | ({ kind: "COOP" } & CoopMissionConfig)
  | ({ kind: "BROADCAST" } & BroadcastMissionConfig)
  | ({ kind: "TREASURE" } & TreasureMissionConfig)
  | ({ kind: "RADIO" } & RadioMissionConfig)
  | ({ kind: "FINAL_REWARD" } & FinalRewardMissionConfig);

/* -------------------------------------------------------------------------- */
/* Per-kind submission payload                                                */
/* -------------------------------------------------------------------------- */

export interface PhotoSubmissionPayload {
  photo_urls: string[];
  caption?: string;
  lat?: number;
  lng?: number;
}
export interface QrQuizSubmissionPayload {
  qr_scanned_token: string;
  quiz_answer?: string;
}
export interface FinalRewardSubmissionPayload {
  redemption_token: string;
}
export interface PhotoApprovalSubmissionPayload {
  photo_urls: string[];
  caption?: string;
}
export interface TreasureSubmissionPayload {
  steps_cleared: Array<{
    step_order: number;
    method: TreasureUnlockMethod;
    at: string;
  }>;
  final_qr_token_scanned: string;
}
export interface RadioSubmissionPayload {
  song_title: string;
  artist?: string;
  story_text: string;
  child_name?: string;
}

export interface CoopSubmissionPayload {
  pair_code: string;
  session_id: string;
  role: "A" | "B";           // A = initiator, B = partner
  shared_photo_url?: string;
  note?: string;
}
export interface BroadcastSubmissionPayload {
  broadcast_id: string;
  content_type: "PHOTO" | "TEXT";
  content: string;           // photo_url or text
}

export type SubmissionPayload =
  | PhotoSubmissionPayload
  | QrQuizSubmissionPayload
  | FinalRewardSubmissionPayload
  | PhotoApprovalSubmissionPayload
  | TreasureSubmissionPayload
  | RadioSubmissionPayload
  | CoopSubmissionPayload
  | BroadcastSubmissionPayload
  | Record<string, unknown>;

/* -------------------------------------------------------------------------- */
/* Row types (DB mirror)                                                      */
/* -------------------------------------------------------------------------- */

export interface PartnerMissionRow {
  id: string;
  partner_id: string;
  kind: MissionKind;
  title: string;
  description: string | null;
  icon: string | null;
  default_acorns: number;
  config_json: Record<string, unknown>;
  version: number;
  parent_version_id: string | null;
  status: MissionStatus;
  visibility: MissionVisibility;
  created_at: string;
  updated_at: string;
}

export interface PartnerMissionAssignmentRow {
  id: string;
  mission_id: string;
  org_id: string;
  assigned_at: string;
}

export interface OrgQuestPackRow {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  trail_id: string | null;
  cover_image_url: string | null;
  layout_mode: LayoutMode;
  stamp_icon_set: StampIconSet;
  completion_animation: string;
  status: QuestPackStatus;
  starts_at: string | null;
  ends_at: string | null;
  tier_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrgMissionRow {
  id: string;
  org_id: string;
  quest_pack_id: string | null;
  source_mission_id: string | null; // null = org-authored custom mission
  kind: MissionKind;
  title: string;
  description: string | null;
  icon: string | null;
  acorns: number;
  config_json: Record<string, unknown>;
  display_order: number;
  unlock_rule: UnlockRule;
  unlock_threshold: number | null; // TIER_GATE 시 누적 도토리
  unlock_previous_id: string | null; // SEQUENTIAL 시 선행 미션
  approval_mode: ApprovalMode;
  starts_at: string | null;
  ends_at: string | null;
  geofence_lat: number | null;
  geofence_lng: number | null;
  geofence_radius_m: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MissionSubmissionRow {
  id: string;
  org_mission_id: string;
  user_id: string;
  child_id: string | null;
  status: SubmissionStatus;
  payload_json: Record<string, unknown>;
  awarded_acorns: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  idempotency_key: string | null;
  submitted_at: string;
}

export interface MissionFinalRedemptionRow {
  id: string;
  user_id: string;
  quest_pack_id: string;
  tier_label: string;
  tier_threshold: number;
  total_acorns_at_issue: number;
  qr_token: string;
  expires_at: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/* Phase 2: Treasure / Radio / FM sessions                                    */
/* -------------------------------------------------------------------------- */

export type RadioModerationStatus = "PENDING" | "APPROVED" | "HIDDEN";
export type TreasureUnlockMethod = "AUTO" | "QR" | "ANSWER";

export interface MissionTreasureProgressRow {
  id: string;
  org_mission_id: string;
  user_id: string;
  step_order: number;
  unlocked_at: string;
  unlock_method: TreasureUnlockMethod | null;
}

export interface MissionRadioQueueRow {
  id: string;
  submission_id: string;
  org_id: string;
  fm_session_id: string | null;
  moderation: RadioModerationStatus;
  position: number | null;
  played_at: string | null;
  skipped_at: string | null;
  play_duration_sec: number | null;
  moderator_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToriFmSessionRow {
  id: string;
  org_id: string;
  event_id: string | null;
  name: string;
  scheduled_start: string;
  scheduled_end: string;
  is_live: boolean;
  started_at: string | null;
  ended_at: string | null;
  current_queue_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/* UI Meta                                                                    */
/* -------------------------------------------------------------------------- */

export const MISSION_KIND_META: Record<
  MissionKind,
  {
    label: string;
    icon: string;
    shortDesc: string;
    defaultAcorns: number;
  }
> = {
  PHOTO: {
    label: "가족 사진 찍기",
    icon: "📸",
    shortDesc: "포토존에서 사진 한 장",
    defaultAcorns: 2,
  },
  QR_QUIZ: {
    label: "QR 찍고 퀴즈",
    icon: "🔲",
    shortDesc: "구간별 QR 스캔 + 미니 퀴즈",
    defaultAcorns: 1,
  },
  PHOTO_APPROVAL: {
    label: "자연물 찾기",
    icon: "🍃",
    shortDesc: "나뭇잎·꽃잎 등 미션 사진",
    defaultAcorns: 3,
  },
  COOP: {
    label: "협동 미션",
    icon: "🤝",
    shortDesc: "두 가족이 함께 달성",
    defaultAcorns: 5,
  },
  BROADCAST: {
    label: "돌발 미션",
    icon: "⚡",
    shortDesc: "제한시간 내 전체 참여",
    defaultAcorns: 3,
  },
  TREASURE: {
    label: "보물찾기",
    icon: "🗺",
    shortDesc: "단계별 힌트 추적",
    defaultAcorns: 10,
  },
  RADIO: {
    label: "신청곡 & 사연",
    icon: "🎵",
    shortDesc: "토리FM에 사연 제출",
    defaultAcorns: 1,
  },
  FINAL_REWARD: {
    label: "최종 보상",
    icon: "🎁",
    shortDesc: "누적 도토리로 티어 달성",
    defaultAcorns: 0,
  },
};

export const SUBMISSION_STATUS_META: Record<
  SubmissionStatus,
  { label: string; icon: string; color: string }
> = {
  SUBMITTED: {
    label: "제출됨",
    icon: "📤",
    color: "bg-sky-50 text-sky-800 border-sky-200",
  },
  AUTO_APPROVED: {
    label: "자동 승인",
    icon: "✅",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  PENDING_REVIEW: {
    label: "검토 대기",
    icon: "⏳",
    color: "bg-amber-50 text-amber-800 border-amber-200",
  },
  APPROVED: {
    label: "승인됨",
    icon: "🎯",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  REJECTED: {
    label: "반려됨",
    icon: "❌",
    color: "bg-rose-50 text-rose-800 border-rose-200",
  },
  REVOKED: {
    label: "회수됨",
    icon: "↩",
    color: "bg-zinc-50 text-zinc-700 border-zinc-200",
  },
};

export const MISSION_STATUS_META: Record<
  MissionStatus,
  { label: string; color: string }
> = {
  DRAFT: { label: "초안", color: "bg-zinc-100 text-zinc-700 border-zinc-300" },
  PUBLISHED: {
    label: "게시됨",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  ARCHIVED: {
    label: "보관됨",
    color: "bg-zinc-50 text-zinc-500 border-zinc-200",
  },
};

export const QUEST_PACK_STATUS_META: Record<
  QuestPackStatus,
  { label: string; color: string }
> = {
  DRAFT: { label: "초안", color: "bg-zinc-100 text-zinc-700 border-zinc-300" },
  LIVE: {
    label: "진행중",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  ENDED: {
    label: "종료",
    color: "bg-sky-50 text-sky-800 border-sky-200",
  },
  ARCHIVED: {
    label: "보관됨",
    color: "bg-zinc-50 text-zinc-500 border-zinc-200",
  },
};

export const APPROVED_SUBMISSION_STATUSES: SubmissionStatus[] = [
  "AUTO_APPROVED",
  "APPROVED",
];

export const RADIO_MODERATION_META: Record<
  RadioModerationStatus,
  { label: string; icon: string; color: string }
> = {
  PENDING: {
    label: "검토 대기",
    icon: "⏳",
    color: "bg-amber-50 text-amber-800 border-amber-200",
  },
  APPROVED: {
    label: "방송 대기",
    icon: "✅",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  HIDDEN: {
    label: "숨김",
    icon: "🙈",
    color: "bg-zinc-100 text-zinc-600 border-zinc-300",
  },
};

/* -------------------------------------------------------------------------- */
/* Phase 3: Coop / Broadcast                                                  */
/* -------------------------------------------------------------------------- */

export type CoopSessionState =
  | "WAITING"     // 혼자 기다리는 중 (pair_code 생성됨, partner 없음)
  | "PAIRED"      // 짝꿍 합류 (둘 다 아직 제출 안 함)
  | "A_DONE"      // initiator 제출 완료 (partner 대기)
  | "B_DONE"      // partner 제출 완료 (initiator 대기)
  | "COMPLETED"   // 둘 다 제출 완료
  | "EXPIRED"     // 시간 초과
  | "CANCELLED";  // 수동 취소

export type BroadcastTargetScope = "ORG" | "EVENT" | "ALL";

export interface MissionCoopSessionRow {
  id: string;
  org_mission_id: string;
  pair_code: string;
  initiator_user_id: string;
  initiator_child_id: string | null;
  partner_user_id: string | null;
  partner_child_id: string | null;
  state: CoopSessionState;
  shared_photo_url: string | null;
  initiator_submission_id: string | null;
  partner_submission_id: string | null;
  expires_at: string;
  paired_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissionBroadcastRow {
  id: string;
  org_mission_id: string;
  triggered_by_org_id: string;
  target_scope: BroadcastTargetScope;
  target_event_id: string | null;
  prompt_snapshot: string;
  duration_sec: number;
  fires_at: string;
  expires_at: string;
  cancelled_at: string | null;
  created_at: string;
}

export const COOP_STATE_META: Record<
  CoopSessionState,
  { label: string; icon: string; color: string }
> = {
  WAITING: {
    label: "짝꿍 기다리는 중",
    icon: "⌛",
    color: "bg-amber-50 text-amber-800 border-amber-200",
  },
  PAIRED: {
    label: "짝꿍 합류!",
    icon: "🤝",
    color: "bg-sky-50 text-sky-800 border-sky-200",
  },
  A_DONE: {
    label: "나는 완료, 짝꿍 대기",
    icon: "🌱",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  B_DONE: {
    label: "짝꿍이 완료, 나 차례",
    icon: "🌿",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  COMPLETED: {
    label: "함께 완성!",
    icon: "🎉",
    color: "bg-emerald-100 text-emerald-900 border-emerald-300",
  },
  EXPIRED: {
    label: "시간 초과",
    icon: "⚰️",
    color: "bg-zinc-100 text-zinc-600 border-zinc-300",
  },
  CANCELLED: {
    label: "취소됨",
    icon: "❌",
    color: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

/* -------------------------------------------------------------------------- */
/* Phase 4: Contributions / Acorn Policy / Presets / Stats                    */
/* -------------------------------------------------------------------------- */

export type ContributionStatus = "PROPOSED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

export interface MissionContributionRow {
  id: string;
  source_org_mission_id: string;
  target_partner_mission_id: string;
  proposed_diff: Record<string, unknown>;
  proposal_note: string | null;
  proposed_by_org_id: string;
  status: ContributionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  accepted_version_id: string | null;
  created_at: string;
}

export interface PlatformAcornGuidelinesRow {
  id: number; // always 1
  max_daily_suggested: number;
  max_daily_hard_cap: number;
  max_per_mission: number;
  suggested_range_min: number;
  suggested_range_max: number;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface OrgDailyAcornCapRow {
  id: string;
  org_id: string;
  daily_cap: number;
  updated_by: string | null;
  updated_at: string;
}

export type PresetVisibility = "PRIVATE" | "ALL_ORGS" | "SELECTED_ORGS";

export interface PartnerStampbookPresetRow {
  id: string;
  partner_id: string;
  name: string;
  description: string | null;
  slot_count: number;
  mission_ids: string[];
  cover_image_url: string | null;
  recommended_for_age: string | null;
  is_published: boolean;
  /**
   * 기관 공유 범위:
   *  - PRIVATE       : 지사 내부만 (기관에 노출 안 됨)
   *  - ALL_ORGS      : 이 지사 산하 모든 기관
   *  - SELECTED_ORGS : partner_stampbook_preset_org_grants 에 등록된 기관만
   * 기관 노출 조건은 `is_published = true` AND `visibility !== 'PRIVATE'`.
   */
  visibility: PresetVisibility;
  /**
   * 프리셋 카테고리 태그 (복수 선택 가능).
   * DB 컬럼 `category text[] DEFAULT '{}'` — 마이그레이션 병행 중이므로
   * 기존 rows 호환을 위해 optional. 새로 만든 프리셋은 항상 배열로 저장.
   * 허용 값은 `PRESET_CATEGORY_OPTIONS` 참조.
   */
  category?: string[];
  created_at: string;
  updated_at: string;
}

/**
 * 프리셋 카테고리 옵션 — Frontend chip picker 가 import 해서 사용.
 * value 는 DB 에 저장되는 string 값, label/icon 은 UI 표시용.
 */
export const PRESET_CATEGORY_OPTIONS: Array<{
  value: string;
  label: string;
  icon: string;
}> = [
  { value: "ELEMENTARY", label: "초등", icon: "🎒" },
  { value: "PRESCHOOL", label: "유아", icon: "🧸" },
  { value: "FAMILY", label: "가족", icon: "👨‍👩‍👧" },
  { value: "NATURE", label: "자연", icon: "🌲" },
  { value: "ADVENTURE", label: "탐험", icon: "🗺" },
  { value: "ART", label: "예술", icon: "🎨" },
  { value: "DAILY", label: "일상", icon: "☕" },
  { value: "SPECIAL", label: "특별", icon: "✨" },
];

export interface PartnerStampbookPresetOrgGrantRow {
  preset_id: string;
  org_id: string;
  granted_at: string;
}

export interface ViewMissionSubmissionStatsRow {
  org_id: string;
  quest_pack_id: string | null;
  org_mission_id: string;
  kind: MissionKind;
  title: string;
  approved_count: number;
  pending_count: number;
  rejected_count: number;
  total_count: number;
  total_acorns_awarded: number;
}

export interface ViewPartnerMissionUsageStatsRow {
  partner_mission_id: string;
  partner_id: string;
  kind: MissionKind;
  title: string;
  mission_status: MissionStatus;
  copied_count: number;
  used_by_org_count: number;
  total_approved_submissions: number;
  total_acorns_awarded: number;
}

export const CONTRIBUTION_STATUS_META: Record<ContributionStatus, { label: string; icon: string; color: string }> = {
  PROPOSED:  { label: "검토 대기", icon: "💌", color: "bg-sky-50 text-sky-800 border-sky-200" },
  ACCEPTED:  { label: "수용됨",   icon: "✅", color: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  REJECTED:  { label: "반려됨",   icon: "❌", color: "bg-rose-50 text-rose-700 border-rose-200" },
  WITHDRAWN: { label: "회수됨",   icon: "↩️", color: "bg-zinc-100 text-zinc-600 border-zinc-300" },
};
