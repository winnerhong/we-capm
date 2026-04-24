"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { createCouponAction, type CouponCategory, type CouponDiscountType } from "../actions";
import { AcornIcon } from "@/components/acorn-icon";

type CategoryDef = {
  value: CouponCategory;
  icon: string;
  label: string;
  delayPresets: { value: number; label: string }[];
  recommendedLabel: string;
  gradient: string; // from-... to-...
};

const CATEGORIES: CategoryDef[] = [
  {
    value: "FOOD",
    icon: "🍽️",
    label: "음식점",
    delayPresets: [
      { value: 30, label: "30분 후" },
      { value: 60, label: "1시간 후" },
      { value: 120, label: "2시간 후" },
    ],
    recommendedLabel: "30분 후 추천",
    gradient: "from-[#FAE7D0] to-[#F1D9B8]",
  },
  {
    value: "CAFE",
    icon: "☕",
    label: "카페",
    delayPresets: [
      { value: 30, label: "30분 후" },
      { value: 120, label: "2시간 후" },
      { value: 180, label: "3시간 후" },
    ],
    recommendedLabel: "30분 / 2시간 후 추천",
    gradient: "from-[#F1D9B8] to-[#E8C9A0]",
  },
  {
    value: "DESSERT",
    icon: "🍰",
    label: "디저트",
    delayPresets: [
      { value: 60, label: "1시간 후" },
      { value: 120, label: "2시간 후" },
      { value: 180, label: "3시간 후" },
    ],
    recommendedLabel: "1시간 후 추천",
    gradient: "from-[#FAE7D0] to-[#FFE4C7]",
  },
  {
    value: "ACTIVITY",
    icon: "🎨",
    label: "체험시설",
    delayPresets: [
      { value: 120, label: "2시간 후" },
      { value: 360, label: "6시간 후" },
      { value: 1440, label: "하루 후" },
    ],
    recommendedLabel: "2시간 후 추천",
    gradient: "from-[#E8F0E4] to-[#F1D9B8]",
  },
  {
    value: "EDU",
    icon: "📚",
    label: "교육",
    delayPresets: [
      { value: 1440, label: "1일 후" },
      { value: 2880, label: "2일 후" },
      { value: 4320, label: "3일 후" },
    ],
    recommendedLabel: "3일 후 추천",
    gradient: "from-[#F1EDE7] to-[#E8C9A0]",
  },
  {
    value: "OTHER",
    icon: "🌟",
    label: "기타",
    delayPresets: [
      { value: 0, label: "즉시" },
      { value: 60, label: "1시간 후" },
      { value: 1440, label: "1일 후" },
    ],
    recommendedLabel: "즉시 발송 추천",
    gradient: "from-[#FFF8F0] to-[#FAE7D0]",
  },
];

const RADIUS_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "1km" },
  { value: 2, label: "2km" },
  { value: 5, label: "5km" },
  { value: 10, label: "10km" },
];

const DISCOUNT_TYPES: { value: CouponDiscountType; label: string; icon: string; hint: string }[] = [
  { value: "PERCENT", label: "퍼센트 할인", icon: "%", hint: "예: 10 → 10%" },
  { value: "AMOUNT", label: "금액 할인", icon: "₩", hint: "예: 3000 → 3,000원" },
  { value: "FREE", label: "무료 증정", icon: "🎁", hint: "무료 증정 상품" },
];

function formatDelay(minutes: number): string {
  if (minutes === 0) return "즉시";
  if (minutes < 60) return `${minutes}분 후`;
  if (minutes < 1440) {
    const h = Math.round((minutes / 60) * 10) / 10;
    return `${Number.isInteger(h) ? h.toFixed(0) : h.toFixed(1)}시간 후`;
  }
  const d = Math.round((minutes / 1440) * 10) / 10;
  return `${Number.isInteger(d) ? d.toFixed(0) : d.toFixed(1)}일 후`;
}

function formatDiscount(type: CouponDiscountType, value: number): string {
  if (type === "FREE") return "무료 증정";
  if (type === "PERCENT") return `${value || 0}%`;
  return `${(value || 0).toLocaleString("ko-KR")}원`;
}

function formatAmount(amount: number | null): string {
  if (amount === null || amount === 0) return "제한 없음";
  return `${amount.toLocaleString("ko-KR")}원 이상`;
}

function isoLocal(offsetHours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + offsetHours);
  // datetime-local expects YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type FormState = {
  category: CouponCategory;
  title: string;
  description: string;
  discount_type: CouponDiscountType;
  discount_value: string;
  min_amount: string;
  send_delay_minutes: number;
  location_radius_km: number;
  valid_from: string;
  valid_until: string;
  max_uses: string;
};

const DEFAULT_STATE: FormState = {
  category: "FOOD",
  title: "",
  description: "",
  discount_type: "PERCENT",
  discount_value: "10",
  min_amount: "",
  send_delay_minutes: 30,
  location_radius_km: 2,
  valid_from: isoLocal(0),
  valid_until: isoLocal(24 * 14), // 14 days
  max_uses: "",
};

const STEP_LABELS = ["카테고리", "쿠폰 내용", "발송 타겟팅", "확인 & 저장"];

export default function NewCouponWizardPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [state, setState] = useState<FormState>(DEFAULT_STATE);
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currentCategory = useMemo(
    () => CATEGORIES.find((c) => c.value === state.category) ?? CATEGORIES[0],
    [state.category]
  );

  const canNext: boolean = (() => {
    if (step === 1) return Boolean(state.category);
    if (step === 2) {
      if (!state.title.trim()) return false;
      if (state.discount_type !== "FREE") {
        const dv = Number(state.discount_value);
        if (!Number.isFinite(dv) || dv <= 0) return false;
      }
      return true;
    }
    if (step === 3) {
      return Boolean(state.valid_from) && Boolean(state.valid_until);
    }
    return true;
  })();

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function handleCategoryPick(cat: CategoryDef) {
    // pick first preset as default send_delay when category changes
    setState((prev) => ({
      ...prev,
      category: cat.value,
      send_delay_minutes: cat.delayPresets[0]?.value ?? prev.send_delay_minutes,
    }));
  }

  function handleSubmit() {
    setSubmitError(null);
    const fd = new FormData();
    fd.set("category", state.category);
    fd.set("title", state.title);
    fd.set("description", state.description);
    fd.set("discount_type", state.discount_type);
    fd.set(
      "discount_value",
      state.discount_type === "FREE" ? "0" : String(Number(state.discount_value) || 0)
    );
    if (state.min_amount.trim() !== "") fd.set("min_amount", state.min_amount);
    fd.set("send_delay_minutes", String(state.send_delay_minutes));
    fd.set("location_radius_km", String(state.location_radius_km));
    if (state.valid_from) fd.set("valid_from", state.valid_from);
    if (state.valid_until) fd.set("valid_until", state.valid_until);
    if (state.max_uses.trim() !== "") fd.set("max_uses", state.max_uses);

    startTransition(async () => {
      try {
        await createCouponAction(fd);
      } catch (e) {
        // Next.js redirect throws a special error that should not be caught here.
        // We only set the message if it's a real error.
        const msg = e instanceof Error ? e.message : "저장 중 오류가 발생했어요";
        if (!/NEXT_REDIRECT/i.test(msg)) {
          setSubmitError(msg);
        } else {
          // re-throw so Next.js can handle the redirect
          throw e;
        }
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/store/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">새 쿠폰 만들기</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#E8C9A0] bg-gradient-to-br from-[#FAE7D0] via-white to-[#E8F0E4] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            <AcornIcon size={28} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">새 쿠폰 만들기</h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              4단계로 쉽게 만들고, 행사 종료 후 자동으로 발송돼요.
            </p>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div aria-label="진행 단계" className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-[#6B6560]">
          <span>
            단계 <span className="text-[#2D5A3D]">{step}</span> / 4
          </span>
          <span className="text-[#8B5E3C]">{STEP_LABELS[step - 1]}</span>
        </div>
        <div className="flex gap-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={4}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-all ${
                i <= step
                  ? "bg-gradient-to-r from-[#C4956A] to-[#2D5A3D]"
                  : "bg-[#F1EDE7]"
              }`}
              aria-hidden
            />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2 text-[10px] md:text-xs">
          {STEP_LABELS.map((label, idx) => (
            <div
              key={label}
              className={`text-center ${
                idx + 1 === step
                  ? "font-bold text-[#2D5A3D]"
                  : idx + 1 < step
                  ? "font-semibold text-[#8B5E3C]"
                  : "text-[#B5AFA8]"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <section className="rounded-3xl border border-[#E8C9A0] bg-white p-5 shadow-sm md:p-6">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">
                어떤 업종의 쿠폰인가요?
              </h2>
              <p className="mt-1 text-xs text-[#6B6560]">
                카테고리에 따라 발송 타이밍이 자동 추천돼요.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {CATEGORIES.map((cat) => {
                const active = cat.value === state.category;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => handleCategoryPick(cat)}
                    aria-pressed={active}
                    className={`group rounded-2xl border-2 p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[#C4956A]/50 ${
                      active
                        ? "border-[#2D5A3D] bg-gradient-to-br from-[#E8F0E4] to-white shadow-md"
                        : "border-[#E8C9A0] bg-white hover:border-[#C4956A] hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-3xl" aria-hidden>
                        {cat.icon}
                      </span>
                      {active && (
                        <span className="rounded-full bg-[#2D5A3D] px-2 py-0.5 text-[10px] font-bold text-white">
                          선택됨
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-bold text-[#2D5A3D]">{cat.label}</p>
                    <p className="mt-1 text-[11px] text-[#8B5E3C]">{cat.recommendedLabel}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">쿠폰 내용 작성</h2>
              <p className="mt-1 text-xs text-[#6B6560]">
                토리로 가족들에게 보여질 정보예요.
              </p>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
                쿠폰 제목 <span className="text-[#B04A4A]">*</span>
              </label>
              <input
                id="title"
                type="text"
                autoComplete="off"
                inputMode="text"
                placeholder="예: 시원한 음료 10% 할인"
                value={state.title}
                onChange={(e) => setField("title", e.target.value)}
                maxLength={40}
                className="w-full rounded-xl border border-[#E8C9A0] bg-[#FFF8F0] px-4 py-3 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">{state.title.length}/40자</p>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
              >
                설명
              </label>
              <textarea
                id="description"
                rows={3}
                placeholder="예: 오늘 행사에 참여한 가족 모두에게 드리는 작은 선물이에요."
                value={state.description}
                onChange={(e) => setField("description", e.target.value)}
                maxLength={120}
                className="w-full resize-none rounded-xl border border-[#E8C9A0] bg-[#FFF8F0] px-4 py-3 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">{state.description.length}/120자</p>
            </div>

            {/* Discount Type */}
            <div>
              <span className="mb-1 block text-sm font-semibold text-[#2D5A3D]">할인 타입</span>
              <div className="grid grid-cols-3 gap-2">
                {DISCOUNT_TYPES.map((d) => {
                  const active = state.discount_type === d.value;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setField("discount_type", d.value)}
                      aria-pressed={active}
                      className={`rounded-xl border-2 p-3 text-center transition focus:outline-none focus:ring-2 focus:ring-[#C4956A]/50 ${
                        active
                          ? "border-[#2D5A3D] bg-[#E8F0E4]"
                          : "border-[#E8C9A0] bg-white hover:border-[#C4956A]"
                      }`}
                    >
                      <div className="text-xl font-bold text-[#8B5E3C]">{d.icon}</div>
                      <div className="mt-1 text-xs font-bold text-[#2D5A3D]">{d.label}</div>
                      <div className="mt-0.5 text-[10px] text-[#8B7F75]">{d.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Discount value */}
            {state.discount_type !== "FREE" && (
              <div>
                <label
                  htmlFor="discount_value"
                  className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
                >
                  할인 값 <span className="text-[#B04A4A]">*</span>
                </label>
                <div className="relative">
                  <input
                    id="discount_value"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={state.discount_type === "PERCENT" ? 100 : undefined}
                    placeholder={state.discount_type === "PERCENT" ? "10" : "3000"}
                    value={state.discount_value}
                    onChange={(e) => setField("discount_value", e.target.value)}
                    className="w-full rounded-xl border border-[#E8C9A0] bg-[#FFF8F0] px-4 py-3 pr-12 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#8B5E3C]">
                    {state.discount_type === "PERCENT" ? "%" : "원"}
                  </span>
                </div>
              </div>
            )}

            {/* Min amount */}
            <div>
              <label
                htmlFor="min_amount"
                className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
              >
                최소 주문 금액 <span className="text-xs font-normal text-[#8B7F75]">(선택)</span>
              </label>
              <div className="relative">
                <input
                  id="min_amount"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="예: 10000"
                  value={state.min_amount}
                  onChange={(e) => setField("min_amount", e.target.value)}
                  className="w-full rounded-xl border border-[#E8C9A0] bg-[#FFF8F0] px-4 py-3 pr-12 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#8B5E3C]">
                  원
                </span>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">발송 타겟팅</h2>
              <p className="mt-1 text-xs text-[#6B6560]">
                누구에게, 언제 쿠폰을 보낼지 결정해요.
              </p>
            </div>

            {/* Send delay */}
            <div>
              <span className="mb-2 block text-sm font-semibold text-[#2D5A3D]">
                발송 지연 시간 <span className="text-xs font-normal text-[#8B7F75]">(행사 종료 후)</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {currentCategory.delayPresets.map((p) => {
                  const active = state.send_delay_minutes === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setField("send_delay_minutes", p.value)}
                      aria-pressed={active}
                      className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#C4956A]/50 ${
                        active
                          ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                          : "border-[#E8C9A0] bg-white text-[#2D5A3D] hover:border-[#C4956A]"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-[#8B5E3C]">
                💡 {currentCategory.label}은 <strong>{currentCategory.recommendedLabel}</strong>
              </p>
            </div>

            {/* Radius */}
            <div>
              <span className="mb-2 block text-sm font-semibold text-[#2D5A3D]">
                위치 반경 <span className="text-xs font-normal text-[#8B7F75]">(가게 주변)</span>
              </span>
              <div className="grid grid-cols-4 gap-2">
                {RADIUS_OPTIONS.map((r) => {
                  const active = state.location_radius_km === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setField("location_radius_km", r.value)}
                      aria-pressed={active}
                      className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#C4956A]/50 ${
                        active
                          ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
                          : "border-[#E8C9A0] bg-white text-[#6B6560] hover:border-[#C4956A]"
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Valid from / until */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label
                  htmlFor="valid_from"
                  className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
                >
                  유효 시작
                </label>
                <input
                  id="valid_from"
                  type="datetime-local"
                  value={state.valid_from}
                  onChange={(e) => setField("valid_from", e.target.value)}
                  className="w-full rounded-xl border border-[#E8C9A0] bg-[#FFF8F0] px-4 py-3 text-sm text-[#2C2C2C] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
                />
              </div>
              <div>
                <label
                  htmlFor="valid_until"
                  className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
                >
                  유효 종료
                </label>
                <input
                  id="valid_until"
                  type="datetime-local"
                  value={state.valid_until}
                  onChange={(e) => setField("valid_until", e.target.value)}
                  className="w-full rounded-xl border border-[#E8C9A0] bg-[#FFF8F0] px-4 py-3 text-sm text-[#2C2C2C] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
                />
              </div>
            </div>

            {/* Max uses */}
            <div>
              <label
                htmlFor="max_uses"
                className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
              >
                최대 사용 개수 <span className="text-xs font-normal text-[#8B7F75]">(선택 · 비우면 무제한)</span>
              </label>
              <input
                id="max_uses"
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="예: 100"
                value={state.max_uses}
                onChange={(e) => setField("max_uses", e.target.value)}
                className="w-full rounded-xl border border-[#E8C9A0] bg-[#FFF8F0] px-4 py-3 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/30"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">미리보기 & 저장</h2>
              <p className="mt-1 text-xs text-[#6B6560]">
                이렇게 가족들에게 전달돼요.
              </p>
            </div>

            {/* Preview card */}
            <article
              className={`relative overflow-hidden rounded-3xl border-2 border-[#C4956A] bg-gradient-to-br ${currentCategory.gradient} p-6 shadow-md`}
            >
              <div className="absolute right-4 top-4 rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-[#8B5E3C] backdrop-blur">
                ✨ 곧 발송돼요
              </div>

              <div className="flex items-start gap-3">
                <span className="text-4xl" aria-hidden>
                  {currentCategory.icon}
                </span>
                <div className="flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#8B5E3C]">
                    {currentCategory.label}
                  </p>
                  <h3 className="mt-0.5 text-lg font-bold text-[#2D5A3D] md:text-xl">
                    {state.title || "쿠폰 제목"}
                  </h3>
                  {state.description && (
                    <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                      {state.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-white/90 p-4 backdrop-blur">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-[#8B5E3C]">할인 혜택</p>
                    <p className="mt-0.5 text-3xl font-extrabold text-[#2D5A3D] md:text-4xl">
                      {formatDiscount(state.discount_type, Number(state.discount_value))}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-[#6B6560]">
                    <p>{formatAmount(Number(state.min_amount) || null)}</p>
                    {state.max_uses && <p className="mt-0.5">선착순 {state.max_uses}명</p>}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full bg-[#2D5A3D] px-3 py-1 font-semibold text-white">
                  ⏰ {formatDelay(state.send_delay_minutes)} 발송
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 font-semibold text-[#8B5E3C] backdrop-blur">
                  📍 반경 {state.location_radius_km}km
                </span>
              </div>
            </article>

            {/* Summary list */}
            <dl className="grid grid-cols-1 gap-2 rounded-2xl border border-[#E8C9A0] bg-[#FFF8F0] p-4 text-xs md:grid-cols-2 md:text-sm">
              <div className="flex justify-between gap-2 py-1">
                <dt className="text-[#8B7F75]">카테고리</dt>
                <dd className="font-semibold text-[#2D5A3D]">
                  {currentCategory.icon} {currentCategory.label}
                </dd>
              </div>
              <div className="flex justify-between gap-2 py-1">
                <dt className="text-[#8B7F75]">할인</dt>
                <dd className="font-semibold text-[#2D5A3D]">
                  {formatDiscount(state.discount_type, Number(state.discount_value))}
                </dd>
              </div>
              <div className="flex justify-between gap-2 py-1">
                <dt className="text-[#8B7F75]">최소 주문</dt>
                <dd className="font-semibold text-[#2D5A3D]">
                  {formatAmount(Number(state.min_amount) || null)}
                </dd>
              </div>
              <div className="flex justify-between gap-2 py-1">
                <dt className="text-[#8B7F75]">발송 타이밍</dt>
                <dd className="font-semibold text-[#2D5A3D]">
                  {formatDelay(state.send_delay_minutes)}
                </dd>
              </div>
              <div className="flex justify-between gap-2 py-1">
                <dt className="text-[#8B7F75]">위치 반경</dt>
                <dd className="font-semibold text-[#2D5A3D]">{state.location_radius_km}km</dd>
              </div>
              <div className="flex justify-between gap-2 py-1">
                <dt className="text-[#8B7F75]">유효 기간</dt>
                <dd className="text-right font-semibold text-[#2D5A3D]">
                  {state.valid_from
                    ? new Date(state.valid_from).toLocaleString("ko-KR", {
                        month: "numeric",
                        day: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                      })
                    : "-"}
                  {" ~ "}
                  {state.valid_until
                    ? new Date(state.valid_until).toLocaleString("ko-KR", {
                        month: "numeric",
                        day: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                      })
                    : "-"}
                </dd>
              </div>
              <div className="flex justify-between gap-2 py-1 md:col-span-2">
                <dt className="text-[#8B7F75]">최대 사용 개수</dt>
                <dd className="font-semibold text-[#2D5A3D]">
                  {state.max_uses ? `${Number(state.max_uses).toLocaleString("ko-KR")}개` : "무제한"}
                </dd>
              </div>
            </dl>

            {submitError && (
              <div
                role="alert"
                className="rounded-xl border border-[#B04A4A]/30 bg-[#FCE7E7] px-4 py-3 text-xs text-[#B04A4A]"
              >
                ⚠️ {submitError}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Navigation */}
      <nav
        aria-label="단계 이동"
        className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (Math.max(1, s - 1) as 1 | 2 | 3 | 4))}
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-[#E8C9A0] bg-white px-5 py-3 text-sm font-semibold text-[#6B6560] transition hover:bg-[#FFF8F0] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/40 disabled:opacity-50 sm:w-auto"
            >
              ← 이전
            </button>
          ) : (
            <Link
              href="/store/dashboard"
              className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-[#E8C9A0] bg-white px-5 py-3 text-sm font-semibold text-[#6B6560] transition hover:bg-[#FFF8F0] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/40 sm:w-auto"
            >
              취소
            </Link>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {step < 4 ? (
            <button
              type="button"
              onClick={() => canNext && setStep((s) => (Math.min(4, s + 1) as 1 | 2 | 3 | 4))}
              disabled={!canNext}
              className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[#2D5A3D] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/50 disabled:cursor-not-allowed disabled:bg-[#B5AFA8] sm:w-auto"
            >
              다음 →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/50 disabled:opacity-60 sm:w-auto"
            >
              {isPending ? "저장 중..." : (<><AcornIcon /> 쿠폰 저장하기</>)}
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
