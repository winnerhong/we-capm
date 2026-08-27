// 기관 행사(Event) 공용 타입 — org_events / org_event_quest_packs /
// org_event_programs / org_event_trails / org_event_participants 와 1:1 대응.
// DB migration 은 병렬로 작성되는 중이므로 이 타입이 먼저 스키마를 정의하는 계약.

import type { ConsentSnapshot } from "./consent-core";

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
  /** 초대장 짧은 인사말 (1~2줄). */
  invitation_message: string | null;
  /** 초대장 본문 안내문 — 줄바꿈 포함 자유 텍스트. */
  invitation_body: string | null;
  /** 초대장 장소 안내 (장소명 — 예: "침산공원"). */
  invitation_location: string | null;
  /** 초대장 상세 주소 — 도로명/지번 (지도 검색에 사용). */
  invitation_address: string | null;
  /** 초대장 행사장 안내 이미지 — Storage public URL. 비우면 노출 안 함. */
  invitation_location_image_url: string | null;
  /** 복장·준비물 안내. */
  invitation_dress_code: string | null;
  /**
   * 입장가능시간 — 행사 시작 몇 분 전부터.
   * null/0 이면 초대장에서 입장 안내 줄을 숨긴다. 시각이 아니라 분으로 두는
   * 이유: 행사 시각이 바뀌어도 자동으로 따라오게.
   */
  invitation_entry_lead_min: number | null;
  /**
   * 사진 나눠보기 — 참가 가족끼리 미션 사진을 볼 수 있게 할지.
   * 켜도 곧바로 공개되지 않는다. 보호자가 사진마다 따로 켜야 한다.
   * optional 인 이유: 컬럼 미적용 배포 창에서는 select("*") 가 이 키를
   * 돌려주지 않는다. undefined 는 "꺼짐" 으로 읽는다(공개는 기본이 잠김).
   */
  photo_feed_enabled?: boolean | null;
  /** 초대장 주차장 — 최대 5개. */
  invitation_parkings: ParkingItem[] | null;
  /** 초대장 주최 (자유 입력). 예: "구미혜당학교". 비우면 줄 자체 숨김. */
  invitation_host: string | null;
  /** 초대장 주관 (자유 입력). 예: "위너키즈스포츠 [위너기획]". */
  invitation_organizer: string | null;
  /** 초대장 발행 시점. null=초안. */
  invitation_published_at: string | null;
  /**
   * 참가 접수·승인제 사용 여부.
   * true 면 초대장 하단에 신청서가 뜨고, 기관이 수락한 건만 참가자가 된다
   * (자가 참가 경로 전면 차단 — join-actions / self-register 양쪽).
   */
  applications_enabled: boolean | null;
  /** 접수 마감 시각. null=무기한. 지나면 신청 폼 대신 마감 안내. */
  applications_close_at: string | null;
  /** 정원 — 승인 인원(party_size) 합계 기준. null=무제한. */
  applications_capacity: number | null;
  created_at: string;
  updated_at: string;
}

/** 초대장 주차장 1개 항목. */
export interface ParkingItem {
  name: string;
  address: string;
  /** 입구·간판 사진 (선택). Storage public URL. */
  image_url?: string;
}

/** 초대장 주차장 최대 개수. */
export const MAX_PARKING_ITEMS = 5;

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
  /** 이 가족의 총 참석 인원(어른 포함). 접수 승인 시 신청서 값 복사. */
  party_size: number;
  /** 성인(조부모 제외) 참석 인원. 직접 등록분은 0(미상) — 배지를 숨긴다. */
  adult_count: number;
  /** 조부모 참석 인원. 직접 등록분은 0(미상). */
  senior_count: number;
  /** 아동 참석 인원(참가 아이 + 아동 동반인). 직접 등록분은 0(미상). */
  child_count: number;
}

/* -------------------------------------------------------------------------- */
/* 참가 접수(신청서) — org_event_applications                                  */
/* -------------------------------------------------------------------------- */

/**
 * 신청서 상태.
 * CANCELED 는 신청자(또는 대신 처리한 관리자)가 취소한 것 — 삭제가 아니라
 * 상태 전환이라 접수 탭 [취소] 목록에 그대로 남는다.
 */
export type OrgEventApplicationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELED";

/** 신청서에 적힌 아이 한 명 — 제출 당시 스냅샷. */
export interface ApplicationChild {
  /** 원아명. 필수. */
  name: string;
  /** 반명. 비워둘 수 있다. */
  class_name: string | null;
}

/**
 * 동반인 구분 — 인원 집계의 기준.
 * 조부모를 성인에서 떼어낸 이유: 좌석·간식·이동 준비가 셋으로 나뉜다.
 */
export type CompanionKind = "ADULT" | "SENIOR" | "CHILD";

/**
 * 함께 오는 사람 한 명 — 이름은 받지 않고 관계 호칭만 받는다.
 * 인원 집계·간식 준비에는 호칭으로 충분하고, 입력 단계를 늘리지 않으려는 결정.
 */
export interface ApplicationCompanion {
  /** "아빠", "할머니", "삼촌" 등. 직접 입력도 가능. */
  label: string;
  kind: CompanionKind;
}

/** 신청서 한 건. children / companions 는 jsonb 컬럼. */
export interface OrgEventApplicationRow {
  id: string;
  event_id: string;
  org_id: string;
  /** 하이픈 없는 숫자만 (normalizeUserPhone 결과). */
  phone: string;
  children: ApplicationChild[];
  companions: ApplicationCompanion[];
  /** 어른 포함 총 참석 인원 — children + companions 로부터 파생된 값. */
  party_size: number;
  status: OrgEventApplicationStatus;
  /** 거절 사유 — 관리자 전용. 신청자에게 노출하지 않는다. */
  note: string | null;
  /** 승인으로 생성·연결된 보호자 계정. */
  approved_user_id: string | null;
  /** 검토자 식별자 = OrgSession.managerId (uuid 아님). */
  reviewed_by: string | null;
  reviewed_at: string | null;
  /** 취소 시각. CANCELED 일 때만. 재신청하면 다시 null. */
  canceled_at: string | null;
  /** 신청자가 남긴 취소 사유(선택). note(관리자 거절 메모)와 방향이 반대다. */
  cancel_reason: string | null;
  /**
   * [필수] 개인정보 수집·이용 동의 시각.
   * null 은 "거부" 가 아니라 **동의 기능 도입 전에 접수된 신청서** 다.
   */
  consent_agreed_at: string | null;
  /** [선택] 계열사 공동이용 동의 시각. null = 동의 안 함(참가에는 무영향). */
  consent_optional_agreed_at: string | null;
  /** 동의 당시 전문. 기관이 문구를 고쳐도 이 값은 바뀌지 않는다. */
  consent_snapshot: ConsentSnapshot | null;
  created_at: string;
  updated_at: string;
}

/** 행사별 접수 현황 — view_org_event_application_counts. */
export interface OrgEventApplicationCounts {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  canceled_count: number;
  /** 승인 인원 합계 — applications_capacity 와 직접 비교하는 값. */
  approved_people: number;
}

export const ORG_EVENT_APPLICATION_STATUS_META: Record<
  OrgEventApplicationStatus,
  { label: string; icon: string; color: string }
> = {
  PENDING: {
    label: "대기",
    icon: "⏳",
    color: "bg-amber-50 text-amber-800 border-amber-200",
  },
  APPROVED: {
    label: "승인",
    icon: "✅",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  REJECTED: {
    label: "거절",
    icon: "❌",
    color: "bg-zinc-100 text-zinc-600 border-zinc-200",
  },
  CANCELED: {
    label: "취소",
    icon: "🚫",
    color: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

/** 신청서 한 건에 넣을 수 있는 자녀 수 상한. */
export const MAX_APPLICATION_CHILDREN = 6;

/** 동반인 수 상한. 자녀 6 + 동반 14 = 20 으로 아래 총 인원 상한과 맞물린다. */
export const MAX_APPLICATION_COMPANIONS = 14;

/** 참가 인원 상한 — DB CHECK(party_size BETWEEN 1 AND 20) 와 일치. */
export const MAX_APPLICATION_PARTY_SIZE = 20;

/** 동반인 유형 라벨 길이 상한. */
export const MAX_COMPANION_LABEL_LENGTH = 20;

/**
 * 신청 폼의 빠른 선택 칩.
 * 칩마다 기본 구분이 정해져 있고(할머니·할아버지=조부모, 형제·자매=아동),
 * 줄에서 언제든 바꿀 수 있다. 직접 입력은 성인으로 시작한다.
 */
export const COMPANION_PRESETS: readonly ApplicationCompanion[] = [
  { label: "아빠", kind: "ADULT" },
  { label: "엄마", kind: "ADULT" },
  { label: "할머니", kind: "SENIOR" },
  { label: "할아버지", kind: "SENIOR" },
  { label: "삼촌", kind: "ADULT" },
  { label: "이모", kind: "ADULT" },
  { label: "고모", kind: "ADULT" },
  { label: "형제·자매", kind: "CHILD" },
];

export const COMPANION_KIND_META: Record<
  CompanionKind,
  { label: string; icon: string }
> = {
  ADULT: { label: "성인", icon: "🧑" },
  SENIOR: { label: "조부모", icon: "👴" },
  CHILD: { label: "아동", icon: "👶" },
};

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
  cover_image_url: string | null;
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
    label: "예정",
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
