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
} from "./application-queries";
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

/* ========================================================================== */
/* 공개 — 신청서 제출                                                          */
/* ========================================================================== */

export type SubmitApplicationResult =
  | { ok: true; applicationId: string; updated: boolean; waitlisted: boolean }
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
  input: ApplicationInput
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

    // 4) 이미 참가자면 신청이 아니라 입장 안내
    const participantId = await findParticipantUserIdByPhone(eventId, phone);
    if (participantId) {
      return {
        ok: false,
        kind: "ALREADY_PARTICIPANT",
        message: "이미 이 행사에 참가 중인 연락처예요. 바로 입장하실 수 있어요",
      };
    }

    // 5) 기존 신청서 확인 → 수정 / 신규
    const existing = await loadApplicationByPhone(eventId, phone);
    if (existing?.status === "APPROVED") {
      return {
        ok: false,
        kind: "ALREADY_APPROVED",
        message: "이미 승인된 신청서가 있어요",
      };
    }

    const supabase = await createClient();
    const payload = {
      event_id: eventId,
      org_id: event.org_id,
      phone,
      children,
      companions,
      // 파생값 — 클라이언트가 보낸 숫자가 아니라 children/companions 로 계산된 값.
      party_size: partySize,
      status: "PENDING" as OrgEventApplicationStatus,
      // 재신청 시 이전 거절 사유·검토 기록은 지운다 (새 신청서로 취급).
      note: null,
      reviewed_by: null,
      reviewed_at: null,
    };

    let applicationId: string;

    if (existing) {
      const upd = (await (
        supabase.from("org_event_applications" as never) as unknown as {
          update: (p: unknown) => {
            eq: (k: string, v: string) => Promise<{ error: SbErr }>;
          };
        }
      )
        .update(payload)
        .eq("id", existing.id)) as { error: SbErr };
      if (upd.error) {
        console.error("[applications/submit] update error", upd.error);
        return {
          ok: false,
          kind: "ERROR",
          message: "신청서 저장에 실패했어요. 잠시 후 다시 시도해 주세요",
        };
      }
      applicationId = existing.id;
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
        .insert(payload)
        .select("id")
        .single()) as SbOne<{ id: string }>;

      if (ins.error || !ins.data) {
        console.error("[applications/submit] insert error", ins.error);
        return {
          ok: false,
          kind: "ERROR",
          message:
            "신청서 저장에 실패했어요. 기관에 접수가 열려 있는지 문의해 주세요",
        };
      }
      applicationId = ins.data.id;
    }

    // 6) 상태 카드용 쿠키 — 문자를 보내지 않으므로 신청자의 주 확인 수단.
    const store = await cookies();
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
      const userId = app.approved_user_id;

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
        console.error("[applications/revert] 참가 아동 해제 실패", delChildren.error);
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
      if (delPart.error) {
        console.error("[applications/revert] 참가 해제 실패", delPart.error);
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
