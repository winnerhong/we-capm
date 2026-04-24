// Generic SMS sender — Solapi 를 재사용하되 OTP 전용이 아님.
// sendOtpSms (solapi.ts) 와 독립: OTP 발송 경로는 건드리지 않는다.
//
// 운영 원칙:
//   - SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_SENDER_PHONE 없으면 no-op.
//     (로컬/CI 에서 실제 SMS 발송 없이 승인·알림 로직 전체 돌릴 수 있게.)
//   - 예외를 호출측에 throw 하지 않음 → 외부 API 실패가 승인/DB 로직 막지 않음.
//   - 전화번호 전체 로깅 금지 (뒤 4자리만).

import { SolapiMessageService } from "solapi";

let cached: SolapiMessageService | null = null;

function getClient(): SolapiMessageService | null {
  if (cached) return cached;
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  if (!apiKey || !apiSecret) return null;
  cached = new SolapiMessageService(apiKey, apiSecret);
  return cached;
}

export type SmsOpts = {
  phone: string;
  text: string;
  /**
   * LMS 는 90바이트 초과 장문 문자. SMS 는 이하 단문.
   * 현재 구현은 Solapi 에 위임 (자동 판별). 명시적 타입 필요해지면 추후 확장.
   */
  type?: "SMS" | "LMS";
};

export type SmsSendResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

/**
 * 일반 SMS 발송.
 *   - 환경변수 부재 시 조용히 skip (ok: true, skipped: true).
 *   - 발송 실패 시 ok: false + error 반환, throw 하지 않음.
 */
export async function sendSms(opts: SmsOpts): Promise<SmsSendResult> {
  const client = getClient();
  const sender = process.env.SOLAPI_SENDER_PHONE;

  if (!client || !sender) {
    console.log("[sms/send] skipped (no credentials)", {
      phoneTail: opts.phone.slice(-4),
      textLen: opts.text.length,
    });
    return { ok: true, skipped: true };
  }

  try {
    await client.send({
      to: opts.phone,
      from: sender,
      text: opts.text,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sms send failed";
    console.error("[sms/send] error", {
      phoneTail: opts.phone.slice(-4),
      msg,
    });
    return { ok: false, error: msg };
  }
}
