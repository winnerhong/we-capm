"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type InquiryStatus = "NEW" | "CONTACTED" | "PROPOSED" | "WON" | "LOST";
const STATUS_SET = new Set<InquiryStatus>(["NEW", "CONTACTED", "PROPOSED", "WON", "LOST"]);

const PACKAGE_SET = new Set<string>(["BASIC", "PREMIUM", "ENTERPRISE"]);
const ATTENDEE_SET = new Set<string>(["~50", "50~100", "100~200", "200+"]);

export async function submitB2BInquiryAction(formData: FormData) {
  const supabase = await createClient();

  const company_name = String(formData.get("company_name") ?? "").trim();
  const contact_name = String(formData.get("contact_name") ?? "").trim();
  const contact_email = String(formData.get("contact_email") ?? "").trim() || null;
  const contact_phone = String(formData.get("contact_phone") ?? "").trim() || null;
  const expected_attendees_raw = String(formData.get("expected_attendees") ?? "").trim();
  const expected_attendees = ATTENDEE_SET.has(expected_attendees_raw) ? expected_attendees_raw : null;

  const packagesRaw = formData.getAll("interested_packages").map((v) => String(v));
  const interested_packages = packagesRaw.filter((p) => PACKAGE_SET.has(p));

  const preferred_date_raw = String(formData.get("preferred_date") ?? "").trim();
  let preferred_date: string | null = null;
  if (preferred_date_raw) {
    const dt = new Date(preferred_date_raw);
    if (!Number.isNaN(dt.getTime())) preferred_date = dt.toISOString();
  }

  const message = String(formData.get("message") ?? "").trim() || null;

  if (!company_name) throw new Error("회사명을 입력해주세요");
  if (!contact_name) throw new Error("담당자 이름을 입력해주세요");
  if (!contact_email && !contact_phone) {
    throw new Error("이메일 또는 전화번호 중 하나는 필수입니다");
  }

  const { error } = await (
    supabase as unknown as {
      from: (t: string) => {
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .from("b2b_inquiries")
    .insert({
      company_name,
      contact_name,
      contact_email,
      contact_phone,
      expected_attendees,
      interested_packages: interested_packages.length > 0 ? interested_packages : null,
      preferred_date,
      message,
      status: "NEW",
    });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/b2b");
  redirect("/enterprise/thank-you");
}

export async function updateInquiryStatusAction(id: string, status: string) {
  if (!STATUS_SET.has(status as InquiryStatus)) {
    throw new Error("잘못된 상태값입니다");
  }
  const supabase = await createClient();
  const { error } = await (
    supabase as unknown as {
      from: (t: string) => {
        update: (p: Record<string, unknown>) => {
          eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .from("b2b_inquiries")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/b2b");
}

export async function updateInquiryAssigneeAction(id: string, assigned_to: string) {
  const supabase = await createClient();
  const value = assigned_to.trim() || null;
  const { error } = await (
    supabase as unknown as {
      from: (t: string) => {
        update: (p: Record<string, unknown>) => {
          eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .from("b2b_inquiries")
    .update({ assigned_to: value })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/b2b");
}

export async function deleteInquiryAction(id: string) {
  const supabase = await createClient();
  const { error } = await (
    supabase as unknown as {
      from: (t: string) => {
        delete: () => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> };
      };
    }
  )
    .from("b2b_inquiries")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/b2b");
}
