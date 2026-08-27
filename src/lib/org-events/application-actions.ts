"use server";

// 행사 참가 접수(신청서) 서버 액션.
//
// 두 갈래로 나뉜다:
//   · 공개  — 초대장 하단 폼에서 호출. 로그인 없이 누구나 (링크 = 자격).
//             rate limit + 입력 검증이 유일한 방어선이므로 느슨하게 두면 안 된다.
//   · 관리자 — requireOrg() + 행사 소유 확인 후 수락/거절/되돌리기.
//
// 승인의 핵심은 **새 로직을 만들지 않는 것**이다. 계정 생성·병합, 소속 추가,
// 자녀 dedup, 토리톡 방 자동 가입은 전부 upsertParticipantWithChildren 에 이미
// 있다. 신청서를 FormData 로 되돌려 그 함수를 그대로 태운다.

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-auth-guard";
import { toIsoKstFromLocalInput } from "@/lib/datetime/kst";
import {
  rateLimit,
  getClientIpFromHeaders,
  maybeGcBuckets,
} from "@/lib/rate-limit";
import {
  upsertParticipantWithChildren,
  linkUsersToEvent,
} from "@/lib/app-user/upsert-with-children";
import { loadOrgEventById } from "./queries";
import {
  applicationCookieName,
  loadApplicationById,
  loadApplicationByPhone,
  loadOrgApplicationConsent,
} from "./application-queries";
import {
  checkConsentAgreed,
  consentFingerprint,
  resolveOrgConsent,
  validateConsentBodies,
  type ConsentSnapshot,
} from "./consent-core";
import { loadOrgNameById } from "@/lib/org-partner";
import {
  computeHeadcount,
  deriveParentName,
  digitsOnly,
  maskName,
  resolveApplicationGate,
  validateApplicationInput,
  type ApplicationInput,
} from "./application-core";
import type {
  ApplicationChild,
  OrgEventApplicationStatus,
} from "./types";

type SbErr = { message: string; code?: string } | null;
type SbOne<T> = { data: T | null; error: SbErr };

/** 쿠키 수명 — 행사가 끝날 때까지 상태 카드를 볼 수 있게 넉넉히. */
const APPLY_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90일

/**
 * 마이그레이션 미적용 (컬럼 없음).
 * 코드가 먼저 배포되고 SQL 이 나중에 도는 창에서 새 컬럼을 쓰면 이 코드가 온다.
 */
function isMissingColumn(error: SbErr): boolean {
  const code = error?.code;
  return code === "42703" || code === "PGRST204";
}

/* -------------------------------------------------------------------------- */
/* 공통 헬퍼                                                                   */
/* -------------------------------------------------------------------------- */

async function assertEventOwned(eventId: string, orgId: string) {
  const event = await loadOrgEventById(eventId);
  if (!event) throw new Error("행사를 찾을 수 없어요");
  if (event.org_id !== orgId) throw new Error("권한이 없어요");
  return event;
}

/**
 * 이 연락처가 이미 이 행사 참가자인가.
 * 신청서를 새로 받을 필요가 없는 경우를 걸러낸다 (기관이 미리 명단에 올린 사람 등).
 */
async function findParticipantUserIdByPhone(
  eventId: string,
  phoneDigits: string
): Promise<string | null> {
  const supabase = await createClient();

  const userResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbOne<{ id: string }>>;
        };
      };
    }
  )
    .select("id")
    .eq("phone", phoneDigits)
    .maybeSingle()) as SbOne<{ id: string }>;

  const userId = userResp.data?.id;
  if (!userId) return null;

  const partResp = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<SbOne<{ user_id: string }>>;
          };
        };
      };
    }
  )
    .select("user_id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle()) as SbOne<{ user_id: string }>;

  return partResp.data ? userId : null;
}

/**
 * 이 행사에서 참가를 해제한다 — 참가 아동 → 참가 순서.
 *
 * 승인 취소(revert)와 참가 취소(cancel)가 공유한다. 계정·자녀·소속·도토리는
 * 건드리지 않는다: 다른 행사에서 쓰이고, 되돌릴 때 다시 필요하다.
 */
async function releaseParticipation(
  eventId: string,
  userId: string
): Promise<SbErr> {
  const supabase = await createClient();

  const delChildren = (await (
    supabase.from("org_event_participant_children" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId)) as { error: SbErr };
  if (delChildren.error) {
    console.error("[applications/release] 참가 아동 해제 실패", {
      code: delChildren.error.code,
    });
  }

  const delPart = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId)) as { error: SbErr };

  return delPart.error;
}

/** 신청서 children(jsonb) → upsertParticipantWithChildren 이 읽는 FormData. */
function buildParticipantFormData(children: ApplicationChild[]): FormData {
  const fd = new FormData();
  fd.set("parent_name", deriveParentName(children));
  for (const [i, c] of children.entries()) {
    fd.append("child_name", c.name);
    fd.append("child_class", c.class_name ?? "");
    fd.append("child_birth", "");
    // 첫째만 원생(is_enrolled)로 — 기존 parseChildrenFromFormData 기본값과 동일.
    fd.append("child_enrolled", i === 0 ? "1" : "0");
  }
  return fd;
}

/**
 * 신청서 한 건 쓰기 (신규 insert / 재제출 update).
 *
 * 동의 컬럼이 아직 없는 배포 창(42703 / PGRST204)이면 그 3필드를 빼고 한 번 더
 * 시도한다. 동의 **기록**은 못 남기지만 접수 자체가 죽는 것보다 낫고, 신청자는
 * 화면에서 이미 동의 문구를 읽고 체크했다(문구는 코드 기본값으로 항상 뜬다).
 */
async function writeApplicationRow(
  existingId: string | null,
  payload: Record<string, unknown>,
  consentFields: Record<string, unknown>
): Promise<{ id: string } | { error: SbErr }> {
  const supabase = await createClient();
  const bodies = [{ ...payload, ...consentFields }, payload];

  let lastError: SbErr = null;

  for (const body of bodies) {
    if (existingId) {
      const upd = (await (
        supabase.from("org_event_applications" as never) as unknown as {
          update: (p: unknown) => {
            eq: (k: string, v: string) => Promise<{ error: SbErr }>;
          };
        }
      )
        .update(body)
        .eq("id", existingId)) as { error: SbErr };
      if (!upd.error) return { id: existingId };
      lastError = upd.error;
    } else {
      const ins = (await (
        supabase.from("org_event_applications" as never) as unknown as {
          insert: (p: unknown) => {
            select: (c: string) => {
              single: () => Promise<SbOne<{ id: string }>>;
            };
          };
        }
      )
        .insert(body)
        .select("id")
        .single()) as SbOne<{ id: string }>;
      if (!ins.error && ins.data) return { id: ins.data.id };
      lastError = ins.error ?? { message: "insert 가 행을 돌려주지 않았어요" };
    }

    // 컬럼 문제가 아니면 재시도해도 같은 결과다.
    if (!isMissingColumn(lastError)) break;
    console.warn(
      "[applications/submit] 동의 컬럼 미적용 — 동의 기록 없이 저장합니다"
    );
  }

  return { error: lastError };
}

/* ========================================================================== */
/* 공개 — 신청서 제출                                                          */
/* ========================================================================== */

/**
 * 신청자가 화면에서 실제로 체크한 것.
 *
 * fingerprint 는 **그 사람이 읽은 문구**의 지문이다. 읽는 사이 기관이 문구를
 * 고치면 읽지 않은 글에 동의한 기록이 남게 되므로, 서버가 현재 문구와 대조해
 * 다르면 되돌린다.
 */
export type SubmitApplicationConsent = {
  agreed: boolean;
  optionalAgreed: boolean;
  fingerprint: string;
};

export type SubmitApplicationResult =
  | { ok: true; applicationId: string; updated: boolean; waitlisted: boolean }
  /** 읽은 문구와 현재 문구가 달라졌다 — 새 문구를 다시 보여주고 재확인받는다. */
  | { ok: false; kind: "CONSENT_CHANGED"; message: string }
  /** 이미 이 행사 참가자 — 신청이 아니라 입장 안내를 보여줘야 한다. */
  | { ok: false; kind: "ALREADY_PARTICIPANT"; message: string }
  /** 이미 승인된 신청서가 있음. */
  | { ok: false; kind: "ALREADY_APPROVED"; message: string }
  | { ok: false; kind: "CLOSED"; message: string }
  | { ok: false; kind: "INVALID"; message: string }
  | { ok: false; kind: "RATE_LIMITED"; message: string }
  | { ok: false; kind: "ERROR"; message: string };

/**
 * 초대장 하단 신청서 제출. 로그인 불필요.
 *
 * 재제출 정책 (UNIQUE(event_id, phone) 충돌):
 *   PENDING  → 덮어쓰기 (신청 내용 수정으로 취급)
 *   REJECTED → 덮어쓰기 + PENDING 복귀 (재신청 허용)
 *   APPROVED → 거부
 */
export async function submitEventApplicationAction(
  eventId: string,
  input: ApplicationInput,
  /**
   * 배포 창에 남은 옛 번들이 이 인자를 빼고 부를 수 있어서 optional 이다.
   * 없으면 "동의 안 함" 으로 취급해 막는다 — 조용히 통과시키면 동의 없이
   * 개인정보를 수집하게 된다.
   */
  consent?: SubmitApplicationConsent
): Promise<SubmitApplicationResult> {
  try {
    if (!eventId) {
      return { ok: false, kind: "INVALID", message: "행사 정보가 없어요" };
    }

    // 1) rate limit — IP 와 연락처 두 축. 링크만 알면 누구나 부를 수 있는 경로다.
    const ip = getClientIpFromHeaders(await headers()) ?? "unknown";
    const ipLimit = rateLimit({
      key: `event-apply-ip:${ip}`,
      windowMs: 10 * 60_000,
      max: 10,
    });
    maybeGcBuckets();
    if (!ipLimit.allowed) {
      return {
        ok: false,
        kind: "RATE_LIMITED",
        message: "잠시 후 다시 시도해 주세요",
      };
    }

    // 2) 입력 검증 (클라이언트와 같은 규칙 — application-core)
    const validated = validateApplicationInput(input);
    if (!validated.ok) {
      return { ok: false, kind: "INVALID", message: validated.message };
    }
    const { phone, children, companions, partySize } = validated.value;

    // 2-1) 필수 동의 — 버튼을 잠그는 것과 별개로 서버가 다시 본다.
    //      링크만 알면 부를 수 있는 경로라 클라이언트 검증은 방어선이 아니다.
    const consentCheck = checkConsentAgreed(consent?.agreed === true);
    if (!consentCheck.ok) {
      return { ok: false, kind: "INVALID", message: consentCheck.message };
    }

    const phoneLimit = rateLimit({
      key: `event-apply-phone:${phone}`,
      windowMs: 10 * 60_000,
      max: 5,
    });
    if (!phoneLimit.allowed) {
      return {
        ok: false,
        kind: "RATE_LIMITED",
        message: "같은 번호로 너무 자주 신청했어요. 잠시 후 다시 시도해 주세요",
      };
    }

    // 3) 행사 검증 — 발행된 초대장 + 접수 열림 + 마감 전
    const event = await loadOrgEventById(eventId);
    if (!event) {
      return { ok: false, kind: "INVALID", message: "행사를 찾을 수 없어요" };
    }
    if (!event.invitation_published_at) {
      return {
        ok: false,
        kind: "CLOSED",
        message: "아직 초대장이 발행되지 않았어요",
      };
    }
    const gate = resolveApplicationGate({
      enabled: event.applications_enabled,
      closeAt: event.applications_close_at,
      // 마감 미지정이면 "행사 시작 1시간 전" 이 자동 마감이 된다.
      startsAt: event.starts_at,
      capacity: event.applications_capacity,
      approvedPeople: 0, // 제출 차단 기준이 아니므로 조회하지 않는다
      nowMs: Date.now(),
    });
    if (gate.kind === "DISABLED") {
      return {
        ok: false,
        kind: "CLOSED",
        message: "이 행사는 신청서를 받지 않아요",
      };
    }
    if (gate.kind === "CLOSED") {
      return { ok: false, kind: "CLOSED", message: "접수가 마감됐어요" };
    }

    // 4) 기존 신청서 + 본인 여부
    //
    //    쿠키가 그 신청서를 가리키면 본인이 자기 신청을 고치는 것이고,
    //    쿠키가 없으면 같은 번호를 아는 제3자가 남의 참가를 건드리는 것이다.
    //    본인 확인 근거로 쿠키를 쓰는 것은 cancelMyApplicationAction 과 같다.
    const existing = await loadApplicationByPhone(eventId, phone);
    const store = await cookies();
    const ownedId = store.get(applicationCookieName(eventId))?.value;
    const isOwner = !!existing && !!ownedId && ownedId === existing.id;

    // 5) 이미 참가자면 신청이 아니라 입장 안내.
    //    단, **본인이 자기 신청서를 고치는 중이면 건너뛴다** — 승인된 사람은
    //    당연히 참가자이므로, 이 검사를 그대로 두면 인원 수정이 영영 막힌다.
    if (!isOwner) {
      const participantId = await findParticipantUserIdByPhone(eventId, phone);
      if (participantId) {
        return {
          ok: false,
          kind: "ALREADY_PARTICIPANT",
          message:
            "이미 이 행사에 참가 중인 연락처예요. 바로 입장하실 수 있어요",
        };
      }
    }

    // 6) 승인된 신청서 덮어쓰기는 본인만.
    //    인원이 바뀌면 기관이 다시 확인해야 한다(정책) — 참가를 풀고 PENDING 으로
    //    되돌린다. 실제 해제는 아래 검증을 모두 통과한 뒤에 한다(반쪽 상태 방지).
    if (existing?.status === "APPROVED" && !isOwner) {
      return {
        ok: false,
        kind: "ALREADY_APPROVED",
        message: "이미 승인된 신청서가 있어요",
      };
    }
    const releaseUserId =
      existing?.status === "APPROVED" ? existing.approved_user_id : null;

    // 동의 스냅샷은 **서버가 다시 읽어서** 만든다. 클라이언트가 보낸 문구를
    // 그대로 저장하면 아무 글에나 동의한 기록을 만들 수 있다.
    const [consentRow, orgName] = await Promise.all([
      loadOrgApplicationConsent(event.org_id),
      loadOrgNameById(event.org_id),
    ]);
    const liveConsent = resolveOrgConsent(consentRow, orgName);

    // 읽은 문구와 지금 문구가 다르면 되돌린다 (관리자가 그사이 수정한 경우).
    if (consent?.fingerprint !== consentFingerprint(liveConsent)) {
      return {
        ok: false,
        kind: "CONSENT_CHANGED",
        message:
          "개인정보 동의 문구가 방금 변경됐어요. 새 문구를 확인하고 다시 신청해 주세요",
      };
    }

    const agreedAt = new Date().toISOString();
    const snapshot: ConsentSnapshot = {
      required: liveConsent.required,
      // 선택 동의를 안 했으면 그 문구는 남기지 않는다 — 동의하지 않은 글을
      // 스냅샷에 넣으면 나중에 "동의했다" 로 읽힌다.
      optional:
        liveConsent.optional && consent?.optionalAgreed
          ? liveConsent.optional
          : null,
    };

    const payload = {
      event_id: eventId,
      org_id: event.org_id,
      phone,
      children,
      companions,
      // 파생값 — 클라이언트가 보낸 숫자가 아니라 children/companions 로 계산된 값.
      party_size: partySize,
      status: "PENDING" as OrgEventApplicationStatus,
      // 승인이 풀렸으므로 계정 연결도 끊는다. 재승인 때 다시 채워진다.
      // (빠져 있으면 죽은 계정 참조가 남아 초대장이 "승인됨" 으로 오인한다)
      approved_user_id: null,
      // 재신청 시 이전 거절 사유·검토 기록·취소 흔적은 지운다 (새 신청서로 취급).
      note: null,
      reviewed_by: null,
      reviewed_at: null,
      canceled_at: null,
      cancel_reason: null,
    };

    const consentFields = {
      consent_agreed_at: agreedAt,
      // 스냅샷에 문구가 남은 경우에만 시각을 찍는다 — 시각만 있고 문구가
      // 없는 반쪽 기록이 생기지 않게(기관이 선택 동의를 끈 사이 제출된 경우).
      consent_optional_agreed_at: snapshot.optional ? agreedAt : null,
      consent_snapshot: snapshot,
    };

    // 검증이 모두 끝난 뒤에 참가를 푼다. 앞에서 풀어버리면 아래 검증에 걸렸을 때
    // "승인은 풀렸는데 신청서는 그대로" 인 반쪽 상태가 남는다.
    if (releaseUserId) {
      const relErr = await releaseParticipation(eventId, releaseUserId);
      if (relErr) {
        console.error("[applications/submit] 참가 해제 실패", relErr);
        return {
          ok: false,
          kind: "ERROR",
          message: "수정 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요",
        };
      }
    }

    const written = await writeApplicationRow(
      existing?.id ?? null,
      payload,
      consentFields
    );
    if ("error" in written) {
      console.error("[applications/submit] write error", written.error);
      return {
        ok: false,
        kind: "ERROR",
        message: existing
          ? "신청서 저장에 실패했어요. 잠시 후 다시 시도해 주세요"
          : "신청서 저장에 실패했어요. 기관에 접수가 열려 있는지 문의해 주세요",
      };
    }
    const applicationId = written.id;

    // 6) 상태 카드용 쿠키 — 문자를 보내지 않으므로 신청자의 주 확인 수단.
    store.set(applicationCookieName(eventId), applicationId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: APPLY_COOKIE_MAX_AGE,
    });

    revalidatePath(`/org/${event.org_id}/events/${eventId}`);

    return {
      ok: true,
      applicationId,
      updated: !!existing,
      waitlisted: gate.atCapacity,
    };
  } catch (err) {
    console.error("[applications/submit] threw", err);
    return {
      ok: false,
      kind: "ERROR",
      message: "신청 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요",
    };
  }
}

/* ========================================================================== */
/* 공개 — 연락처로 내 신청 상태 확인 (쿠키가 날아갔을 때)                       */
/* ========================================================================== */

export type ApplicationLookupResult =
  | {
      ok: true;
      found: true;
      status: OrgEventApplicationStatus;
      /** 마스킹된 원아명 — 본인 확인용 힌트. */
      maskedNames: string[];
      partySize: number;
      childCount: number;
      adultCount: number;
      seniorCount: number;
      submittedAt: string;
    }
  | { ok: true; found: false }
  | { ok: false; message: string };

/**
 * 연락처로 신청 상태만 조회.
 *
 * 남의 번호를 넣어볼 수 있는 경로이므로 노출을 최소화한다:
 *   상태 + 마스킹된 원아명 + 인원 + 신청 시각. 거절 사유는 절대 내보내지 않는다.
 * rate limit 도 제출보다 빡빡하게.
 */
export async function lookupMyApplicationAction(
  eventId: string,
  phoneRaw: string
): Promise<ApplicationLookupResult> {
  try {
    const ip = getClientIpFromHeaders(await headers()) ?? "unknown";
    const rl = rateLimit({
      key: `event-apply-lookup:${ip}`,
      windowMs: 10 * 60_000,
      max: 10,
    });
    maybeGcBuckets();
    if (!rl.allowed) {
      return { ok: false, message: "잠시 후 다시 시도해 주세요" };
    }

    const phone = digitsOnly(phoneRaw);
    if (phone.length < 10 || phone.length > 11) {
      return { ok: false, message: "연락처를 올바르게 입력해 주세요" };
    }

    const row = await loadApplicationByPhone(eventId, phone);
    if (!row) return { ok: true, found: false };

    // 확인된 본인 — 다음 방문부터는 쿠키로 바로 뜨게 심어준다.
    const store = await cookies();
    store.set(applicationCookieName(eventId), row.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: APPLY_COOKIE_MAX_AGE,
    });

    const head = computeHeadcount(row.children, row.companions);
    return {
      ok: true,
      found: true,
      status: row.status,
      maskedNames: row.children.map((c) => maskName(c.name)),
      partySize: row.party_size,
      childCount: head.childCount,
      adultCount: head.adultCount,
      seniorCount: head.seniorCount,
      submittedAt: row.created_at,
    };
  } catch (err) {
    console.error("[applications/lookup] threw", err);
    return { ok: false, message: "조회 중 오류가 발생했어요" };
  }
}

/* ========================================================================== */
/* 관리자 — 수락 / 거절 / 되돌리기                                             */
/* ========================================================================== */

export type ReviewResult =
  | { ok: true; userId?: string }
  | { ok: false; message: string };

/**
 * 신청서 수락 → 진짜 참가자로 승격.
 *
 * 순서가 중요하다. 계정이 먼저 있어야 참가·자녀 연결을 걸 수 있고,
 * 신청서 상태는 그 모두가 성공한 뒤에 마지막으로 바꾼다. 중간에 실패하면
 * 신청서는 PENDING 으로 남아 다시 시도할 수 있다 (전부 멱등).
 */
export async function approveEventApplicationAction(
  orgId: string,
  eventId: string,
  applicationId: string
): Promise<ReviewResult> {
  try {
    const session = await requireOrg();
    if (!orgId || orgId !== session.orgId) {
      return { ok: false, message: "이 기관의 접수를 처리할 권한이 없어요" };
    }
    await assertEventOwned(eventId, orgId);

    const app = await loadApplicationById(applicationId);
    if (!app || app.event_id !== eventId) {
      return { ok: false, message: "신청서를 찾을 수 없어요" };
    }
    if (app.status === "APPROVED") {
      return { ok: true, userId: app.approved_user_id ?? undefined };
    }
    if (app.children.length === 0) {
      return { ok: false, message: "원아 정보가 없는 신청서예요" };
    }

    // 1) 보호자 + 자녀 — 기존 공용 헬퍼 그대로. 계정 병합·소속·토리톡까지 처리된다.
    const fd = buildParticipantFormData(app.children);
    fd.set("phone", app.phone);
    const { userId, childIds } = await upsertParticipantWithChildren(
      orgId,
      fd,
      { membershipSource: "application" }
    );

    // 2) 행사 참가 (멱등)
    await linkUsersToEvent(eventId, [userId]);

    const supabase = await createClient();

    // 3) 참석 인원 + 아동/성인 구성 반영 — 신규/기존 어느 쪽이든 같은 경로로 갱신.
    const head = computeHeadcount(app.children, app.companions);
    const partyResp = (await (
      supabase.from("org_event_participants" as never) as unknown as {
        update: (p: unknown) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => Promise<{ error: SbErr }>;
          };
        };
      }
    )
      .update({
        party_size: app.party_size,
        adult_count: head.adultCount,
        senior_count: head.seniorCount,
        child_count: head.childCount,
      })
      .eq("event_id", eventId)
      .eq("user_id", userId)) as { error: SbErr };
    if (partyResp.error) {
      // 컬럼이 아직 없을 수 있다(마이그레이션 전). 승인 자체를 막지는 않는다.
      console.error("[applications/approve] 참석 인원 갱신 실패", {
        code: partyResp.error.code,
      });
    }

    // 4) 이 행사에 참가하는 아동 지정 — 신청서에 적힌 아이만.
    if (childIds.length > 0) {
      const linkResp = (await (
        supabase.from("org_event_participant_children" as never) as unknown as {
          upsert: (
            p: unknown,
            o: { onConflict: string }
          ) => Promise<{ error: SbErr }>;
        }
      ).upsert(
        childIds.map((child_id) => ({ event_id: eventId, user_id: userId, child_id })),
        { onConflict: "event_id,child_id" }
      )) as { error: SbErr };
      if (linkResp.error && linkResp.error.code !== "23505") {
        console.error("[applications/approve] 참가 아동 연결 실패", {
          code: linkResp.error.code,
        });
      }
    }

    // 5) 신청서 확정
    const updResp = (await (
      supabase.from("org_event_applications" as never) as unknown as {
        update: (p: unknown) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({
        status: "APPROVED",
        approved_user_id: userId,
        reviewed_by: session.managerId,
        reviewed_at: new Date().toISOString(),
        note: null,
      })
      .eq("id", applicationId)) as { error: SbErr };

    if (updResp.error) {
      console.error("[applications/approve] 상태 갱신 실패", updResp.error);
      return {
        ok: false,
        message:
          "참가자는 등록됐지만 신청서 상태 갱신에 실패했어요. 새로고침 후 다시 시도해 주세요",
      };
    }

    // 문자 알림 훅 자리 — 지금은 보내지 않는다(정책).
    //   붙일 때: sendSms({ phone: app.phone, text: ... })  @/lib/sms/send
    //   자격증명이 없으면 자동 skip 되므로 로컬/CI 에서도 안전하다.

    revalidatePath(`/org/${orgId}/events/${eventId}`);
    revalidatePath(`/org/${orgId}/users`);
    return { ok: true, userId };
  } catch (err) {
    console.error("[applications/approve] threw", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `수락 실패: ${msg}` };
  }
}

/** 신청서 거절. 사유는 관리자 메모로만 남고 신청자에게 노출하지 않는다. */
export async function rejectEventApplicationAction(
  orgId: string,
  eventId: string,
  applicationId: string,
  reason?: string
): Promise<ReviewResult> {
  try {
    const session = await requireOrg();
    if (!orgId || orgId !== session.orgId) {
      return { ok: false, message: "이 기관의 접수를 처리할 권한이 없어요" };
    }
    await assertEventOwned(eventId, orgId);

    const app = await loadApplicationById(applicationId);
    if (!app || app.event_id !== eventId) {
      return { ok: false, message: "신청서를 찾을 수 없어요" };
    }
    if (app.status === "APPROVED") {
      return {
        ok: false,
        message: "이미 승인된 신청서예요. 먼저 '승인 취소' 를 해주세요",
      };
    }

    const supabase = await createClient();
    const resp = (await (
      supabase.from("org_event_applications" as never) as unknown as {
        update: (p: unknown) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({
        status: "REJECTED",
        note: (reason ?? "").trim().slice(0, 500) || null,
        reviewed_by: session.managerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", applicationId)) as { error: SbErr };

    if (resp.error) {
      console.error("[applications/reject] error", resp.error);
      return { ok: false, message: "거절 처리에 실패했어요" };
    }

    revalidatePath(`/org/${orgId}/events/${eventId}`);
    return { ok: true };
  } catch (err) {
    console.error("[applications/reject] threw", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `거절 실패: ${msg}` };
  }
}

/* ========================================================================== */
/* 참가 취소 — 신청자 본인 / 관리자 대행                                       */
/* ========================================================================== */

export type CancelApplicationResult =
  | { ok: true; wasApproved: boolean }
  | { ok: false; kind: "NOT_FOUND" | "RATE_LIMITED" | "ERROR"; message: string };

/**
 * 신청서를 취소 상태로 바꾸고, 승인돼 있었다면 참가도 해제한다.
 *
 * 삭제하지 않는 이유: 누가 언제 왜 빠졌는지는 정원 운영·간식 산정에 그대로
 * 필요한 정보다. 접수 탭 [취소] 목록에 남는다.
 */
async function applyCancel(
  app: {
    id: string;
    event_id: string;
    status: OrgEventApplicationStatus;
    approved_user_id: string | null;
  },
  reason: string | undefined,
  reviewedBy: string | null
): Promise<CancelApplicationResult> {
  // 이미 취소된 건은 성공으로 친다 (버튼 두 번 눌러도 안전).
  if (app.status === "CANCELED") {
    return { ok: true, wasApproved: false };
  }

  const wasApproved = app.status === "APPROVED" && !!app.approved_user_id;
  if (wasApproved && app.approved_user_id) {
    const err = await releaseParticipation(app.event_id, app.approved_user_id);
    if (err) {
      console.error("[applications/cancel] 참가 해제 실패", err);
      return {
        ok: false,
        kind: "ERROR",
        message: "참가 해제에 실패했어요. 잠시 후 다시 시도해 주세요",
      };
    }
  }

  const supabase = await createClient();
  const upd = (await (
    supabase.from("org_event_applications" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      status: "CANCELED",
      canceled_at: new Date().toISOString(),
      cancel_reason: (reason ?? "").trim().slice(0, 500) || null,
      // 승인이 풀렸으므로 연결도 끊는다. 재신청하면 다시 채워진다.
      approved_user_id: null,
      reviewed_by: reviewedBy,
    })
    .eq("id", app.id)) as { error: SbErr };

  if (upd.error) {
    console.error("[applications/cancel] 상태 갱신 실패", upd.error);
    return {
      ok: false,
      kind: "ERROR",
      message: "취소 처리에 실패했어요. 잠시 후 다시 시도해 주세요",
    };
  }

  return { ok: true, wasApproved };
}

/**
 * 신청자 본인이 취소 — 초대장 상태 카드의 [참가 취소].
 *
 * 쿠키로 "내 신청서" 를 특정한다. 링크만 아는 제3자가 남의 참가를 취소하지
 * 못하게 하는 최소 장치다. 쿠키가 없으면 연락처 조회를 먼저 하도록 안내한다
 * (lookupMyApplicationAction 이 확인과 동시에 쿠키를 심어준다).
 */
export async function cancelMyApplicationAction(
  eventId: string,
  reason?: string
): Promise<CancelApplicationResult> {
  try {
    if (!eventId) {
      return { ok: false, kind: "NOT_FOUND", message: "행사 정보가 없어요" };
    }

    const ip = getClientIpFromHeaders(await headers()) ?? "unknown";
    const rl = rateLimit({
      key: `event-cancel-ip:${ip}`,
      windowMs: 10 * 60_000,
      max: 10,
    });
    maybeGcBuckets();
    if (!rl.allowed) {
      return {
        ok: false,
        kind: "RATE_LIMITED",
        message: "잠시 후 다시 시도해 주세요",
      };
    }

    const store = await cookies();
    const id = store.get(applicationCookieName(eventId))?.value;
    if (!id) {
      return {
        ok: false,
        kind: "NOT_FOUND",
        message:
          "신청 정보를 확인할 수 없어요. 아래 '연락처로 확인하기' 로 본인 확인 후 다시 시도해 주세요",
      };
    }

    const app = await loadApplicationById(id);
    if (!app || app.event_id !== eventId) {
      return {
        ok: false,
        kind: "NOT_FOUND",
        message: "신청서를 찾을 수 없어요",
      };
    }

    const res = await applyCancel(app, reason, null);
    if (res.ok) {
      revalidatePath(`/org/${app.org_id}/events/${eventId}`);
    }
    return res;
  } catch (err) {
    console.error("[applications/cancelMine] threw", err);
    return {
      ok: false,
      kind: "ERROR",
      message: "취소 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요",
    };
  }
}

/**
 * 관리자 대행 취소 — 전화로 취소 통보를 받는 경우가 잦다.
 * 처리 내용은 본인 취소와 동일하고, 검토자만 기록된다.
 */
export async function cancelEventApplicationAction(
  orgId: string,
  eventId: string,
  applicationId: string,
  reason?: string
): Promise<ReviewResult> {
  try {
    const session = await requireOrg();
    if (!orgId || orgId !== session.orgId) {
      return { ok: false, message: "이 기관의 접수를 처리할 권한이 없어요" };
    }
    await assertEventOwned(eventId, orgId);

    const app = await loadApplicationById(applicationId);
    if (!app || app.event_id !== eventId) {
      return { ok: false, message: "신청서를 찾을 수 없어요" };
    }

    const res = await applyCancel(app, reason, session.managerId);
    if (!res.ok) return { ok: false, message: res.message };

    revalidatePath(`/org/${orgId}/events/${eventId}`);
    revalidatePath(`/org/${orgId}/users`);
    return { ok: true };
  } catch (err) {
    console.error("[applications/cancelByOrg] threw", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `취소 처리 실패: ${msg}` };
  }
}

/**
 * 대기 상태로 되돌리기.
 *
 * APPROVED 였다면 행사 참가·참가 아동 연결도 함께 해제한다.
 * 다만 app_users / app_children / 소속은 **남긴다** — 다른 행사에서 쓰일 수 있고,
 * 도토리 잔액과 활동 기록이 계정에 딸려 있기 때문. 계정을 지우는 건 참가자 탭의
 * 영구 삭제로만 한다.
 */
export async function revertEventApplicationAction(
  orgId: string,
  eventId: string,
  applicationId: string
): Promise<ReviewResult> {
  try {
    const session = await requireOrg();
    if (!orgId || orgId !== session.orgId) {
      return { ok: false, message: "이 기관의 접수를 처리할 권한이 없어요" };
    }
    await assertEventOwned(eventId, orgId);

    const app = await loadApplicationById(applicationId);
    if (!app || app.event_id !== eventId) {
      return { ok: false, message: "신청서를 찾을 수 없어요" };
    }

    const supabase = await createClient();

    if (app.status === "APPROVED" && app.approved_user_id) {
      const err = await releaseParticipation(eventId, app.approved_user_id);
      if (err) {
        console.error("[applications/revert] 참가 해제 실패", err);
        return { ok: false, message: "참가자 해제에 실패했어요" };
      }
    }

    const resp = (await (
      supabase.from("org_event_applications" as never) as unknown as {
        update: (p: unknown) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({
        status: "PENDING",
        approved_user_id: null,
        note: null,
        // 착오 취소 복구 — 취소 흔적도 같이 비운다.
        canceled_at: null,
        cancel_reason: null,
        reviewed_by: session.managerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", applicationId)) as { error: SbErr };

    if (resp.error) {
      console.error("[applications/revert] error", resp.error);
      return { ok: false, message: "되돌리기에 실패했어요" };
    }

    revalidatePath(`/org/${orgId}/events/${eventId}`);
    revalidatePath(`/org/${orgId}/users`);
    return { ok: true };
  } catch (err) {
    console.error("[applications/revert] threw", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `되돌리기 실패: ${msg}` };
  }
}

export type BulkApproveResult = {
  approved: number;
  failed: { id: string; message: string }[];
};

/**
 * 선택한 신청서 일괄 수락.
 * 한 건이 실패해도 나머지는 계속 진행하고, 실패 목록을 돌려준다.
 * (순차 처리 — 같은 연락처가 두 번 들어와도 계정이 중복 생성되지 않게)
 */
export async function approveEventApplicationsBulkAction(
  orgId: string,
  eventId: string,
  applicationIds: string[]
): Promise<BulkApproveResult> {
  const ids = Array.from(new Set((applicationIds ?? []).filter(Boolean)));
  const failed: { id: string; message: string }[] = [];
  let approved = 0;

  for (const id of ids) {
    const r = await approveEventApplicationAction(orgId, eventId, id);
    if (r.ok) approved += 1;
    else failed.push({ id, message: r.message });
  }

  return { approved, failed };
}

/* ========================================================================== */
/* 관리자 — 접수 설정                                                          */
/* ========================================================================== */

export type ApplicationSettingsInput = {
  enabled: boolean;
  /** datetime-local 값("2026-09-10T18:00") 또는 빈 문자열. KST 로 해석한다. */
  closeAtLocal: string;
  /** 빈 문자열이면 무제한. */
  capacity: string;
};

/**
 * 접수 ON/OFF · 마감 · 정원 저장.
 * updateEventSelfRegisterAction (actions.ts) 과 같은 모양 — 실패 시 throw 해서
 * 클라이언트 토글이 롤백하도록.
 */
export async function updateEventApplicationSettingsAction(
  orgId: string,
  eventId: string,
  input: ApplicationSettingsInput
): Promise<void> {
  const session = await requireOrg();
  if (!orgId || orgId !== session.orgId) {
    throw new Error("이 기관의 행사를 수정할 권한이 없어요");
  }
  await assertEventOwned(eventId, orgId);

  // datetime-local 은 KST 입력으로 간주 — 기존 폼들과 같은 규약.
  const closeAt = toIsoKstFromLocalInput(input.closeAtLocal);

  const capacityRaw = (input.capacity ?? "").trim();
  let capacity: number | null = null;
  if (capacityRaw) {
    const n = Math.trunc(Number(capacityRaw));
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("정원은 1 이상의 숫자로 입력해 주세요");
    }
    capacity = n;
  }

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_events" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      applications_enabled: input.enabled,
      applications_close_at: closeAt,
      applications_capacity: capacity,
    })
    .eq("id", eventId)) as { error: SbErr };

  if (resp.error) {
    console.error("[applications/settings] error", resp.error);
    throw new Error(`접수 설정 저장 실패: ${resp.error.message}`);
  }

  revalidatePath(`/org/${orgId}/events/${eventId}`);
}

/* ========================================================================== */
/* 관리자 — 개인정보 동의 문구 (기관 단위)                                      */
/* ========================================================================== */

export type ConsentSettingsInput = {
  /** [필수] 동의 전문. 빈 문자열은 거부한다 — 법적으로 필요한 안내다. */
  body: string;
  /** [선택] 계열사 공동이용 전문. */
  optionalBody: string;
  /** false 면 신청서에 선택 동의 줄 자체가 뜨지 않는다. */
  optionalEnabled: boolean;
};

/**
 * 이 기관이 쓰는 동의 문구 저장. **행사 단위가 아니라 기관 단위**다 —
 * 한 번 고치면 그 기관의 모든 행사 신청서에 적용된다.
 *
 * 이미 접수된 신청서는 영향받지 않는다. 제출 시점 전문을 각 행에 복사해 뒀기
 * 때문이고, 그게 이 기능의 핵심이다(무엇에 동의했는지를 나중에도 댈 수 있게).
 *
 * updateEventApplicationSettingsAction 과 같은 모양 — 실패 시 throw 해서
 * 클라이언트가 화면을 서버 값으로 되돌리도록.
 */
export async function updateOrgApplicationConsentAction(
  orgId: string,
  input: ConsentSettingsInput
): Promise<void> {
  const session = await requireOrg();
  if (!orgId || orgId !== session.orgId) {
    throw new Error("이 기관의 설정을 수정할 권한이 없어요");
  }

  const check = validateConsentBodies(input);
  if (!check.ok) throw new Error(check.message);

  const supabase = await createClient();
  const resp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      application_consent_body: input.body.trim(),
      // 선택 동의를 껐어도 문구는 지우지 않는다 — 다시 켤 때 되살아나게.
      application_consent_optional_body: input.optionalBody.trim() || null,
      application_consent_optional_enabled: input.optionalEnabled,
      application_consent_updated_at: new Date().toISOString(),
    })
    .eq("id", orgId)) as { error: SbErr };

  if (resp.error) {
    console.error("[applications/consent] error", resp.error);
    if (isMissingColumn(resp.error)) {
      throw new Error(
        "동의 문구 컬럼이 아직 준비되지 않았어요. 마이그레이션 실행 후 다시 시도해 주세요"
      );
    }
    throw new Error(`동의 문구 저장 실패: ${resp.error.message}`);
  }

  // 기관의 모든 행사 신청 폼이 이 문구를 쓴다.
  revalidatePath(`/org/${orgId}`, "layout");
}

/* ========================================================================== */
/* 관리자 — 취소된 신청서 영구 삭제                                            */
/* ========================================================================== */

/**
 * 취소된 신청서를 DB 에서 지운다. 되돌릴 수 없다.
 *
 * **CANCELED 만 허용한다.** 취소는 "지우지 않고 남긴다" 가 원칙이고 그 이유도
 * 분명하지만(누가 왜 빠졌는지는 정원 운영에 필요하다), 테스트로 만든 행이나
 * 잘못 들어온 접수까지 영원히 이고 갈 이유는 없다. 관리자가 이미 한 번 취소로
 * 걸러낸 건에 한해 최종 정리를 열어준다.
 *
 * 대기·승인·거절을 여기서 막는 이유:
 *   · APPROVED — 참가자 명단은 남는데 근거 신청서만 사라져 어긋난다
 *                (빼려면 먼저 취소해야 참가도 함께 정리된다)
 *   · PENDING  — 아직 판단하지 않은 건이다. 실수로 지우면 신청자만 기다린다
 *   · REJECTED — 거절 사유가 유일한 기록이다
 *   필요하면 먼저 [취소 처리] 를 거치게 해서, 삭제가 두 단계가 되도록 둔다.
 */
export async function deleteEventApplicationAction(
  orgId: string,
  eventId: string,
  applicationId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const session = await requireOrg();
    if (!orgId || orgId !== session.orgId) {
      return { ok: false, message: "이 기관의 접수를 처리할 권한이 없어요" };
    }
    await assertEventOwned(eventId, orgId);

    const app = await loadApplicationById(applicationId);
    if (!app || app.event_id !== eventId) {
      return { ok: false, message: "신청서를 찾을 수 없어요" };
    }
    if (app.status !== "CANCELED") {
      return {
        ok: false,
        message:
          "취소된 신청서만 삭제할 수 있어요. 먼저 [취소 처리]를 해주세요",
      };
    }

    const supabase = await createClient();
    const del = (await (
      supabase.from("org_event_applications" as never) as unknown as {
        delete: () => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .delete()
      .eq("id", applicationId)) as { error: SbErr };

    if (del.error) {
      console.error("[applications/delete] error", del.error);
      return { ok: false, message: `삭제 실패: ${del.error.message}` };
    }

    revalidatePath(`/org/${orgId}/events/${eventId}`);
    return { ok: true };
  } catch (err) {
    console.error("[applications/delete] threw", err);
    return { ok: false, message: "삭제 중 오류가 발생했어요" };
  }
}

/* ========================================================================== */
/* 관리자 — 동의 전문 열람 (목록에서 [보기])                                    */
/* ========================================================================== */

/**
 * 신청서 한 건의 동의 전문.
 *
 * 목록 응답에 실어 보내지 않는 이유: 한 건당 2KB 남짓이라 신청서가 쌓이면
 * 접수 탭을 열 때마다 수백 KB 를 브라우저로 넘기게 된다. 정작 쓰이는 건
 * [보기] 를 눌렀을 때뿐이라, 그때 한 건만 가져온다.
 */
export async function loadApplicationConsentAction(
  orgId: string,
  eventId: string,
  applicationId: string
): Promise<
  { ok: true; snapshot: ConsentSnapshot | null } | { ok: false; message: string }
> {
  try {
    const session = await requireOrg();
    if (!orgId || orgId !== session.orgId) {
      return { ok: false, message: "이 기관의 접수를 볼 권한이 없어요" };
    }
    await assertEventOwned(eventId, orgId);

    const app = await loadApplicationById(applicationId);
    if (!app || app.event_id !== eventId) {
      return { ok: false, message: "신청서를 찾을 수 없어요" };
    }
    return { ok: true, snapshot: app.consent_snapshot };
  } catch (err) {
    console.error("[applications/consentProof] threw", err);
    return { ok: false, message: "동의 기록을 불러오지 못했어요" };
  }
}
