"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PartnerRow = {
  id: string;
  name: string;
  username: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  password: string;
};

async function getCurrentPartnerId(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("campnic_partner")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: string };
    return parsed.id ?? null;
  } catch {
    return null;
  }
}

async function refreshCookie(partner: {
  id: string;
  name: string;
  username: string;
}) {
  const cookieStore = await cookies();
  cookieStore.set(
    "campnic_partner",
    JSON.stringify({
      id: partner.id,
      name: partner.name,
      username: partner.username,
    }),
    {
      httpOnly: false,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    }
  );
}

export async function updatePartnerProfileAction(formData: FormData) {
  const partnerId = await getCurrentPartnerId();
  if (!partnerId) throw new Error("로그인이 필요합니다");

  const name = String(formData.get("name") ?? "").trim();
  const business_name =
    String(formData.get("business_name") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!name) throw new Error("이름을 입력해 주세요");

  const supabase = await createClient();
  const { data, error } = await (
    supabase.from("partners") as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => {
          select: (c: string) => {
            maybeSingle: () => Promise<{
              data: { id: string; name: string; username: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .update({ name, business_name, email, phone } as never)
    .eq("id", partnerId)
    .select("id,name,username")
    .maybeSingle();

  if (error) throw new Error(`프로필 수정 실패: ${error.message}`);
  if (data) await refreshCookie(data);

  revalidatePath("/partner/settings");
  revalidatePath("/partner/dashboard");
}

export async function updatePartnerPasswordAction(formData: FormData) {
  const partnerId = await getCurrentPartnerId();
  if (!partnerId) throw new Error("로그인이 필요합니다");

  const oldPw = String(formData.get("old_password") ?? "");
  const newPw = String(formData.get("new_password") ?? "");
  const confirmPw = String(formData.get("confirm_password") ?? "");

  if (!oldPw || !newPw) throw new Error("비밀번호를 입력해 주세요");
  if (newPw.length < 6) throw new Error("새 비밀번호는 6자 이상이어야 해요");
  if (newPw !== confirmPw)
    throw new Error("새 비밀번호 확인이 일치하지 않아요");

  const supabase = await createClient();
  const { data } = await (
    supabase.from("partners") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: PartnerRow | null }>;
        };
      };
    }
  )
    .select("id,name,username,business_name,email,phone,password")
    .eq("id", partnerId)
    .maybeSingle();

  if (!data) throw new Error("숲지기 정보를 찾을 수 없어요");
  if (data.password !== oldPw)
    throw new Error("현재 비밀번호가 일치하지 않아요");

  const { error } = await (
    supabase.from("partners") as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ password: newPw } as never)
    .eq("id", partnerId);

  if (error) throw new Error(`비밀번호 변경 실패: ${error.message}`);

  revalidatePath("/partner/settings");
}

export async function closePartnerAccountAction(formData: FormData) {
  const confirm = String(formData.get("confirm") ?? "");
  if (confirm !== "해지") throw new Error("확인 문구를 정확히 입력해 주세요");

  const partnerId = await getCurrentPartnerId();
  if (!partnerId) throw new Error("로그인이 필요합니다");

  const supabase = await createClient();
  const { error } = await (
    supabase.from("partners") as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ status: "CLOSED" } as never)
    .eq("id", partnerId);

  if (error) throw new Error(`계정 해지 실패: ${error.message}`);

  const cookieStore = await cookies();
  cookieStore.delete("campnic_partner");
  redirect("/partner");
}
