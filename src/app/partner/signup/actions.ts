"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/password";
import { recordConsent } from "@/lib/consent";
import { getRequestMeta } from "@/lib/audit-log";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PartnerSignupResult =
  | { ok: true }
  | { ok: false; error: string };

export async function partnerSignupAction(formData: FormData): Promise<PartnerSignupResult> {
  const name = String(formData.get("name") ?? "").trim();
  const business_name = String(formData.get("business_name") ?? "").trim() || null;
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const agree = formData.get("agree") === "on";

  // PIPA 4-type consent
  const consent = {
    terms: formData.get("consent_terms") === "1",
    privacy: formData.get("consent_privacy") === "1",
    marketing: formData.get("consent_marketing") === "1",
    thirdParty: formData.get("consent_third_party") === "1",
    ageConfirm: formData.get("consent_age") === "1",
  };
  const consentOk = consent.terms && consent.privacy && consent.ageConfirm;

  if (!name) return { ok: false, error: "상호를 입력해 주세요" };
  if (!username) return { ok: false, error: "아이디를 입력해 주세요" };
  if (username.length < 3) return { ok: false, error: "아이디는 3자 이상이어야 해요" };
  if (!/^[a-zA-Z0-9_\-.]+$/.test(username)) {
    return { ok: false, error: "아이디는 영문/숫자/._- 만 사용할 수 있어요" };
  }
  if (!password) return { ok: false, error: "비밀번호를 입력해 주세요" };
  if (password.length < 4) return { ok: false, error: "비밀번호는 4자 이상이어야 해요" };
  if (password !== passwordConfirm) return { ok: false, error: "비밀번호가 일치하지 않아요" };
  if (!agree && !consentOk) return { ok: false, error: "이용 약관에 동의해 주세요" };
  if (!consentOk) {
    return { ok: false, error: "필수 항목(이용약관·개인정보·연령)에 동의해 주세요" };
  }

  const supabase = await createClient();

  try {
    const { data: existing } = await (supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: { id: string } | null }>;
          };
        };
      };
    })
      .from("partners")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return { ok: false, error: "이미 사용 중인 아이디예요" };
    }

    const hashedPassword = await hashPassword(password);

    const { error } = await (supabase as unknown as {
      from: (t: string) => {
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
    })
      .from("partners")
      .insert({
        name,
        business_name,
        username,
        password: hashedPassword,
        email,
        phone,
        tier: "SPROUT",
        commission_rate: 20,
        status: "PENDING",
      });

    if (error) {
      return { ok: false, error: error.message };
    }

    // PIPA 동의 이력 저장 (best-effort)
    try {
      const hdrs = await headers();
      const meta = getRequestMeta(hdrs);
      await recordConsent(supabase as unknown as SupabaseClient, {
        user_type: "partner",
        user_identifier: username,
        consent,
        ip_address: meta.ip_address ?? undefined,
        user_agent: meta.user_agent ?? undefined,
      });
    } catch (e) {
      console.error("[partner/signup] consent record error:", e);
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "신청 접수 중 오류가 발생했어요";
    return { ok: false, error: msg };
  }
}
