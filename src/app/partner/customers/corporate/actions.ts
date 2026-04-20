"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import { createAutoAccount } from "@/lib/crm/auto-account";
import { notify } from "@/lib/notifications";

import type { PipelineStage, ContactRole } from "./types";
import { PIPELINE_STAGES } from "./types";

const ROLE_SET = new Set<ContactRole>([
  "HR",
  "ESG",
  "FINANCE",
  "CEO",
  "MARKETING",
  "OTHER",
]);

const STAGE_SET = new Set<PipelineStage>(PIPELINE_STAGES);

// 사업자등록번호 포맷: 123-45-67890 → 1234567890 (숫자만 저장)
function normalizeBizNumber(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function strOrNull(value: FormDataEntryValue | null): string | null {
  const s = str(value);
  return s === "" ? null : s;
}

function intOrNull(value: FormDataEntryValue | null): number | null {
  const s = str(value);
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function multiStrings(formData: FormData, key: string): string[] | null {
  const all = formData.getAll(key).map((v) => String(v).trim()).filter(Boolean);
  return all.length > 0 ? all : null;
}

// Supabase untyped wrappers (partner_companies / contacts not in generated types yet)
function companiesTable(supabase: Awaited<ReturnType<typeof createClient>>) {
  return supabase.from("partner_companies" as never) as unknown as {
    insert: (row: unknown) => {
      select: (c: string) => {
        single: () => Promise<{
          data: { id: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
    update: (patch: unknown) => {
      eq: (k: string, v: string) => Promise<{
        error: { message: string } | null;
      }>;
    };
    delete: () => {
      eq: (k: string, v: string) => Promise<{
        error: { message: string } | null;
      }>;
    };
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{
          data: Record<string, unknown> | null;
        }>;
      };
    };
  };
}

function contactsTable(supabase: Awaited<ReturnType<typeof createClient>>) {
  return supabase.from("partner_company_contacts" as never) as unknown as {
    insert: (row: unknown) => Promise<{
      error: { message: string } | null;
    }>;
    update: (patch: unknown) => {
      eq: (k: string, v: string) => Promise<{
        error: { message: string } | null;
      }>;
    };
    delete: () => {
      eq: (k: string, v: string) => Promise<{
        error: { message: string } | null;
      }>;
    };
  };
}

export async function createCompanyAction(formData: FormData) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const company_name = str(formData.get("company_name"));
  const business_number_raw = str(formData.get("business_number"));
  const business_number = normalizeBizNumber(business_number_raw);

  if (!company_name) throw new Error("회사명을 입력해 주세요");
  if (business_number.length !== 10)
    throw new Error("사업자등록번호 10자리를 입력해 주세요");

  const representative_name = strOrNull(formData.get("representative_name"));
  const representative_phone = strOrNull(formData.get("representative_phone"));
  const company_email = strOrNull(formData.get("company_email"));
  const industry = strOrNull(formData.get("industry"));
  const employee_count = intOrNull(formData.get("employee_count"));
  const website = strOrNull(formData.get("website"));
  const memo = strOrNull(formData.get("memo"));
  const interests = multiStrings(formData, "interests");

  // 대표 담당자 (선택)
  const contact_name = strOrNull(formData.get("contact_name"));
  const contact_role = str(formData.get("contact_role")) as ContactRole;
  const contact_phone = strOrNull(formData.get("contact_phone"));
  const contact_email = strOrNull(formData.get("contact_email"));
  const contact_department = strOrNull(formData.get("contact_department"));

  // auto-account
  const { username, hash } = await createAutoAccount(
    "COMPANY",
    company_name || business_number
  );

  const { data, error } = await companiesTable(supabase)
    .insert({
      partner_id: partner.id,
      company_name,
      business_number,
      representative_name,
      representative_phone,
      company_email,
      industry,
      employee_count,
      website,
      interests,
      memo,
      status: "LEAD",
      pipeline_stage: "LEAD",
      auto_username: username,
      auto_password_hash: hash,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[corporate/create] error", error);
    throw new Error(`기업 등록 실패: ${error?.message ?? "unknown"}`);
  }

  const companyId = data.id;

  if (contact_name) {
    const role: ContactRole = ROLE_SET.has(contact_role)
      ? contact_role
      : "OTHER";
    const { error: cErr } = await contactsTable(supabase).insert({
      company_id: companyId,
      role,
      name: contact_name,
      phone: contact_phone,
      email: contact_email,
      department: contact_department,
      is_primary: true,
    });
    if (cErr) console.error("[corporate/create contact] error", cErr);
  }

  // 파트너 알림
  try {
    await notify(
      supabase,
      partner.id,
      "CRM_COMPANY_CREATED",
      "🏢 새 기업 고객 등록",
      `${company_name} 기업이 리드 단계로 등록되었어요.`
    );
  } catch {
    /* noop */
  }

  revalidatePath("/partner/customers/corporate");
  redirect(`/partner/customers/corporate/${companyId}`);
}

export async function updateCompanyAction(id: string, formData: FormData) {
  await requirePartner();
  const supabase = await createClient();

  const patch: Record<string, unknown> = {
    company_name: str(formData.get("company_name")),
    business_number: normalizeBizNumber(str(formData.get("business_number"))),
    representative_name: strOrNull(formData.get("representative_name")),
    representative_phone: strOrNull(formData.get("representative_phone")),
    company_email: strOrNull(formData.get("company_email")),
    industry: strOrNull(formData.get("industry")),
    employee_count: intOrNull(formData.get("employee_count")),
    website: strOrNull(formData.get("website")),
    interests: multiStrings(formData, "interests"),
    memo: strOrNull(formData.get("memo")),
  };

  const { error } = await companiesTable(supabase).update(patch).eq("id", id);
  if (error) throw new Error(`기업 수정 실패: ${error.message}`);

  revalidatePath(`/partner/customers/corporate/${id}`);
  revalidatePath("/partner/customers/corporate");
}

export async function updatePipelineStageAction(id: string, stage: string) {
  await requirePartner();
  const supabase = await createClient();

  if (!STAGE_SET.has(stage as PipelineStage)) {
    throw new Error("유효하지 않은 단계입니다");
  }

  const { error } = await companiesTable(supabase)
    .update({ status: stage, pipeline_stage: stage })
    .eq("id", id);

  if (error) throw new Error(`단계 변경 실패: ${error.message}`);

  revalidatePath("/partner/customers/corporate");
  revalidatePath(`/partner/customers/corporate/${id}`);
}

export async function addContactAction(companyId: string, formData: FormData) {
  await requirePartner();
  const supabase = await createClient();

  const name = str(formData.get("name"));
  if (!name) throw new Error("이름을 입력해 주세요");

  const roleRaw = str(formData.get("role")) as ContactRole;
  const role: ContactRole = ROLE_SET.has(roleRaw) ? roleRaw : "OTHER";
  const phone = strOrNull(formData.get("phone"));
  const email = strOrNull(formData.get("email"));
  const department = strOrNull(formData.get("department"));
  const notes = strOrNull(formData.get("notes"));
  const is_primary = formData.get("is_primary") === "on";

  const { error } = await contactsTable(supabase).insert({
    company_id: companyId,
    name,
    role,
    phone,
    email,
    department,
    notes,
    is_primary,
  });

  if (error) throw new Error(`담당자 추가 실패: ${error.message}`);

  revalidatePath(`/partner/customers/corporate/${companyId}`);
  revalidatePath(`/partner/customers/corporate/${companyId}/contacts`);
}

export async function updateContactAction(
  contactId: string,
  companyId: string,
  formData: FormData
) {
  await requirePartner();
  const supabase = await createClient();

  const roleRaw = str(formData.get("role")) as ContactRole;
  const role: ContactRole = ROLE_SET.has(roleRaw) ? roleRaw : "OTHER";

  const patch = {
    name: str(formData.get("name")),
    role,
    phone: strOrNull(formData.get("phone")),
    email: strOrNull(formData.get("email")),
    department: strOrNull(formData.get("department")),
    notes: strOrNull(formData.get("notes")),
    is_primary: formData.get("is_primary") === "on",
  };

  const { error } = await contactsTable(supabase)
    .update(patch)
    .eq("id", contactId);

  if (error) throw new Error(`담당자 수정 실패: ${error.message}`);

  revalidatePath(`/partner/customers/corporate/${companyId}`);
  revalidatePath(`/partner/customers/corporate/${companyId}/contacts`);
}

export async function removeContactAction(contactId: string) {
  await requirePartner();
  const supabase = await createClient();

  const { error } = await contactsTable(supabase).delete().eq("id", contactId);
  if (error) throw new Error(`담당자 삭제 실패: ${error.message}`);

  revalidatePath("/partner/customers/corporate");
}

export async function deleteCompanyAction(id: string) {
  await requirePartner();
  const supabase = await createClient();

  const { error } = await companiesTable(supabase).delete().eq("id", id);
  if (error) throw new Error(`기업 삭제 실패: ${error.message}`);

  revalidatePath("/partner/customers/corporate");
  redirect("/partner/customers/corporate");
}
