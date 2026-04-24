// Email sender — Resend (https://resend.com) REST API 를 fetch 로 직접 호출.
// 외부 패키지 설치 금지 제약.
//
// 운영 원칙:
//   - RESEND_API_KEY 없으면 no-op (로그만).
//   - 실패 시 throw 하지 않고 { ok: false, error } 반환.
//   - to 는 단일/배열 둘 다 허용 (Resend API 스펙).

export type EmailOpts = {
  to: string | string[];
  subject: string;
  html: string;
  /** 텍스트 대체본 (없으면 Resend 가 html 에서 자동 생성) */
  text?: string;
  /** 발신자 override. 기본은 RESEND_FROM 환경변수 */
  from?: string;
};

export type EmailSendResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  id?: string;
};

/**
 * Resend API 로 이메일 발송.
 *   - RESEND_API_KEY 없으면 skip.
 *   - 실패 시 ok: false + error, throw 하지 않음.
 */
export async function sendEmail(opts: EmailOpts): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const defaultFrom =
    process.env.RESEND_FROM ?? "토리로 <noreply@campnic.app>";

  if (!apiKey) {
    console.log("[email/send] skipped (no RESEND_API_KEY)", {
      to: Array.isArray(opts.to) ? opts.to.length : 1,
      subject: opts.subject,
    });
    return { ok: true, skipped: true };
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: opts.from ?? defaultFrom,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("[email/send] Resend error", {
        status: resp.status,
        body: errText.slice(0, 300),
      });
      return { ok: false, error: `Resend ${resp.status}: ${errText}` };
    }

    const data = (await resp.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: data?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "email send failed";
    console.error("[email/send] exception", msg);
    return { ok: false, error: msg };
  }
}
