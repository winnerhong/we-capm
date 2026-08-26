// server-only: @/lib/supabase/server 참조 → 클라이언트 번들 금지.
// 참가 접수(org_event_applications) 데이터 로더.
//
// 실패 정책: queries.ts 와 동일 — throw 하지 않고 빈 값 fallback + console.error.
//
// 배포 순서 안전장치: 코드가 먼저 올라가고 SQL 이 나중에 실행되는 창이 생긴다.
//   그동안 테이블/뷰가 없으면(42P01 / PGRST205) 조용히 "접수 없음" 으로 취급해
//   행사 페이지와 초대장이 통째로 깨지지 않게 한다.

import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  parseApplicationChildren,
  parseApplicationCompanions,
} from "./application-core";
import {
  parseConsentSnapshot,
  type OrgConsentSettings,
} from "./consent-core";
import type {
  OrgEventApplicationCounts,
  OrgEventApplicationRow,
  OrgEventApplicationStatus,
} from "./types";

type SbResp<T> = { data: T[] | null; error: unknown };
type SbRespOne<T> = { data: T | null; error: unknown };

const EMPTY_COUNTS: OrgEventApplicationCounts = {
  pending_count: 0,
  approved_count: 0,
  rejected_count: 0,
  canceled_count: 0,
  approved_people: 0,
};

/** 마이그레이션 미적용 (테이블/뷰 없음). */
function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "PGRST205";
}

function logUnlessMissing(scope: string, error: unknown): void {
  if (!isMissingTable(error)) console.error(`[applications/${scope}]`, error);
}

/** 신청자 상태 카드용 쿠키 이름. 제출 시 서버 액션이 심고, SSR 이 읽는다. */
export function applicationCookieName(eventId: string): string {
  return `toriro_apply_${eventId}`;
}

/** DB row(children 이 jsonb) → 타입 확정된 row. */
function normalizeRow(raw: Record<string, unknown>): OrgEventApplicationRow {
  return {
    id: String(raw.id),
    event_id: String(raw.event_id),
    org_id: String(raw.org_id),
    phone: String(raw.phone ?? ""),
    children: parseApplicationChildren(raw.children),
    companions: parseApplicationCompanions(raw.companions),
    party_size: Number(raw.party_size ?? 1),
    status: (raw.status as OrgEventApplicationStatus) ?? "PENDING",
    note: (raw.note as string | null) ?? null,
    approved_user_id: (raw.approved_user_id as string | null) ?? null,
    reviewed_by: (raw.reviewed_by as string | null) ?? null,
    reviewed_at: (raw.reviewed_at as string | null) ?? null,
    canceled_at: (raw.canceled_at as string | null) ?? null,
    cancel_reason: (raw.cancel_reason as string | null) ?? null,
    // 컬럼 미적용 배포 창에서는 undefined → null(기록 없음)로 떨어진다.
    consent_agreed_at: (raw.consent_agreed_at as string | null) ?? null,
    consent_optional_agreed_at:
      (raw.consent_optional_agreed_at as string | null) ?? null,
    consent_snapshot: parseConsentSnapshot(raw.consent_snapshot),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

/* -------------------------------------------------------------------------- */
/* 목록 / 현황                                                                 */
/* -------------------------------------------------------------------------- */

/** 행사의 신청서 전체 — 최신순. 관리자 접수 탭이 클라이언트에서 필터링한다. */
export async function loadEventApplications(
  eventId: string
): Promise<OrgEventApplicationRow[]> {
  if (!eventId) return [];
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_event_applications" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            k: string,
            o: { ascending: boolean }
          ) => Promise<SbResp<Record<string, unknown>>>;
        };
      };
    }
  )
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })) as SbResp<
    Record<string, unknown>
  >;

  if (resp.error) {
    logUnlessMissing("loadEventApplications", resp.error);
    return [];
  }
  return (resp.data ?? []).map(normalizeRow);
}

/**
 * 행사별 접수 현황. 뷰가 없으면(마이그레이션 전) 전부 0.
 * approved_people 이 정원과 직접 비교하는 값.
 */
export async function loadEventApplicationCounts(
  eventId: string
): Promise<OrgEventApplicationCounts> {
  if (!eventId) return EMPTY_COUNTS;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("view_org_event_application_counts" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<Record<string, unknown>>
          >;
        };
      };
    }
  )
    // "*" 인 이유: canceled_count 는 나중에 실행될 마이그레이션 컬럼이라,
    // 명시 열거하면 SQL 적용 전 배포 창에서 뷰 조회가 통째로 실패한다.
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle()) as SbRespOne<Record<string, unknown>>;

  if (resp.error) {
    logUnlessMissing("loadEventApplicationCounts", resp.error);
    return EMPTY_COUNTS;
  }
  const d = resp.data;
  if (!d) return EMPTY_COUNTS;
  return {
    pending_count: Number(d.pending_count ?? 0),
    approved_count: Number(d.approved_count ?? 0),
    rejected_count: Number(d.rejected_count ?? 0),
    canceled_count: Number(d.canceled_count ?? 0),
    approved_people: Number(d.approved_people ?? 0),
  };
}

/**
 * 이 행사 참가자들의 연락처(숫자만).
 * 접수 탭에서 "이미 참가 중인 연락처" 배지를 띄우는 용도 — 관리자가 같은 사람을
 * 두 번 등록하지 않게 한다.
 */
export async function loadEventParticipantPhones(
  eventId: string
): Promise<string[]> {
  if (!eventId) return [];
  const supabase = await createClient();

  const partResp = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<SbResp<{ user_id: string }>>;
      };
    }
  )
    .select("user_id")
    .eq("event_id", eventId)) as SbResp<{ user_id: string }>;

  if (partResp.error) {
    logUnlessMissing("loadEventParticipantPhones/participants", partResp.error);
    return [];
  }
  const ids = (partResp.data ?? []).map((r) => r.user_id).filter(Boolean);
  if (ids.length === 0) return [];

  const userResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<SbResp<{ phone: string }>>;
      };
    }
  )
    .select("phone")
    .in("id", ids)) as SbResp<{ phone: string }>;

  if (userResp.error) {
    logUnlessMissing("loadEventParticipantPhones/users", userResp.error);
    return [];
  }
  // 레거시 데이터가 하이픈 포함으로 저장된 경우가 있어 숫자만 남긴다.
  return (userResp.data ?? [])
    .map((r) => (r.phone ?? "").replace(/\D/g, ""))
    .filter(Boolean);
}

/** 참가자 한 명(가족)의 참석 구성. 아직 접수를 안 거친 행은 0/0 이다. */
export type EventPartyCount = {
  party_size: number;
  adult_count: number;
  senior_count: number;
  child_count: number;
};

/**
 * 행사 참가자별 참석 인원 구성 — 참가자 탭 배지용.
 *
 * 기관 전체 풀을 읽는 loadParticipantOptionsForOrg 에 끼워 넣지 않고 따로 조회한다.
 * 이 값은 행사별 데이터(org_event_participants)라 기관 단위 쿼리에 섞으면
 * 조인이 늘고 다른 화면까지 느려진다.
 *
 * 반환 형태가 Map 이 아니라 Record 인 이유: 서버 컴포넌트 → 클라이언트 컴포넌트로
 * prop 직렬화가 되어야 한다.
 */
export async function loadEventPartyCounts(
  eventId: string
): Promise<Record<string, EventPartyCount>> {
  if (!eventId) return {};
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<SbResp<Record<string, unknown>>>;
      };
    }
  )
    // "*" 인 이유: adult_count/child_count 는 나중에 실행될 마이그레이션 컬럼이라,
    // 명시 열거하면 SQL 적용 전 배포 창에서 참가자 탭이 통째로 깨진다.
    .select("*")
    .eq("event_id", eventId)) as SbResp<Record<string, unknown>>;

  if (resp.error) {
    logUnlessMissing("loadEventPartyCounts", resp.error);
    return {};
  }

  const out: Record<string, EventPartyCount> = {};
  for (const row of resp.data ?? []) {
    const userId = typeof row.user_id === "string" ? row.user_id : "";
    if (!userId) continue;
    out[userId] = {
      party_size: Number(row.party_size ?? 1),
      adult_count: Number(row.adult_count ?? 0),
      senior_count: Number(row.senior_count ?? 0),
      child_count: Number(row.child_count ?? 0),
    };
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* 단건 조회                                                                   */
/* -------------------------------------------------------------------------- */

export async function loadApplicationById(
  applicationId: string
): Promise<OrgEventApplicationRow | null> {
  if (!applicationId) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_event_applications" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<Record<string, unknown>>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", applicationId)
    .maybeSingle()) as SbRespOne<Record<string, unknown>>;

  if (resp.error) {
    logUnlessMissing("loadApplicationById", resp.error);
    return null;
  }
  return resp.data ? normalizeRow(resp.data) : null;
}

/** UNIQUE(event_id, phone) 기준 단건. 재제출 분기에 쓴다. */
export async function loadApplicationByPhone(
  eventId: string,
  phoneDigits: string
): Promise<OrgEventApplicationRow | null> {
  if (!eventId || !phoneDigits) return null;
  const supabase = await createClient();

  const resp = (await (
    supabase.from("org_event_applications" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<SbRespOne<Record<string, unknown>>>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("event_id", eventId)
    .eq("phone", phoneDigits)
    .maybeSingle()) as SbRespOne<Record<string, unknown>>;

  if (resp.error) {
    logUnlessMissing("loadApplicationByPhone", resp.error);
    return null;
  }
  return resp.data ? normalizeRow(resp.data) : null;
}

/**
 * 쿠키에 기록된 "내 신청서". 초대장 재방문 시 상태 카드를 띄우는 용도.
 *  - 쿠키가 없거나, 가리키는 신청서가 다른 행사 것이면 null.
 *  - 문자 알림을 보내지 않기로 했으므로 이 경로가 신청자의 주 확인 수단이다.
 */
export async function loadMyApplication(
  eventId: string
): Promise<OrgEventApplicationRow | null> {
  if (!eventId) return null;
  const store = await cookies();
  const id = store.get(applicationCookieName(eventId))?.value;
  if (!id) return null;

  const row = await loadApplicationById(id);
  if (!row || row.event_id !== eventId) return null;
  return row;
}

/* -------------------------------------------------------------------------- */
/* 개인정보 동의 문구 (기관 단위)                                              */
/* -------------------------------------------------------------------------- */

/**
 * 이 기관이 쓰는 동의 문구 설정. **화면에 뿌릴 문구가 아니라 원본 row** 다 —
 * 기관명 치환과 기본값 폴백은 순수 함수 `resolveOrgConsent` 가 맡는다
 * (편집 화면은 원본을, 신청 폼은 치환된 문구를 봐야 하므로 여기서 섞지 않는다).
 *
 * 컬럼이 아직 없는 배포 창(42703/PGRST204)이면 빈 객체를 돌려주고,
 * resolveOrgConsent 가 코드 기본 문구로 채운다 — 동의 화면이 비지 않게.
 */
export async function loadOrgApplicationConsent(
  orgId: string
): Promise<OrgConsentSettings> {
  if (!orgId) return {};
  const supabase = await createClient();

  const resp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<Record<string, unknown>>>;
        };
      };
    }
  )
    // 컬럼을 나열하지 않는 이유: 마이그레이션 전에는 이름을 대는 순간 쿼리가
    // 통째로 실패한다. "*" 는 있는 것만 돌려준다.
    .select("*")
    .eq("id", orgId)
    .maybeSingle()) as SbRespOne<Record<string, unknown>>;

  if (resp.error || !resp.data) {
    logUnlessMissing("loadOrgApplicationConsent", resp.error);
    return {};
  }

  const raw = resp.data;
  return {
    application_consent_body:
      (raw.application_consent_body as string | null) ?? null,
    application_consent_optional_body:
      (raw.application_consent_optional_body as string | null) ?? null,
    // undefined(컬럼 없음)를 false 로 떨어뜨리면 선택 동의가 사라진다.
    // 명시적으로 false 일 때만 끈 것으로 본다.
    application_consent_optional_enabled:
      raw.application_consent_optional_enabled === false ? false : true,
    application_consent_updated_at:
      (raw.application_consent_updated_at as string | null) ?? null,
  };
}
