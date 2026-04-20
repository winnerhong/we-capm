"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CouponCategory = "FOOD" | "CAFE" | "DESSERT" | "ACTIVITY" | "EDU" | "OTHER";
export type CouponDiscountType = "PERCENT" | "AMOUNT" | "FREE";

type CouponInsert = {
  affiliate_name: string;
  affiliate_phone: string | null;
  title: string;
  description: string | null;
  category: CouponCategory;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_amount: number | null;
  send_delay_minutes: number;
  location_lat: number | null;
  location_lng: number | null;
  location_radius_km: number;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  used_count: number;
  status: string;
};

function toNumber(value: FormDataEntryValue | null, fallback: number | null = null): number | null {
  if (value === null) return fallback;
  const s = String(value).trim();
  if (s === "") return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function toDateISO(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const s = String(value).trim();
  if (s === "") return null;
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

export async function createCouponAction(formData: FormData) {
  const supabase = await createClient();

  const category = (String(formData.get("category") ?? "OTHER").trim() || "OTHER") as CouponCategory;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const discount_type = (String(formData.get("discount_type") ?? "PERCENT").trim() || "PERCENT") as CouponDiscountType;
  const discount_value = toNumber(formData.get("discount_value"), 0) ?? 0;
  const min_amount = toNumber(formData.get("min_amount"), null);
  const send_delay_minutes = toNumber(formData.get("send_delay_minutes"), 30) ?? 30;
  const location_radius_km = toNumber(formData.get("location_radius_km"), 2) ?? 2;
  const valid_from = toDateISO(formData.get("valid_from"));
  const valid_until = toDateISO(formData.get("valid_until"));
  const max_uses = toNumber(formData.get("max_uses"), null);
  const affiliate_name = String(formData.get("affiliate_name") ?? "숲속 베이커리").trim() || "숲속 베이커리";
  const affiliate_phone = String(formData.get("affiliate_phone") ?? "").trim() || null;
  const location_lat = toNumber(formData.get("location_lat"), null);
  const location_lng = toNumber(formData.get("location_lng"), null);

  if (!title) {
    throw new Error("쿠폰 제목을 입력해 주세요");
  }

  const data: CouponInsert = {
    affiliate_name,
    affiliate_phone,
    title,
    description,
    category,
    discount_type,
    discount_value,
    min_amount,
    send_delay_minutes,
    location_lat,
    location_lng,
    location_radius_km,
    valid_from,
    valid_until,
    max_uses,
    used_count: 0,
    status: "ACTIVE",
  };

  const { error } = await (
    supabase.from("coupons") as unknown as {
      insert: (d: unknown) => Promise<{ error: unknown }>;
    }
  ).insert(data);

  if (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`쿠폰 저장 실패: ${message}`);
  }

  revalidatePath("/store/dashboard");
  redirect("/store/dashboard");
}
