"use server";

import { createClient } from "@/lib/supabase/server";

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

  if (!name) return { ok: false, error: "상호를 입력해 주세요" };
  if (!username) return { ok: false, error: "아이디를 입력해 주세요" };
  if (username.length < 3) return { ok: false, error: "아이디는 3자 이상이어야 해요" };
  if (!/^[a-zA-Z0-9_\-.]+$/.test(username)) {
    return { ok: false, error: "아이디는 영문/숫자/._- 만 사용할 수 있어요" };
  }
  if (!password) return { ok: false, error: "비밀번호를 입력해 주세요" };
  if (password.length < 4) return { ok: false, error: "비밀번호는 4자 이상이어야 해요" };
  if (password !== passwordConfirm) return { ok: false, error: "비밀번호가 일치하지 않아요" };
  if (!agree) return { ok: false, error: "이용 약관에 동의해 주세요" };

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
        password,
        email,
        phone,
        tier: "SPROUT",
        commission_rate: 20,
        status: "PENDING",
      });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "신청 접수 중 오류가 발생했어요";
    return { ok: false, error: msg };
  }
}
