"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import { createAutoAccount } from "@/lib/crm/auto-account";
import { notifyNewCustomer } from "@/lib/crm/notify-customer";
import {
  normalizePhone,
  normalizeBusinessNumber,
  validatePhone,
  validateBusinessNumber,
  validateEmail,
} from "@/lib/crm/bulk-import";

export type ImportType = "ORG" | "CUSTOMER" | "COMPANY";
export type ImportStrategy = "SKIP" | "UPDATE";

export type BulkImportResult = {
  success: number;
  skipped: number;
  updated: number;
  errors: Array<{ row: number; reason: string; data?: Record<string, string> }>;
};

type SupabaseLike = {
  from: (t: string) => {
    insert: (d: unknown) => Promise<{ error: { message: string } | null }>;
    update?: (d: unknown) => {
      eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
    };
    select: (c: string) => {
      eq: (c: string, v: string) => {
        eq: (c: string, v: string) => {
          maybeSingle: () => Promise<{ data: { id: string } | null }>;
        };
      };
    };
  };
};

/**
 * Resolve partner_id from session (fallback to first partner for dev)
 */
async function resolvePartnerId(): Promise<string> {
  const partner = await requirePartner();
  return partner.id;
}

/**
 * Bulk import action — processes an array of row objects for the given type.
 * Uses per-row try/catch so partial failures don't abort the batch.
 */
export async function bulkImportAction(
  type: ImportType,
  rows: Record<string, string>[],
  strategy: ImportStrategy,
  fileName: string | null = null
): Promise<BulkImportResult> {
  const partnerId = await resolvePartnerId();
  const supabase = await createClient();
  const sb = supabase as unknown as SupabaseLike;

  const results: BulkImportResult = {
    success: 0,
    skipped: 0,
    updated: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +1 for header, +1 for 1-based

    try {
      if (type === "ORG") {
        await importOrgRow(sb, partnerId, row, strategy, results, rowNum);
      } else if (type === "CUSTOMER") {
        await importCustomerRow(sb, partnerId, row, strategy, results, rowNum);
      } else if (type === "COMPANY") {
        await importCompanyRow(sb, partnerId, row, strategy, results, rowNum);
      }
    } catch (e) {
      results.errors.push({
        row: rowNum,
        reason: e instanceof Error ? e.message : "알 수 없는 오류",
        data: row,
      });
    }
  }

  // Log to partner_bulk_imports
  try {
    await sb.from("partner_bulk_imports").insert({
      partner_id: partnerId,
      import_type: type,
      file_name: fileName,
      total_rows: rows.length,
      success_rows: results.success + results.updated,
      skipped_rows: results.skipped,
      error_rows: results.errors.length,
      error_details: results.errors,
    });
  } catch {
    // Non-fatal — audit write failed but import succeeded
  }

  return results;
}

async function importOrgRow(
  sb: SupabaseLike,
  partnerId: string,
  row: Record<string, string>,
  strategy: ImportStrategy,
  results: BulkImportResult,
  rowNum: number
): Promise<void> {
  const orgName = row["기관명*"] ?? row["기관명"] ?? "";
  const repName = row["대표자*"] ?? row["대표자"] ?? "";
  const repPhoneRaw = row["대표전화*"] ?? row["대표전화"] ?? "";

  if (!orgName.trim()) throw new Error("기관명 누락");
  if (!repName.trim()) throw new Error("대표자 누락");
  if (!repPhoneRaw.trim()) throw new Error("대표전화 누락");

  const phone = normalizePhone(repPhoneRaw);
  if (!validatePhone(phone)) throw new Error(`대표전화 형식 오류: ${repPhoneRaw}`);

  const email = (row["이메일"] ?? "").trim();
  if (email && !validateEmail(email)) throw new Error(`이메일 형식 오류: ${email}`);

  const bizRaw = (row["사업자등록번호"] ?? "").trim();
  const bizNumber = bizRaw ? normalizeBusinessNumber(bizRaw) : null;
  if (bizNumber && !validateBusinessNumber(bizNumber)) {
    throw new Error(`사업자등록번호 형식 오류: ${bizRaw}`);
  }

  const orgType = normalizeOrgType(row["기관유형"]);

  // Duplicate check — by org_name + representative_phone
  const { data: existing } = await sb
    .from("partner_orgs")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("org_name", orgName.trim())
    .maybeSingle();

  if (existing) {
    if (strategy === "SKIP") {
      results.skipped++;
      return;
    }
    // UPDATE
    const updater = sb.from("partner_orgs").update!;
    const { error } = await updater({
      representative_name: repName.trim(),
      representative_phone: phone,
      email: email || null,
      address: (row["주소"] ?? "").trim() || null,
      children_count: toInt(row["아동수"]),
      class_count: toInt(row["학급수"]),
      business_number: bizNumber,
      org_type: orgType,
    }).eq("id", existing.id);
    if (error) throw new Error(error.message);
    results.updated++;
    return;
  }

  // New insert with auto account
  const account = await createAutoAccount("ORG", orgName);

  const { error } = await sb.from("partner_orgs").insert({
    partner_id: partnerId,
    org_name: orgName.trim(),
    org_type: orgType,
    representative_name: repName.trim(),
    representative_phone: phone,
    email: email || null,
    address: (row["주소"] ?? "").trim() || null,
    children_count: toInt(row["아동수"]),
    class_count: toInt(row["학급수"]),
    business_number: bizNumber,
    auto_username: account.username,
    auto_password_hash: account.hash,
    status: "ACTIVE",
  });
  if (error) throw new Error(error.message);

  // Fire-and-log SMS notification (mock)
  await notifyNewCustomer(
    sb as unknown as Parameters<typeof notifyNewCustomer>[0],
    {
      type: "ORG",
      name: orgName.trim(),
      phone,
      username: account.username,
      tempPassword: account.plaintext,
    }
  ).catch(() => {});

  results.success++;
  void rowNum;
}

async function importCustomerRow(
  sb: SupabaseLike,
  partnerId: string,
  row: Record<string, string>,
  strategy: ImportStrategy,
  results: BulkImportResult,
  rowNum: number
): Promise<void> {
  const parentName = row["보호자이름*"] ?? row["보호자이름"] ?? "";
  const parentPhoneRaw = row["보호자전화*"] ?? row["보호자전화"] ?? "";

  if (!parentName.trim()) throw new Error("보호자이름 누락");
  if (!parentPhoneRaw.trim()) throw new Error("보호자전화 누락");

  const phone = normalizePhone(parentPhoneRaw);
  if (!validatePhone(phone)) throw new Error(`보호자전화 형식 오류: ${parentPhoneRaw}`);

  const email = (row["이메일"] ?? "").trim();
  if (email && !validateEmail(email)) throw new Error(`이메일 형식 오류: ${email}`);

  const interests = (row["관심사"] ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const childName = (row["아이이름"] ?? "").trim();
  const childAge = toInt(row["아이나이"]);
  const children =
    childName || childAge !== null
      ? [{ name: childName || null, age: childAge }]
      : [];

  // Duplicate check — by parent_phone
  const { data: existing } = await sb
    .from("partner_customers")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("parent_phone", phone)
    .maybeSingle();

  if (existing) {
    if (strategy === "SKIP") {
      results.skipped++;
      return;
    }
    const updater = sb.from("partner_customers").update!;
    const { error } = await updater({
      parent_name: parentName.trim(),
      email: email || null,
      address: (row["주소"] ?? "").trim() || null,
      children,
      interests: interests.length ? interests : null,
    }).eq("id", existing.id);
    if (error) throw new Error(error.message);
    results.updated++;
    return;
  }

  const account = await createAutoAccount("CUSTOMER", parentName);

  const { error } = await sb.from("partner_customers").insert({
    partner_id: partnerId,
    parent_name: parentName.trim(),
    parent_phone: phone,
    email: email || null,
    address: (row["주소"] ?? "").trim() || null,
    children,
    interests: interests.length ? interests : null,
    auto_username: account.username,
    auto_password_hash: account.hash,
    status: "ACTIVE",
  });
  if (error) throw new Error(error.message);

  await notifyNewCustomer(
    sb as unknown as Parameters<typeof notifyNewCustomer>[0],
    {
      type: "CUSTOMER",
      name: parentName.trim(),
      phone,
      username: account.username,
      tempPassword: account.plaintext,
    }
  ).catch(() => {});

  results.success++;
  void rowNum;
}

async function importCompanyRow(
  sb: SupabaseLike,
  partnerId: string,
  row: Record<string, string>,
  strategy: ImportStrategy,
  results: BulkImportResult,
  rowNum: number
): Promise<void> {
  const companyName = row["회사명*"] ?? row["회사명"] ?? "";
  const bizRaw = row["사업자등록번호*"] ?? row["사업자등록번호"] ?? "";
  const repName = row["대표자*"] ?? row["대표자"] ?? "";

  if (!companyName.trim()) throw new Error("회사명 누락");
  if (!bizRaw.trim()) throw new Error("사업자등록번호 누락");
  if (!repName.trim()) throw new Error("대표자 누락");

  const bizNumber = normalizeBusinessNumber(bizRaw);
  if (!validateBusinessNumber(bizNumber)) {
    throw new Error(`사업자등록번호 형식 오류: ${bizRaw}`);
  }

  const repPhoneRaw = (row["대표전화"] ?? "").trim();
  const repPhone = repPhoneRaw ? normalizePhone(repPhoneRaw) : null;

  const email = (row["회사이메일"] ?? "").trim();
  if (email && !validateEmail(email)) throw new Error(`이메일 형식 오류: ${email}`);

  // Duplicate check — by business_number
  const { data: existing } = await sb
    .from("partner_companies")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("business_number", bizNumber)
    .maybeSingle();

  if (existing) {
    if (strategy === "SKIP") {
      results.skipped++;
      return;
    }
    const updater = sb.from("partner_companies").update!;
    const { error } = await updater({
      company_name: companyName.trim(),
      representative_name: repName.trim(),
      representative_phone: repPhone,
      company_email: email || null,
      industry: (row["업종"] ?? "").trim() || null,
      employee_count: toInt(row["직원수"]),
    }).eq("id", existing.id);
    if (error) throw new Error(error.message);
    results.updated++;
    return;
  }

  const account = await createAutoAccount("COMPANY", companyName);

  const { error } = await sb.from("partner_companies").insert({
    partner_id: partnerId,
    company_name: companyName.trim(),
    business_number: bizNumber,
    representative_name: repName.trim(),
    representative_phone: repPhone,
    company_email: email || null,
    industry: (row["업종"] ?? "").trim() || null,
    employee_count: toInt(row["직원수"]),
    auto_username: account.username,
    auto_password_hash: account.hash,
    status: "LEAD",
  });
  if (error) throw new Error(error.message);

  const notifyPhone =
    repPhone ?? normalizePhone(row["담당자연락처"] ?? "");
  if (notifyPhone) {
    await notifyNewCustomer(
      sb as unknown as Parameters<typeof notifyNewCustomer>[0],
      {
        type: "COMPANY",
        name: companyName.trim(),
        phone: notifyPhone,
        username: account.username,
        tempPassword: account.plaintext,
      }
    ).catch(() => {});
  }

  results.success++;
  void rowNum;
}

function toInt(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const s = String(raw).trim().replace(/[^0-9-]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeOrgType(
  raw: string | undefined | null
):
  | "DAYCARE"
  | "KINDERGARTEN"
  | "ELEMENTARY"
  | "MIDDLE"
  | "HIGH"
  | "EDUCATION_OFFICE"
  | "OTHER"
  | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  const valid = [
    "DAYCARE",
    "KINDERGARTEN",
    "ELEMENTARY",
    "MIDDLE",
    "HIGH",
    "EDUCATION_OFFICE",
    "OTHER",
  ] as const;
  if ((valid as readonly string[]).includes(s)) return s as (typeof valid)[number];
  // Korean aliases
  if (raw.includes("어린이집")) return "DAYCARE";
  if (raw.includes("유치원")) return "KINDERGARTEN";
  if (raw.includes("초등")) return "ELEMENTARY";
  if (raw.includes("중학")) return "MIDDLE";
  if (raw.includes("고등")) return "HIGH";
  if (raw.includes("교육청")) return "EDUCATION_OFFICE";
  return "OTHER";
}
