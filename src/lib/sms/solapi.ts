import { SolapiMessageService } from "solapi";

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "campnic.app";

let cached: SolapiMessageService | null = null;

function getClient() {
  if (!cached) {
    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new Error("SOLAPI_API_KEY and SOLAPI_API_SECRET must be set");
    }
    cached = new SolapiMessageService(apiKey, apiSecret);
  }
  return cached;
}

function buildOtpBody(code: string) {
  return [
    `[윙크] 인증코드는 ${code} 입니다.`,
    "3분 안에 입력해주세요.",
    "",
    `@${APP_DOMAIN} #${code}`,
  ].join("\n");
}

export async function sendOtpSms(phone: string, code: string) {
  const sender = process.env.SOLAPI_SENDER_PHONE;
  if (!sender) throw new Error("SOLAPI_SENDER_PHONE must be set");

  const client = getClient();
  return client.send({
    to: phone,
    from: sender,
    text: buildOtpBody(code),
  });
}
