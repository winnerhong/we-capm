import { Suspense } from "react";
import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { COUPON_TYPES, type CouponType, type DiscountType } from "../types";
import { CouponForm, DEFAULT_INITIAL, type CouponFormInitial } from "./coupon-form";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set<CouponType>(COUPON_TYPES.map((t) => t.key));

function parseDiscountType(v: string | undefined): DiscountType {
  return v?.toUpperCase() === "FIXED" ? "FIXED" : "PERCENT";
}

export default async function NewCouponPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    name?: string;
    discount_type?: string;
    discount_value?: string;
    auto_issue?: string;
  }>;
}) {
  await requirePartner();
  const sp = await searchParams;

  const typeRaw = (sp?.type ?? "").toUpperCase();
  const coupon_type: CouponType | null = VALID_TYPES.has(typeRaw as CouponType)
    ? (typeRaw as CouponType)
    : null;

  const parsedDV = sp?.discount_value ? Number(sp.discount_value) : NaN;
  const discount_value: number | "" = Number.isFinite(parsedDV) ? parsedDV : "";
  const initial: CouponFormInitial = {
    ...DEFAULT_INITIAL,
    name: sp?.name ?? "",
    coupon_type,
    discount_type: parseDiscountType(sp?.discount_type),
    discount_value,
    auto_issue: sp?.auto_issue === "on" || sp?.auto_issue === "true",
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 py-2">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-1">/</span>
        <Link href="/partner/marketing/coupons" className="hover:text-[#2D5A3D]">
          쿠폰 &amp; 프로모션
        </Link>
        <span className="mx-1">/</span>
        <span className="text-[#2D5A3D]">새 쿠폰</span>
      </nav>

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#2D5A3D] md:text-3xl">
          <span aria-hidden>➕</span>
          <span>새 쿠폰 만들기</span>
        </h1>
        <p className="mt-1 text-sm text-[#6B6560]">
          오른쪽 미리보기로 고객이 받을 모습을 실시간으로 확인하세요.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="rounded-2xl border border-[#E8E4DC] bg-white p-6 text-sm text-[#6B6560] shadow-sm">
            폼을 준비하고 있어요…
          </div>
        }
      >
        <CouponForm mode="create" initial={initial} />
      </Suspense>
    </div>
  );
}
