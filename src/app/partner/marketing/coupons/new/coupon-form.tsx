"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { createCouponAction, updateCouponAction } from "../actions";
import { COUPON_TYPES, type CouponType, type DiscountType, randomCode } from "../types";

export type CouponFormInitial = {
  id?: string;
  name: string;
  code: string;
  coupon_type: CouponType | null;
  discount_type: DiscountType;
  discount_value: number | "";
  min_amount: number | "";
  max_discount: number | "";
  usage_limit: number | "";
  per_user_limit: number | "";
  starts_at: string; // datetime-local
  ends_at: string;
  auto_issue: boolean;
  description: string;
};

export const DEFAULT_INITIAL: CouponFormInitial = {
  name: "",
  code: "",
  coupon_type: null,
  discount_type: "PERCENT",
  discount_value: "",
  min_amount: "",
  max_discount: "",
  usage_limit: "",
  per_user_limit: 1,
  starts_at: "",
  ends_at: "",
  auto_issue: false,
  description: "",
};

export function CouponForm({
  initial,
  mode,
}: {
  initial: CouponFormInitial;
  mode: "create" | "edit";
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial.name);
  const [code, setCode] = useState(initial.code);
  const [codeAuto, setCodeAuto] = useState(initial.code === "");
  const [couponType, setCouponType] = useState<CouponType | "">(
    initial.coupon_type ?? ""
  );
  const [discountType, setDiscountType] = useState<DiscountType>(
    initial.discount_type
  );
  const [discountValue, setDiscountValue] = useState<number | "">(
    initial.discount_value
  );
  const [minAmount, setMinAmount] = useState<number | "">(initial.min_amount);
  const [maxDiscount, setMaxDiscount] = useState<number | "">(
    initial.max_discount
  );
  const [usageLimit, setUsageLimit] = useState<number | "">(initial.usage_limit);
  const [perUserLimit, setPerUserLimit] = useState<number | "">(
    initial.per_user_limit
  );
  const [startsAt, setStartsAt] = useState(initial.starts_at);
  const [endsAt, setEndsAt] = useState(initial.ends_at);
  const [autoIssue, setAutoIssue] = useState(initial.auto_issue);
  const [description, setDescription] = useState(initial.description);

  const handleCodeBlur = () => {
    if (codeAuto && !code) {
      setCode(randomCode());
    }
  };

  const toggleCodeAuto = (next: boolean) => {
    setCodeAuto(next);
    if (next) setCode(randomCode());
  };

  const previewDiscount = useMemo(() => {
    const v = typeof discountValue === "number" ? discountValue : 0;
    if (!v) return "-";
    return discountType === "PERCENT"
      ? `${v}%`
      : `${v.toLocaleString("ko-KR")}원`;
  }, [discountType, discountValue]);

  const previewPeriod = useMemo(() => {
    const f = startsAt ? new Date(startsAt) : null;
    const t = endsAt ? new Date(endsAt) : null;
    const fmt = (d: Date | null) =>
      d ? d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : "-";
    return `${fmt(f)} ~ ${fmt(t)}`;
  }, [startsAt, endsAt]);

  const selectedType = couponType
    ? COUPON_TYPES.find((t) => t.key === couponType)
    : null;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        if (mode === "edit" && initial.id) {
          await updateCouponAction(initial.id, form);
        } else {
          await createCouponAction(form);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "쿠폰 저장에 실패했어요";
        // NEXT_REDIRECT는 정상 흐름
        if (msg.startsWith("NEXT_REDIRECT")) return;
        setError(msg);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      {/* 좌: 입력 필드 */}
      <div className="space-y-5">
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        {/* 쿠폰 타입 */}
        <Section title="1. 쿠폰 타입" icon="🏷️">
          <input type="hidden" name="coupon_type" value={couponType} />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {COUPON_TYPES.map((t) => {
              const selected = couponType === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setCouponType(t.key)}
                  className={[
                    "flex flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-[#C4956A] focus:ring-offset-1",
                    selected
                      ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
                      : "border-[#E8E4DC] bg-white text-[#6B6560] hover:border-[#C4956A]",
                  ].join(" ")}
                  aria-pressed={selected}
                >
                  <span className="text-lg" aria-hidden>
                    {t.icon}
                  </span>
                  <span className="font-bold">{t.label}</span>
                </button>
              );
            })}
          </div>
          {selectedType ? (
            <p className="mt-2 text-xs text-[#6B6560]">
              <span className="font-semibold text-[#2D5A3D]">자동 규칙:</span>{" "}
              {selectedType.autoRule}
            </p>
          ) : null}
        </Section>

        {/* 기본 정보 */}
        <Section title="2. 기본 정보" icon="📝">
          <Field label="쿠폰 이름" required htmlFor="coupon-name">
            <input
              id="coupon-name"
              name="name"
              type="text"
              required
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 첫 예약 10% 할인"
              className="w-full rounded-xl border border-[#E8E4DC] bg-white px-3 py-2 text-sm text-[#2D5A3D] shadow-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#C4956A]"
            />
          </Field>

          <Field label="쿠폰 코드" htmlFor="coupon-code">
            <div className="flex gap-2">
              <input
                id="coupon-code"
                name="code"
                type="text"
                autoComplete="off"
                inputMode="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (codeAuto) setCodeAuto(false);
                }}
                onBlur={handleCodeBlur}
                placeholder="TORIRO-ABCD1234"
                className="w-full rounded-xl border border-[#E8E4DC] bg-white px-3 py-2 font-mono text-sm text-[#2D5A3D] shadow-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#C4956A]"
                disabled={codeAuto}
              />
              <button
                type="button"
                onClick={() => setCode(randomCode())}
                className="inline-flex items-center rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#2D5A3D] transition hover:bg-[#F5F9F3]"
              >
                🎲 재생성
              </button>
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-[#6B6560]">
              <input
                type="checkbox"
                name="code_auto"
                checked={codeAuto}
                onChange={(e) => toggleCodeAuto(e.target.checked)}
                className="h-4 w-4 rounded border-[#C4956A] text-[#2D5A3D] focus:ring-[#C4956A]"
              />
              자동 생성 (저장 시 TORIRO- 패턴으로 새 코드 발급)
            </label>
          </Field>
        </Section>

        {/* 할인 */}
        <Section title="3. 할인 설정" icon="💸">
          <Field label="할인 타입" required>
            <div className="flex gap-2">
              {(["PERCENT", "FIXED"] as DiscountType[]).map((dt) => (
                <label
                  key={dt}
                  className={[
                    "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                    discountType === dt
                      ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
                      : "border-[#E8E4DC] bg-white text-[#6B6560] hover:border-[#C4956A]",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="discount_type"
                    value={dt}
                    checked={discountType === dt}
                    onChange={() => setDiscountType(dt)}
                    className="h-4 w-4 text-[#2D5A3D]"
                  />
                  <span>{dt === "PERCENT" ? "% 퍼센트" : "₩ 정액"}</span>
                </label>
              ))}
            </div>
          </Field>

          <Field label={discountType === "PERCENT" ? "할인율 (%)" : "할인 금액 (원)"} required htmlFor="discount-value">
            <input
              id="discount-value"
              name="discount_value"
              type="number"
              inputMode="numeric"
              required
              min={1}
              max={discountType === "PERCENT" ? 100 : undefined}
              value={discountValue}
              onChange={(e) =>
                setDiscountValue(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder={discountType === "PERCENT" ? "10" : "5000"}
              className="w-full rounded-xl border border-[#E8E4DC] bg-white px-3 py-2 text-sm text-[#2D5A3D] shadow-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#C4956A]"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="최소 주문 금액 (원)" htmlFor="min-amount">
              <input
                id="min-amount"
                name="min_amount"
                type="number"
                inputMode="numeric"
                min={0}
                value={minAmount}
                onChange={(e) =>
                  setMinAmount(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="선택"
                className="w-full rounded-xl border border-[#E8E4DC] bg-white px-3 py-2 text-sm text-[#2D5A3D] shadow-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#C4956A]"
              />
            </Field>

            {discountType === "PERCENT" ? (
              <Field label="최대 할인액 (원)" htmlFor="max-discount">
                <input
                  id="max-discount"
                  name="max_discount"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={maxDiscount}
                  onChange={(e) =>
                    setMaxDiscount(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  placeholder="선택"
                  className="w-full rounded-xl border border-[#E8E4DC] bg-white px-3 py-2 text-sm text-[#2D5A3D] shadow-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#C4956A]"
                />
              </Field>
            ) : null}
          </div>
        </Section>

        {/* 발행 한도 */}
        <Section title="4. 발행 · 사용 한도" icon="📦">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="총 발행 한도" htmlFor="usage-limit">
              <input
                id="usage-limit"
                name="usage_limit"
                type="number"
                inputMode="numeric"
                min={0}
                value={usageLimit}
                onChange={(e) =>
                  setUsageLimit(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="무제한"
                className="w-full rounded-xl border border-[#E8E4DC] bg-white px-3 py-2 text-sm text-[#2D5A3D] shadow-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#C4956A]"
              />
            </Field>

            <Field label="1인당 사용 한도" htmlFor="per-user-limit">
              <input
                id="per-user-limit"
                name="per_user_limit"
                type="number"
                inputMode="numeric"
                min={1}
                value={perUserLimit}
                onChange={(e) =>
                  setPerUserLimit(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
                placeholder="1"
                className="w-full rounded-xl border border-[#E8E4DC] bg-white px-3 py-2 text-sm text-[#2D5A3D] shadow-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#C4956A]"
              />
            </Field>
          </div>
        </Section>

        {/* 기간 */}
        <Section title="5. 사용 기간" icon="📅">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="시작일" htmlFor="starts-at">
              <input
                id="starts-at"
                name="starts_at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-xl border border-[#E8E4DC] bg-white px-3 py-2 text-sm text-[#2D5A3D] shadow-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#C4956A]"
              />
            </Field>
            <Field label="종료일" htmlFor="ends-at">
              <input
                id="ends-at"
                name="ends_at"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-xl border border-[#E8E4DC] bg-white px-3 py-2 text-sm text-[#2D5A3D] shadow-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#C4956A]"
              />
            </Field>
          </div>
        </Section>

        {/* 자동 발급 + 설명 */}
        <Section title="6. 추가 옵션" icon="⚙️">
          <label className="flex items-start gap-3 rounded-xl border border-[#E8E4DC] bg-[#FFF8F0] p-3">
            <input
              type="checkbox"
              name="auto_issue"
              checked={autoIssue}
              onChange={(e) => setAutoIssue(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#C4956A] text-[#2D5A3D] focus:ring-[#C4956A]"
            />
            <div>
              <div className="text-sm font-semibold text-[#2D5A3D]">
                자동 발급 켜기
              </div>
              <div className="text-[11px] text-[#6B6560]">
                쿠폰 타입에 설정된 자동 규칙에 따라 조건을 만족하는 고객에게 자동으로 발급돼요.
              </div>
            </div>
          </label>

          <Field label="설명" htmlFor="description">
            <textarea
              id="description"
              name="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="고객에게 보여질 안내 문구를 적어주세요"
              className="w-full rounded-xl border border-[#E8E4DC] bg-white px-3 py-2 text-sm text-[#2D5A3D] shadow-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#C4956A]"
            />
          </Field>
        </Section>

        {/* 액션 */}
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E8E4DC] bg-[#FFF8F0]/95 px-4 py-3 backdrop-blur md:static md:m-0 md:border-0 md:bg-transparent md:p-0">
          <Link
            href="/partner/marketing/coupons"
            className="inline-flex items-center rounded-xl border border-[#E8E4DC] bg-white px-4 py-2 text-sm font-semibold text-[#6B6560] transition hover:bg-[#FFF8F0]"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-xl bg-[#2D5A3D] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#C4956A] focus:ring-offset-2 disabled:opacity-60"
          >
            {isPending ? "저장 중…" : mode === "edit" ? "쿠폰 수정" : "쿠폰 만들기"}
          </button>
        </div>
      </div>

      {/* 우: 실시간 미리보기 */}
      <aside className="lg:sticky lg:top-6 lg:h-fit">
        <h3 className="mb-2 flex items-center gap-1 text-xs font-bold text-[#6B6560]">
          <span aria-hidden>👀</span>
          <span>실시간 미리보기</span>
        </h3>
        <div className="relative flex overflow-hidden rounded-2xl border border-[#E8E4DC] bg-[#FFF8F0] shadow-sm">
          <div aria-hidden className="flex w-2 flex-col items-center justify-between py-2">
            <span className="h-3 w-3 rounded-full bg-white shadow-inner" />
            <div className="flex-1 border-l border-dashed border-[#C4956A]/60" />
            <span className="h-3 w-3 rounded-full bg-white shadow-inner" />
          </div>
          <div className="flex-1 space-y-3 p-4">
            <div className="flex items-center gap-2">
              {selectedType ? (
                <span className="text-2xl" aria-hidden>
                  {selectedType.icon}
                </span>
              ) : null}
              <span className="text-xs font-semibold text-[#2D5A3D]">
                {selectedType?.label ?? "쿠폰 타입 미선택"}
              </span>
            </div>
            <h4 className="text-base font-bold text-[#2D5A3D]">
              {name || "쿠폰 이름을 입력해 주세요"}
            </h4>
            <div className="text-4xl font-bold text-[#C4956A]">{previewDiscount}</div>
            {minAmount ? (
              <div className="text-[11px] text-[#6B6560]">
                {typeof minAmount === "number"
                  ? `${minAmount.toLocaleString("ko-KR")}원 이상 주문 시`
                  : ""}
              </div>
            ) : null}
            <div className="rounded-xl bg-white/70 p-2 text-center">
              <div className="text-[10px] text-[#6B6560]">코드</div>
              <div className="font-mono text-sm font-bold text-[#2D5A3D]">
                {code || "—"}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#6B6560]">
              <span aria-hidden>📅</span>
              <span>{previewPeriod}</span>
            </div>
            {autoIssue ? (
              <span className="inline-flex items-center rounded-full bg-[#D4E4BC] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                ⚡ 자동 발급
              </span>
            ) : null}
            {description ? (
              <p className="border-t border-dashed border-[#E8E4DC] pt-2 text-[11px] leading-relaxed text-[#6B6560]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </aside>
    </form>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E8E4DC] bg-white p-4 shadow-sm md:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
        <span aria-hidden>{icon}</span>
        <span>{title}</span>
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
      >
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}
