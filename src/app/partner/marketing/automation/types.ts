export type TriggerType =
  | "SIGNUP"
  | "FIRST_PURCHASE"
  | "ABANDONED_CART"
  | "POST_EVENT"
  | "NO_ACTIVITY_30D"
  | "REVIEW_REQUEST"
  | "BIRTHDAY";

export type ActionType = "SMS" | "EMAIL" | "KAKAO" | "PUSH" | "COUPON";

export interface AutomationAction {
  type: ActionType;
  delayHours: number;
  title: string;
  body: string;
  couponId?: string;
}

export interface AutomationRow {
  id: string;
  partner_id: string;
  name: string | null;
  trigger_type: TriggerType | null;
  trigger_config: Record<string, unknown> | null;
  actions: AutomationAction[] | null;
  is_active: boolean | null;
  executed_count: number | null;
  last_executed_at: string | null;
  created_at: string | null;
}

export const TRIGGER_OPTIONS = [
  { key: "SIGNUP", icon: "👋", label: "신규 회원가입", desc: "방금 우리 숲에 가입한 고객" },
  { key: "FIRST_PURCHASE", icon: "🎉", label: "첫 예약 완료", desc: "처음으로 프로그램 예약한 고객" },
  { key: "ABANDONED_CART", icon: "🛒", label: "예약 중단", desc: "예약 시작했지만 완료 안 한 고객" },
  { key: "POST_EVENT", icon: "🌲", label: "방문 완료 후", desc: "프로그램 참여 완료한 고객" },
  { key: "NO_ACTIVITY_30D", icon: "🕰️", label: "30일 휴면", desc: "30일간 활동 없는 고객" },
  { key: "REVIEW_REQUEST", icon: "⭐", label: "리뷰 요청", desc: "방문 후 3일 뒤 리뷰 요청" },
  { key: "BIRTHDAY", icon: "🎂", label: "생일", desc: "고객 생일에 축하 메시지" },
] as const;

export const ACTION_TYPE_OPTIONS = [
  { key: "KAKAO", icon: "💬", label: "카카오 알림톡" },
  { key: "SMS", icon: "📱", label: "문자 (SMS)" },
  { key: "EMAIL", icon: "📧", label: "이메일" },
  { key: "PUSH", icon: "🔔", label: "앱 푸시" },
  { key: "COUPON", icon: "🎁", label: "쿠폰 지급" },
] as const;

export const TRIGGER_LABEL: Record<TriggerType, { icon: string; label: string }> = {
  SIGNUP: { icon: "👋", label: "신규 회원가입" },
  FIRST_PURCHASE: { icon: "🎉", label: "첫 예약 완료" },
  ABANDONED_CART: { icon: "🛒", label: "예약 중단" },
  POST_EVENT: { icon: "🌲", label: "방문 완료 후" },
  NO_ACTIVITY_30D: { icon: "🕰️", label: "30일 휴면" },
  REVIEW_REQUEST: { icon: "⭐", label: "리뷰 요청" },
  BIRTHDAY: { icon: "🎂", label: "생일" },
};

export const ACTION_TYPE_LABEL: Record<ActionType, { icon: string; label: string }> = {
  SMS: { icon: "📱", label: "문자" },
  EMAIL: { icon: "📧", label: "이메일" },
  KAKAO: { icon: "💬", label: "카카오 알림톡" },
  PUSH: { icon: "🔔", label: "앱 푸시" },
  COUPON: { icon: "🎁", label: "쿠폰" },
};

export const PRESET_SCENARIOS = [
  {
    key: "welcome",
    icon: "👋",
    name: "신규 환영 시나리오",
    trigger: "SIGNUP" as TriggerType,
    actions: [
      {
        type: "KAKAO" as ActionType,
        delayHours: 0,
        title: "환영합니다!",
        body: "{이름}님, 토리로에 오신 걸 환영해요 🌲 첫 예약 10% 할인 쿠폰을 드립니다!",
      },
      {
        type: "SMS" as ActionType,
        delayHours: 72,
        title: "",
        body: "{이름}님, 쿠폰 아직 사용 전이에요! 우리 숲이 기다리고 있어요 🌿",
      },
    ],
  },
  {
    key: "revisit",
    icon: "🔁",
    name: "재방문 유도 시나리오",
    trigger: "NO_ACTIVITY_30D" as TriggerType,
    actions: [
      {
        type: "KAKAO" as ActionType,
        delayHours: 0,
        title: "오랜만이에요",
        body: "{이름}님, 한 달만이네요! 이번 달 새 프로그램 보러 오세요 🌲",
      },
      {
        type: "SMS" as ActionType,
        delayHours: 168,
        title: "",
        body: "특별 할인 쿠폰 남아있어요. {쿠폰코드}",
      },
    ],
  },
  {
    key: "review",
    icon: "⭐",
    name: "리뷰 요청 시나리오",
    trigger: "REVIEW_REQUEST" as TriggerType,
    actions: [
      {
        type: "KAKAO" as ActionType,
        delayHours: 72,
        title: "어떠셨어요?",
        body: "{이름}님, 지난 주 방문은 어떠셨나요? 간단히 리뷰 남겨주시면 다음 방문 시 5% 할인!",
      },
    ],
  },
] as const;
