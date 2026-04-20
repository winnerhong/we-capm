"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import { createAutoAccount } from "@/lib/crm/auto-account";
import { notifyNewCustomer } from "@/lib/crm/notify-customer";

export type CustomerTier = "SPROUT" | "EXPLORER" | "TREE" | "FOREST";
export type CustomerStatus = "ACTIVE" | "INACTIVE" | "DORMANT" | "CHURNED";

const TIER_SET = new Set<CustomerTier>(["SPROUT", "EXPLORER", "TREE", "FOREST"]);
const STATUS_SET = new Set<CustomerStatus>(["ACTIVE", "INACTIVE", "DORMANT", "CHURNED"]);

type Child = { name: string; age: number | null };

function norm(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function normPhone(value: FormDataEntryValue | null): string {
  const raw = norm(value).replace(/[^0-9]/g, "");
  if (raw.length === 11) return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
  if (raw.length === 10) return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}`;
  return norm(value);
}

function parseChildren(formData: FormData): Child[] {
  const out: Child[] = [];
  for (let i = 1; i <= 10; i++) {
    const name = norm(formData.get(`child_name_${i}`));
    if (!name) continue;
    const ageRaw = norm(formData.get(`child_age_${i}`));
    const age = ageRaw === "" ? null : Number(ageRaw);
    out.push({ name, age: Number.isFinite(age) ? (age as number) : null });
  }
  return out;
}

function parseBool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  if (v === null) return false;
  const s = String(v).toLowerCase();
  return s === "on" || s === "true" || s === "1" || s === "yes";
}

export async function createCustomerAction(formData: FormData) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const parent_name = norm(formData.get("parent_name"));
  const parent_phone = normPhone(formData.get("parent_phone"));
  const email = norm(formData.get("email")) || null;
  const address = norm(formData.get("address")) || null;
  const source = norm(formData.get("source")) || null;

  if (!parent_name) throw new Error("보호자 이름을 입력해 주세요");
  if (!parent_phone) throw new Error("보호자 전화번호를 입력해 주세요");

  const children = parseChildren(formData);
  const interests = (formData.getAll("interests") as string[]).map((s) => String(s)).filter(Boolean);

  const marketing_sms = parseBool(formData, "marketing_sms");
  const marketing_email = parseBool(formData, "marketing_email");
  const marketing_kakao = parseBool(formData, "marketing_kakao");

  const account = await createAutoAccount("CUSTOMER", parent_name);

  const row = {
    partner_id: partner.id,
    parent_name,
    parent_phone,
    email,
    address,
    children,
    interests: interests.length > 0 ? interests : null,
    marketing_sms,
    marketing_email,
    marketing_kakao,
    source,
    tier: "SPROUT" as CustomerTier,
    status: "ACTIVE" as CustomerStatus,
    auto_username: account.username,
    auto_password_hash: account.hash,
  };

  const { data, error } = await (
    supabase.from("partner_customers") as unknown as {
      insert: (r: unknown) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .insert(row as never)
    .select("id")
    .single();

  if (error) throw new Error(`고객 등록 실패: ${error.message}`);

  try {
    await notifyNewCustomer(supabase as never, {
      type: "CUSTOMER",
      name: parent_name,
      phone: parent_phone,
      username: account.username,
      tempPassword: account.plaintext,
    });
  } catch (e) {
    // SMS 실패는 가입 자체를 막지 않음
    // eslint-disable-next-line no-console
    console.warn("[createCustomerAction] notify failed", e);
  }

  revalidatePath("/partner/customers/individual");
  redirect(`/partner/customers/individual/${data?.id ?? ""}`);
}

export async function updateCustomerAction(id: string, formData: FormData) {
  await requirePartner();
  const supabase = await createClient();

  const parent_name = norm(formData.get("parent_name"));
  const parent_phone = normPhone(formData.get("parent_phone"));
  const email = norm(formData.get("email")) || null;
  const address = norm(formData.get("address")) || null;
  const source = norm(formData.get("source")) || null;
  const children = parseChildren(formData);
  const interests = (formData.getAll("interests") as string[]).map((s) => String(s)).filter(Boolean);
  const marketing_sms = parseBool(formData, "marketing_sms");
  const marketing_email = parseBool(formData, "marketing_email");
  const marketing_kakao = parseBool(formData, "marketing_kakao");

  const statusRaw = norm(formData.get("status"));
  const status: CustomerStatus = STATUS_SET.has(statusRaw as CustomerStatus)
    ? (statusRaw as CustomerStatus)
    : "ACTIVE";

  const patch = {
    parent_name,
    parent_phone,
    email,
    address,
    children,
    interests: interests.length > 0 ? interests : null,
    marketing_sms,
    marketing_email,
    marketing_kakao,
    source,
    status,
  };

  const { error } = await (
    supabase.from("partner_customers") as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update(patch as never)
    .eq("id", id);

  if (error) throw new Error(`고객 수정 실패: ${error.message}`);

  revalidatePath("/partner/customers/individual");
  revalidatePath(`/partner/customers/individual/${id}`);
}

export async function updateTierAction(id: string, tier: string) {
  await requirePartner();
  if (!TIER_SET.has(tier as CustomerTier)) {
    throw new Error("유효하지 않은 티어입니다");
  }

  const supabase = await createClient();
  const { error } = await (
    supabase.from("partner_customers") as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ tier } as never)
    .eq("id", id);

  if (error) throw new Error(`티어 변경 실패: ${error.message}`);

  revalidatePath("/partner/customers/individual");
  revalidatePath(`/partner/customers/individual/${id}`);
}

export async function deleteCustomerAction(id: string) {
  await requirePartner();
  const supabase = await createClient();

  // soft close: CHURNED 상태로 변경
  const { error } = await (
    supabase.from("partner_customers") as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ status: "CHURNED" } as never)
    .eq("id", id);

  if (error) throw new Error(`고객 해지 실패: ${error.message}`);

  revalidatePath("/partner/customers/individual");
  redirect("/partner/customers/individual");
}
