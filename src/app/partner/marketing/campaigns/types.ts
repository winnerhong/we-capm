export type CampaignGoal =
  | "AWARENESS"
  | "LEAD"
  | "CONVERSION"
  | "RETENTION"
  | "REVIEW";

export type CampaignChannel = "SMS" | "EMAIL" | "PUSH" | "KAKAO";

export type ScheduleType = "IMMEDIATE" | "SCHEDULED" | "RECURRING";

export type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "SENDING"
  | "SENT"
  | "PAUSED"
  | "FAILED";

export const GOAL_OPTIONS = [
  {
    key: "AWARENESS",
    label: "🌱 인지도 증가",
    desc: "우리 숲을 모르는 사람들에게 알리기",
  },
  {
    key: "LEAD",
    label: "📋 리드 수집",
    desc: "문의/상담 신청 받기",
  },
  {
    key: "CONVERSION",
    label: "🎯 예약 전환",
    desc: "관심 고객을 예약으로 전환",
  },
  {
    key: "RETENTION",
    label: "🔁 재방문 유도",
    desc: "다녀간 고객의 재방문 유도",
  },
  {
    key: "REVIEW",
    label: "⭐ 리뷰 요청",
    desc: "리뷰 작성 요청",
  },
] as const;

export const CHANNEL_OPTIONS = [
  { key: "SMS", label: "문자(SMS)", icon: "📱", cost: "20원/건" },
  { key: "KAKAO", label: "카카오톡", icon: "💛", cost: "15원/건" },
  { key: "EMAIL", label: "이메일", icon: "📧", cost: "3원/건" },
  { key: "PUSH", label: "앱 푸시", icon: "🔔", cost: "무료" },
] as const;

export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "SENDING",
  "SENT",
  "PAUSED",
  "FAILED",
];

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: "초안",
  SCHEDULED: "예약됨",
  SENDING: "발송중",
  SENT: "발송완료",
  PAUSED: "일시중지",
  FAILED: "실패",
};

export const STATUS_STYLE: Record<CampaignStatus, string> = {
  DRAFT: "bg-stone-100 text-stone-700 border-stone-200",
  SCHEDULED: "bg-sky-50 text-sky-700 border-sky-200",
  SENDING: "bg-amber-50 text-amber-700 border-amber-200",
  SENT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PAUSED: "bg-violet-50 text-violet-700 border-violet-200",
  FAILED: "bg-rose-50 text-rose-700 border-rose-200",
};

export const GOAL_LABEL: Record<CampaignGoal, string> = {
  AWARENESS: "🌱 인지도",
  LEAD: "📋 리드수집",
  CONVERSION: "🎯 예약전환",
  RETENTION: "🔁 재방문",
  REVIEW: "⭐ 리뷰요청",
};

export const CHANNEL_LABEL: Record<CampaignChannel, string> = {
  SMS: "📱 SMS",
  KAKAO: "💛 카카오톡",
  EMAIL: "📧 이메일",
  PUSH: "🔔 푸시",
};

export type CampaignRow = {
  id: string;
  partner_id: string;
  name: string;
  goal: CampaignGoal | null;
  target_segment_id: string | null;
  target_filter: Record<string, unknown> | null;
  channels: CampaignChannel[] | null;
  message_title: string | null;
  message_body: string | null;
  message_cta_url: string | null;
  schedule_type: ScheduleType | null;
  scheduled_at: string | null;
  recurring_rule: Record<string, unknown> | null;
  status: CampaignStatus;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  converted_count: number;
  created_at: string;
};

export type SegmentOption = {
  id: string;
  name: string;
  icon: string | null;
  member_count: number | null;
};
