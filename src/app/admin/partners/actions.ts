"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

type PartnerTier = "SPROUT" | "EXPLORER" | "TREE" | "FOREST" | "LEGEND";
type PartnerStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED";

const TIER_SET = new Set<PartnerTier>(["SPROUT", "EXPLORER", "TREE", "FOREST", "LEGEND"]);
const STATUS_SET = new Set<PartnerStatus>(["PENDING", "ACTIVE", "SUSPENDED", "CLOSED"]);

export async function createPartnerAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const business_name = String(formData.get("business_name") ?? "").trim() || null;
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const tierRaw = String(formData.get("tier") ?? "SPROUT");
  const tier: PartnerTier = TIER_SET.has(tierRaw as PartnerTier) ? (tierRaw as PartnerTier) : "SPROUT";
  const commission_rate = Number(formData.get("commission_rate") ?? 20);
  const statusRaw = String(formData.get("status") ?? "ACTIVE");
  const status: PartnerStatus = STATUS_SET.has(statusRaw as PartnerStatus) ? (statusRaw as PartnerStatus) : "ACTIVE";

  if (!name || !username || !password) {
    throw new Error("필수 항목이 비어있습니다 (상호/아이디/비밀번호)");
  }
  if (Number.isNaN(commission_rate) || commission_rate < 0 || commission_rate > 100) {
    throw new Error("커미션율은 0~100 사이여야 합니다");
  }

  // 아이디 중복 확인
  const { data: existing } = await (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { id: string } | null }> } } } })
    .from("partners")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing) {
    throw new Error("이미 사용 중인 아이디입니다");
  }

  const { error } = await (supabase as unknown as { from: (t: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }> } })
    .from("partners")
    .insert({
      name,
      business_name,
      username,
      password,
      email,
      phone,
      tier,
      commission_rate,
      status,
    });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/partners");
  redirect("/admin/partners");
}

export async function updatePartnerStatusAction(id: string, status: string) {
  await requireAdmin();
  if (!STATUS_SET.has(status as PartnerStatus)) {
    throw new Error("잘못된 상태값입니다");
  }
  const supabase = await createClient();
  const { error } = await (supabase as unknown as { from: (t: string) => { update: (p: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } } })
    .from("partners")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/partners");
}

export async function updatePartnerTierAction(id: string, tier: string) {
  await requireAdmin();
  if (!TIER_SET.has(tier as PartnerTier)) {
    throw new Error("잘못된 등급입니다");
  }
  const supabase = await createClient();
  const { error } = await (supabase as unknown as { from: (t: string) => { update: (p: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } } })
    .from("partners")
    .update({ tier })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/partners");
}

export async function deletePartnerAction(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await (supabase as unknown as { from: (t: string) => { delete: () => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } } })
    .from("partners")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/partners");
}
