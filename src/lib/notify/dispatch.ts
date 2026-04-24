// 통합 알림 디스패처.
//   - inapp  : notifications 테이블 insert (notify 헬퍼 재사용)
//   - sms    : Solapi (sendSms)
//   - email  : Resend (sendEmail)
//
// 원칙:
//   1) 각 채널은 독립적으로 Promise.all 병렬 실행. 한 채널 실패가 다른 채널을 막지 않는다.
//   2) app_users.notification_consent = false 이면 sms/email 은 skip (force=true 시 무시).
//      inapp 은 consent 와 무관 — DB 레코드일 뿐 푸시가 아니므로 항상 저장.
//   3) 환경변수 부재 시 sendSms/sendEmail 이 skip 처리 → 여기서 별도 분기 불필요.
//   4) 호출측은 await 결과를 확인할 수도, 그냥 fire-and-forget 으로 쓸 수도 있다.

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "@/lib/sms/send";
import { sendEmail } from "@/lib/email/send";
import { notify } from "@/lib/notifications";

/**
 * 알림 종류.
 * 새 종류 추가 시 여기에 키 추가.
 * - MISSION_APPROVED    : 미션 승인 → 유저에게 도토리 획득 알림
 * - MISSION_REJECTED    : 미션 반려
 * - BROADCAST_LAUNCHED  : 돌발 미션 시작
 * - EVENT_INVITE        : 이벤트 초대
 * - STAMPBOOK_COMPLETE  : 스탬프북 완성 (티어 달성 등)
 * - GENERIC             : 그 외 범용
 */
export type NotifyKind =
  | "MISSION_APPROVED"
  | "MISSION_REJECTED"
  | "BROADCAST_LAUNCHED"
  | "EVENT_INVITE"
  | "STAMPBOOK_COMPLETE"
  | "GENERIC";

export type NotifyChannel = "inapp" | "sms" | "email";

export interface NotifyPayload {
  /** 대상 user (app_users.id). 필수. */
  userId: string;
  /** 대상 phone (SMS 용). 없으면 DB 에서 조회. */
  phone?: string | null;
  /** 대상 email. 없으면 DB 에서 조회 (app_users 스키마에 email 컬럼이 있을 때만 의미 있음). */
  email?: string | null;
  /** 알림 종류 (로깅/분기용) */
  kind: NotifyKind;
  /** notifications.type 컬럼에 저장될 문자열 */
  type: string;
  /** 짧은 제목 — 인앱 표시 / SMS prefix / 이메일 subject */
  title: string;
  /** 본문 — 인앱 표시 / SMS 본문 / 이메일 plain text */
  message: string;
  /** 이메일 전용 HTML. 없으면 message 를 <br/> 변환해 사용. */
  emailHtml?: string;
  /** 발송 채널. 기본 ["inapp"] */
  channels?: NotifyChannel[];
  /**
   * notification_consent=false 여도 강제 발송 (OTP/중요 운영 공지 등).
   * 기본 false. inapp 채널은 consent 무관하게 항상 저장되므로 force 와 무관.
   */
  force?: boolean;
}

export type DispatchResult = {
  inapp?: { ok: boolean; skipped?: boolean; error?: string };
  sms?: { ok: boolean; skipped?: boolean; error?: string };
  email?: { ok: boolean; skipped?: boolean; error?: string };
};

type AppUserLookup = {
  phone: string | null;
  notification_consent: boolean | null;
};

async function lookupUserContact(
  supabase: SupabaseClient,
  userId: string
): Promise<AppUserLookup | null> {
  try {
    const resp = (await (
      supabase.from("app_users" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: AppUserLookup | null }>;
          };
        };
      }
    )
      .select("phone, notification_consent")
      .eq("id", userId)
      .maybeSingle()) as { data: AppUserLookup | null };
    return resp.data ?? null;
  } catch (e) {
    console.error(
      "[notify/dispatch] user lookup failed",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 통합 알림 발송.
 * 각 채널 결과를 개별 속성으로 반환 — 호출측이 선택적으로 확인.
 */
export async function dispatchNotify(
  supabase: SupabaseClient,
  payload: NotifyPayload
): Promise<DispatchResult> {
  const channels = payload.channels ?? ["inapp"];
  const result: DispatchResult = {};

  // consent/연락처 조회가 필요한 경우에만 DB hit
  let consent = true;
  let phone = payload.phone ?? null;
  const email = payload.email ?? null;

  const needsSmsLookup = channels.includes("sms") && !phone;
  const needsConsentCheck =
    !payload.force && (channels.includes("sms") || channels.includes("email"));

  if (needsSmsLookup || needsConsentCheck) {
    const u = await lookupUserContact(supabase, payload.userId);
    if (u) {
      if (!phone) phone = u.phone ?? null;
      consent = u.notification_consent ?? true;
    }
  }

  const tasks: Promise<unknown>[] = [];

  // 1) inapp — consent 무관, notifications 테이블 insert.
  if (channels.includes("inapp")) {
    tasks.push(
      notify(
        supabase as unknown as Parameters<typeof notify>[0],
        payload.userId,
        payload.type,
        payload.title,
        payload.message
      )
        .then(() => {
          result.inapp = { ok: true };
        })
        .catch((e: unknown) => {
          result.inapp = {
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          };
        })
    );
  }

  // 2) sms
  if (channels.includes("sms")) {
    if (!phone) {
      result.sms = { ok: true, skipped: true, error: "no phone" };
    } else if (!consent && !payload.force) {
      result.sms = { ok: true, skipped: true };
    } else {
      const smsText = `[토리로] ${payload.title}\n${payload.message}`;
      tasks.push(
        sendSms({ phone, text: smsText }).then((r) => {
          result.sms = r;
        })
      );
    }
  }

  // 3) email
  if (channels.includes("email")) {
    if (!email) {
      result.email = { ok: true, skipped: true, error: "no email" };
    } else if (!consent && !payload.force) {
      result.email = { ok: true, skipped: true };
    } else {
      const html =
        payload.emailHtml ??
        `<p>${payload.message.replace(/\n/g, "<br/>")}</p>`;
      tasks.push(
        sendEmail({
          to: email,
          subject: `[토리로] ${payload.title}`,
          html,
          text: payload.message,
        }).then((r) => {
          result.email = r;
        })
      );
    }
  }

  await Promise.all(tasks);
  return result;
}
