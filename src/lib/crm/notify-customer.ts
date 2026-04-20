import type { SupabaseClient } from "@supabase/supabase-js";
import { logAccess } from "@/lib/audit-log";

export async function notifyNewCustomer(
  supabase: SupabaseClient,
  params: {
    type: "ORG" | "CUSTOMER" | "COMPANY";
    name: string;
    phone: string;
    username: string;
    tempPassword: string;
  }
) {
  const message = `[토리로] ${params.name}님, 숲지기님이 회원가입을 도와드렸어요!
접속: https://toriro.com/join
아이디: ${params.username}
비밀번호: ${params.tempPassword}
첫 로그인 시 비밀번호를 변경해주세요.`;

  console.log(`[SMS MOCK] To ${params.phone}: ${message}`);

  await logAccess(supabase, {
    user_type: "PUBLIC",
    action: "SMS_WELCOME_SENT",
    resource: `${params.type}:${params.username}`,
    user_identifier: params.phone,
  });

  return { success: true, message };
}
