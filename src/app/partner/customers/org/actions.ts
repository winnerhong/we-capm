"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import {
  createOrgAccountFromProfile,
  createOrgAccountExplicit,
} from "@/lib/crm/auto-account";
import { notifyNewCustomer } from "@/lib/crm/notify-customer";
import { createClient } from "@/lib/supabase/server";

export type OrgType =
  | "DAYCARE"
  | "KINDERGARTEN"
  | "ELEMENTARY"
  | "MIDDLE"
  | "HIGH"
  | "EDUCATION_OFFICE"
  | "OTHER";

export type OrgStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "CLOSED";

const ORG_TYPES = new Set<OrgType>([
  "DAYCARE",
  "KINDERGARTEN",
  "ELEMENTARY",
  "MIDDLE",
  "HIGH",
  "EDUCATION_OFFICE",
  "OTHER",
]);

function toStr(value: FormDataEntryValue | null, fallback = ""): string {
  if (value === null) return fallback;
  return String(value).trim();
}

function toNullableStr(value: FormDataEntryValue | null): string | null {
  const s = toStr(value);
  return s === "" ? null : s;
}

function toNum(value: FormDataEntryValue | null, fallback = 0): number {
  const s = toStr(value);
  if (s === "") return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function toDateOrNull(value: FormDataEntryValue | null): string | null {
  const s = toStr(value);
  return s === "" ? null : s;
}

function toTags(value: FormDataEntryValue | null): string[] | null {
  const s = toStr(value);
  if (!s) return null;
  const parts = s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

function parseOrgType(value: FormDataEntryValue | null): OrgType {
  const raw = toStr(value, "OTHER");
  return ORG_TYPES.has(raw as OrgType) ? (raw as OrgType) : "OTHER";
}

function parseForm(formData: FormData) {
  const org_name = toStr(formData.get("org_name"));
  if (!org_name) throw new Error("기관명을 입력해 주세요");

  const org_phone = toStr(formData.get("org_phone"));
  if (!org_phone) throw new Error("기관 전화번호를 입력해 주세요 (로그인 아이디로 사용됩니다)");
  if (org_phone.replace(/\D/g, "").length < 7)
    throw new Error("기관 전화번호는 숫자 7자리 이상이어야 합니다");

  const representative_phone = toStr(formData.get("representative_phone"));
  if (!representative_phone) throw new Error("담당자 연락처를 입력해 주세요 (비밀번호 생성용)");

  return {
    org_name,
    org_phone,
    org_type: parseOrgType(formData.get("org_type")),
    representative_name: toNullableStr(formData.get("representative_name")),
    representative_phone,
    email: toNullableStr(formData.get("email")),
    address: toNullableStr(formData.get("address")),
    children_count: toNum(formData.get("children_count"), 0),
    class_count: toNum(formData.get("class_count"), 0),
    teacher_count: toNum(formData.get("teacher_count"), 0),
    business_number: toNullableStr(formData.get("business_number")),
    tax_email: toNullableStr(formData.get("tax_email")),
    commission_rate: toNum(formData.get("commission_rate"), 20),
    discount_rate: toNum(formData.get("discount_rate"), 0),
    contract_start: toDateOrNull(formData.get("contract_start")),
    contract_end: toDateOrNull(formData.get("contract_end")),
    tags: toTags(formData.get("tags")),
    internal_memo: toNullableStr(formData.get("internal_memo")),
  };
}

export async function createOrgAction(formData: FormData) {
  const partner = await requirePartner();

  const supabase = await createClient();
  const data = parseForm(formData);

  // 지사 입력값 — 비우면 자동 생성 규칙으로 폴백.
  const usernameOverride = toStr(formData.get("auto_username"));
  const passwordOverride = toStr(formData.get("auto_password"));

  // 1) 계정 발급 (override 우선, 없으면 자동)
  const account = await createOrgAccountExplicit({
    usernameOverride,
    passwordOverride,
    orgPhone: data.org_phone,
    representativePhone: data.representative_phone,
  });

  // 2) partner_orgs insert
  const sb = supabase as unknown as {
    from: (t: string) => {
      insert: (row: unknown) => {
        select: (cols: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const { data: inserted, error } = await sb
    .from("partner_orgs")
    .insert({
      partner_id: partner.id,
      ...data,
      auto_username: account.username,
      auto_password_hash: account.hash,
      status: "ACTIVE",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`기관 등록 실패: ${error?.message ?? "알 수 없는 오류"}`);
  }

  // 3) 환영 SMS (mock)
  try {
    await notifyNewCustomer(
      supabase as unknown as Parameters<typeof notifyNewCustomer>[0],
      {
        type: "ORG",
        name: data.org_name,
        phone: data.representative_phone,
        username: account.username,
        tempPassword: account.plaintext,
      }
    );
  } catch (e) {
    console.error("[createOrgAction] notify failed", e);
  }

  revalidatePath("/partner/customers/org");
  redirect(
    `/partner/customers/org/${inserted.id}?welcome=1&username=${encodeURIComponent(
      account.username
    )}&password=${encodeURIComponent(account.plaintext)}`
  );
}

export async function updateOrgAction(id: string, formData: FormData) {
  await requirePartner();
  const supabase = await createClient();
  const data = parseForm(formData);

  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { error } = await sb.from("partner_orgs").update(data).eq("id", id);

  if (error) throw new Error(`기관 수정 실패: ${error.message}`);

  revalidatePath("/partner/customers/org");
  revalidatePath(`/partner/customers/org/${id}`);
  redirect(`/partner/customers/org/${id}`);
}

export async function deleteOrgAction(id: string) {
  await requirePartner();
  const supabase = await createClient();

  // soft delete: status = CLOSED
  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { error } = await sb
    .from("partner_orgs")
    .update({ status: "CLOSED" })
    .eq("id", id);

  if (error) throw new Error(`해지 실패: ${error.message}`);

  revalidatePath("/partner/customers/org");
  redirect("/partner/customers/org");
}

export async function updateOrgStatusAction(
  id: string,
  status: OrgStatus
) {
  await requirePartner();
  const supabase = await createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { error } = await sb
    .from("partner_orgs")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(`상태 변경 실패: ${error.message}`);

  revalidatePath("/partner/customers/org");
  revalidatePath(`/partner/customers/org/${id}`);
}

// 단일 기관 계정 재발급 (아이디=기관명, 비번=담당자 연락처 뒷4자리)
export async function regenerateOrgAccountAction(id: string) {
  await requirePartner();
  const supabase = await createClient();

  const selector = supabase.from("partner_orgs" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{
          data: {
            id: string;
            org_phone: string | null;
            representative_phone: string | null;
          } | null;
        }>;
      };
    };
  };

  const { data: org } = await selector
    .select("id, org_phone, representative_phone")
    .eq("id", id)
    .maybeSingle();

  if (!org) throw new Error("기관을 찾을 수 없습니다");
  if (!org.org_phone)
    throw new Error("기관 전화번호가 비어있어요. 먼저 기관 정보에서 입력하세요.");

  const account = await createOrgAccountFromProfile(
    org.org_phone,
    org.representative_phone,
    org.id
  );

  const updater = supabase.from("partner_orgs" as never) as unknown as {
    update: (p: unknown) => {
      eq: (k: string, v: string) => Promise<{
        error: { message: string } | null;
      }>;
    };
  };

  const { error } = await updater
    .update({
      auto_username: account.username,
      auto_password_hash: account.hash,
    })
    .eq("id", id);

  if (error) throw new Error(`계정 재발급 실패: ${error.message}`);

  revalidatePath("/partner/customers/org");
  revalidatePath(`/partner/customers/org/${id}`);
  revalidatePath(`/partner/customers/org/${id}/edit`);
  redirect(`/partner/customers/org/${id}/edit?regen=1`);
}

// ============================================================
// 기존 기관 계정 일괄 재발급:
//   모든 기관을 순회하며 아이디=기관명, 비번=연락처 뒷4자리로 재설정.
// ============================================================
export async function regenerateAllOrgAccountsAction() {
  const partner = await requirePartner();
  const supabase = await createClient();

  const selector = supabase.from("partner_orgs" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => Promise<{
        data:
          | Array<{
              id: string;
              org_phone: string | null;
              representative_phone: string | null;
            }>
          | null;
      }>;
    };
  };

  const updater = supabase.from("partner_orgs" as never) as unknown as {
    update: (p: unknown) => {
      eq: (k: string, v: string) => Promise<{
        error: { message: string } | null;
      }>;
    };
  };

  const { data: orgs } = await selector
    .select("id, org_phone, representative_phone")
    .eq("partner_id", partner.id);

  if (!orgs || orgs.length === 0) {
    redirect("/partner/customers/org?regen=empty");
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const org of orgs) {
    if (!org.org_phone) {
      skipped++;
      continue;
    }
    try {
      const account = await createOrgAccountFromProfile(
        org.org_phone,
        org.representative_phone,
        org.id
      );
      const { error } = await updater
        .update({
          auto_username: account.username,
          auto_password_hash: account.hash,
        })
        .eq("id", org.id);
      if (error) {
        console.error("[regenAllOrgs] update error", org.id, error);
        failed++;
      } else {
        success++;
      }
    } catch (e) {
      console.error("[regenAllOrgs] throw", org.id, e);
      failed++;
    }
  }

  revalidatePath("/partner/customers/org");
  redirect(
    `/partner/customers/org?regen=done&success=${success}&failed=${failed}&skipped=${skipped}`
  );
}
