// 기관 행사(Event) 공용 타입 — org_events / org_event_quest_packs /
// org_event_programs / org_event_trails / org_event_participants 와 1:1 대응.
// DB migration 은 병렬로 작성되는 중이므로 이 타입이 먼저 스키마를 정의하는 계약.

export type OrgEventStatus = "DRAFT" | "LIVE" | "ENDED" | "ARCHIVED";

export interface OrgEventRow {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  cover_image_url: string | null;
  status: OrgEventStatus;
  /**
   * 초대링크 수신자의 자가 가입 허용 여부.
   * true + status=LIVE 인 행사에 대해서만 미등록 번호의 신규 app_users 생성을 허용한다.
   * DB 컬럼: org_events.allow_self_register boolean (병렬 마이그레이션).
   */
  allow_self_register: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface OrgEventQuestPackRow {
  event_id: string;
  quest_pack_id: string;
  sort_order: number;
  created_at: string;
}

export interface OrgEventProgramRow {
  event_id: string;
  org_program_id: string;
  created_at: string;
}

export interface OrgEventTrailRow {
  event_id: string;
  trail_id: string;
  created_at: string;
}

export interface OrgEventParticipantRow {
  event_id: string;
  user_id: string;
  joined_at: string;
}

/**
 * 행사 요약 뷰 — view_org_event_summary.
 * 각 행사에 연결된 리소스 카운트 (스탬프북/참가자/FM/프로그램/숲길).
 */
export interface OrgEventSummaryRow {
  event_id: string;
  org_id: string;
  name: string;
  status: OrgEventStatus;
  starts_at: string | null;
  ends_at: string | null;
  quest_pack_count: number;
  participant_count: number;
  fm_session_count: number;
  program_count: number;
  trail_count: number;
}

/**
 * 행사 상태별 라벨/배지 메타 — UI 에서 뱃지 렌더링 시 공용.
 */
export const ORG_EVENT_STATUS_META: Record<
  OrgEventStatus,
  { label: string; color: string; dot: string }
> = {
  DRAFT: {
    label: "초안",
    color: "bg-zinc-50 text-zinc-700 border-zinc-200",
    dot: "bg-zinc-400",
  },
  LIVE: {
    label: "진행중",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  ENDED: {
    label: "종료",
    color: "bg-sky-50 text-sky-800 border-sky-200",
    dot: "bg-sky-400",
  },
  ARCHIVED: {
    label: "보관",
    color: "bg-zinc-100 text-zinc-500 border-zinc-200",
    dot: "bg-zinc-300",
  },
};

export const ORG_EVENT_STATUSES: OrgEventStatus[] = [
  "DRAFT",
  "LIVE",
  "ENDED",
  "ARCHIVED",
];

export function isOrgEventStatus(v: unknown): v is OrgEventStatus {
  return (
    typeof v === "string" &&
    (ORG_EVENT_STATUSES as string[]).includes(v)
  );
}
