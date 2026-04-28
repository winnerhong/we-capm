// 서비스 롤 Supabase 클라이언트.
// - RLS 우회 — 서버 액션 / route handler 에서만 사용.
// - 절대 클라이언트 번들에 import 되면 안 됨.
//
// 사용 예: 토리로 (campnic_user 쿠키) 세션은 auth.uid() 가 NULL 이라
// storage RLS 를 통과할 수 없음 → 인증은 requireAppUser() 로 검증하고
// 실제 storage 작업은 이 admin client 로 수행.

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL not configured");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
