"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import {
  encodeDescription,
  decodeDescription,
  randomCode,
  type CouponRow,
  type CouponType,
  type DiscountType,
  type CouponMeta,
} from "./types";

const VALID_TYPES: CouponType[] = [
  "WELCOME",
  "FIRST_PURCHASE",
  "REFERRAL",
  "BIRTHDAY",
  "REVIEW",
  "WEEKDAY",
  "GROUP",
  "SEASONAL",
];

function toNumber(v: FormDataEntryValue | null, fallback: number | null = null): number | null {
  if (v === null) return fallback;
  const s = String(v).trim();
  if (s === "") return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function toIso(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function parseDiscountType(v: FormDataEntryValue | null): DiscountType {
  const s = String(v ?? "").toUpperCase();
  return s === "FIXED" ? "FIXED" : "PERCENT";
}

function parseCouponType(v: FormDataEntryValue | null): CouponType | null {
  const s = String(v ?? "").toUpperCase();
  return (VALID_TYPES as string[]).includes(s) ? (s as CouponType) : null;
}

type ParsedCoupon = {
  title: string;
  description: string;
  discount_type: "PERCENT" | "AMOUNT" | "FREE";
  discount_value: number | null;
  min_amount: number | null;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  meta: CouponMeta;
};

function parseForm(formData: FormData): ParsedCoupon {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("쿠폰 이름을 입력해 주세요");

  const discountUi = parseDiscountType(formData.get("discount_type"));
  const discount_value = toNumber(formData.get("discount_value"), null);
  if (discount_value === null || discount_value <= 0) {
    throw new Error("할인 값을 입력해 주세요");
  }
  if (discountUi === "PERCENT" && discount_value > 100) {
    throw new Error("퍼센트 할인은 100%를 넘을 수 없어요");
  }

  const min_amount = toNumber(formData.get("min_amount"), null);
  const max_uses = toNumber(formData.get("usage_limit"), null);
  const per_user_limit = toNumber(formData.get("per_user_limit"), 1) ?? 1;
  const max_discount = toNumber(formData.get("max_discount"), null);

  const valid_from = toIso(formData.get("starts_at"));
  const valid_until = toIso(formData.get("ends_at"));
  if (valid_from && valid_until && new Date(valid_from) > new Date(valid_until)) {
    throw new Error("시작일이 종료일보다 늦을 수 없어요");
  }

  const auto_issue = formData.get("auto_issue") === "on" || formData.get("auto_issue") === "true";
  const coupon_type = parseCouponType(formData.get("coupon_type"));

  const codeAutoRaw = formData.get("code_auto");
  const codeInput = String(formData.get("code") ?? "").trim();
  const codeAuto =
    codeAutoRaw === "on" || codeAutoRaw === "true" || codeInput === "";
  const code = (codeAuto ? randomCode() : codeInput).toUpperCase();

  const descRaw = String(formData.get("description") ?? "").trim();

  const meta: CouponMeta = {
    code,
    coupon_type: coupon_type ?? undefined,
    auto_issue,
    per_user_limit,
    max_discount: max_discount ?? undefined,
  };

  return {
    title: name,
    description: encodeDescription(descRaw, meta),
    discount_type: discountUi === "FIXED" ? "AMOUNT" : "PERCENT",
    discount_value,
    min_amount,
    valid_from,
    valid_until,
    max_uses,
    meta,
  };
}

export async function createCouponAction(formData: FormData) {
  const partner = await requirePartner();
  const supabase = await createClient();
  const parsed = parseForm(formData);

  const insertRow = {
    affiliate_name: partner.name,
    title: parsed.title,
    description: parsed.description,
    discount_type: parsed.discount_type,
    discount_value: parsed.discount_value,
    min_amount: parsed.min_amount,
    valid_from: parsed.valid_from,
    valid_until: parsed.valid_until,
    max_uses: parsed.max_uses,
    status: "ACTIVE" as const,
  };

  const { error } = await (
    supabase.from("coupons" as never) as unknown as {
      insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
    }
  ).insert(insertRow);

  if (error) throw new Error(`쿠폰 생성 실패: ${error.message}`);

  revalidatePath("/partner/marketing/coupons");
  redirect("/partner/marketing/coupons");
}

export async function updateCouponAction(id: string, formData: FormData) {
  await requirePartner();
  const supabase = await createClient();
  const parsed = parseForm(formData);

  const updateRow = {
    title: parsed.title,
    description: parsed.description,
    discount_type: parsed.discount_type,
    discount_value: parsed.discount_value,
    min_amount: parsed.min_amount,
    valid_from: parsed.valid_from,
    valid_until: parsed.valid_until,
    max_uses: parsed.max_uses,
  };

  const { error } = await (
    supabase.from("coupons" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update(updateRow)
    .eq("id", id);

  if (error) throw new Error(`쿠폰 수정 실패: ${error.message}`);

  revalidatePath("/partner/marketing/coupons");
  revalidatePath(`/partner/marketing/coupons/${id}`);
  redirect("/partner/marketing/coupons");
}

export async function toggleCouponActiveAction(id: string, isActive: boolean) {
  await requirePartner();
  const supabase = await createClient();

  const nextStatus = isActive ? "ACTIVE" : "PAUSED";

  const { error } = await (
    supabase.from("coupons" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ status: nextStatus })
    .eq("id", id);

  if (error) throw new Error(`쿠폰 상태 변경 실패: ${error.message}`);

  revalidatePath("/partner/marketing/coupons");
}

export async function deleteCouponAction(id: string) {
  await requirePartner();
  const supabase = await createClient();

  const { error } = await (
    supabase.from("coupons" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .delete()
    .eq("id", id);

  if (error) throw new Error(`쿠폰 삭제 실패: ${error.message}`);

  revalidatePath("/partner/marketing/coupons");
}

export async function duplicateCouponAction(id: string) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const { data, error: readError } = await (
    supabase.from("coupons" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: CouponRow | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .select(
      "id,affiliate_name,affiliate_phone,title,description,discount_type,discount_value,min_amount,category,valid_from,valid_until,max_uses,used_count,status,created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (readError) throw new Error(`쿠폰 조회 실패: ${readError.message}`);
  if (!data) throw new Error("복제할 쿠폰을 찾을 수 없어요");

  // 코드만 새로 발급해 복제
  const { plain, meta } = decodeDescription(data.description);
  const newMeta: CouponMeta = { ...meta, code: randomCode() };

  const copy = {
    affiliate_name: data.affiliate_name ?? partner.name,
    affiliate_phone: data.affiliate_phone,
    title: `복사본 · ${data.title}`,
    description: encodeDescription(plain, newMeta),
    discount_type: data.discount_type,
    discount_value: data.discount_value,
    min_amount: data.min_amount,
    category: data.category,
    valid_from: data.valid_from,
    valid_until: data.valid_until,
    max_uses: data.max_uses,
    used_count: 0,
    status: "DRAFT" as const,
  };

  const { error: insError } = await (
    supabase.from("coupons" as never) as unknown as {
      insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
    }
  ).insert(copy);

  if (insError) throw new Error(`쿠폰 복제 실패: ${insError.message}`);

  revalidatePath("/partner/marketing/coupons");
}
