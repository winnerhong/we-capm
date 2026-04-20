"use client";

import { useMemo, useState, useTransition } from "react";
import { selfChargeAcornsAction } from "./actions";

interface Tier {
  amount: number;
  label: string;
  bonus: number; // 0.10 = +10%
  popular?: boolean;
  sub: string;
}

const TIERS: Tier[] = [
  { amount: 100_000, label: "10만원", bonus: 0, sub: "입문 · 100🌰" },
  { amount: 300_000, label: "30만원", bonus: 0.1, sub: "+10% 보너스" },
  { amount: 1_000_000, label: "100만원", bonus: 0.15, sub: "+15% 보너스", popular: true },
  { amount: 3_000_000, label: "300만원", bonus: 0.2, sub: "+20% 보너스" },
];

const METHODS: { key: string; label: string; icon: string }[] = [
  { key: "CARD", label: "신용/체크카드", icon: "💳" },
  { key: "KAKAOPAY", label: "카카오페이", icon: "🟨" },
  { key: "NAVERPAY", label: "네이버페이", icon: "🟩" },
  { key: "TOSSPAY", label: "토스페이", icon: "🔵" },
  { key: "BANK_TRANSFER", label: "계좌이체", icon: "🏦" },
  { key: "VIRTUAL_ACCOUNT", label: "가상계좌", icon: "🧾" },
];

function calcBonusRate(amount: number): number {
  if (amount >= 3_000_000) return 0.2;
  if (amount >= 1_000_000) return 0.15;
  if (amount >= 300_000) return 0.1;
  return 0;
}

function wonKR(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

export function AcornsForm() {
  const [selectedTier, setSelectedTier] = useState<number>(2); // 100만
  const [customAmount, setCustomAmount] = useState<string>("");
  const [useCustom, setUseCustom] = useState(false);
  const [methods, setMethods] = useState<string[]>(["CARD", "BANK_TRANSFER"]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const amount = useMemo(() => {
    if (useCustom) {
      const n = Number(customAmount.replace(/[^\d]/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
    return TIERS[selectedTier]?.amount ?? 0;
  }, [useCustom, customAmount, selectedTier]);

  const bonusRate = calcBonusRate(amount);
  const baseAcorns = Math.floor(amount / 1_000);
  const bonusAcorns = Math.floor(baseAcorns * bonusRate);
  const totalAcorns = baseAcorns + bonusAcorns;
  const vat = Math.floor(amount * 0.1);
  const totalPay = amount + vat;

  const toggleMethod = (k: string) => {
    setMethods((prev) =>
      prev.includes(k) ? prev.filter((m) => m !== k) : [...prev, k],
    );
  };

  const handleSubmit = (formData: FormData) => {
    setError(null);
    if (amount < 10_000) {
      setError("최소 충전 금액은 10,000원이에요");
      return;
    }
    if (methods.length === 0) {
      setError("결제 수단을 한 개 이상 선택해주세요");
      return;
    }
    formData.set("amount", String(amount));
    methods.forEach((m) => formData.append("method", m));

    startTransition(async () => {
      try {
        await selfChargeAcornsAction(formData);
      } catch (e) {
        // redirect()는 NEXT_REDIRECT throw — catch 블록에서 re-throw 필요
        if (
          e instanceof Error &&
          "digest" in e &&
          typeof (e as { digest?: string }).digest === "string" &&
          (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw e;
        }
        setError(e instanceof Error ? e.message : "요청에 실패했어요");
      }
    });
  };

  return (
    <form action={handleSubmit} className="space-y-5">
      {/* 추천 패키지 */}
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-[#2D5A3D]">
          🎁 추천 패키지
        </legend>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {TIERS.map((t, idx) => {
            const active = !useCustom && selectedTier === idx;
            return (
              <button
                key={t.amount}
                type="button"
                onClick={() => {
                  setUseCustom(false);
                  setSelectedTier(idx);
                }}
                className={`relative rounded-2xl border-2 p-3 text-center transition focus:outline-none focus:ring-2 focus:ring-[#3A7A52] ${
                  active
                    ? "border-[#2D5A3D] bg-[#E8F0E4]"
                    : "border-[#D4E4BC] bg-white hover:border-[#3A7A52]"
                }`}
                aria-pressed={active}
              >
                {t.popular && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[#2D5A3D] px-2 py-0.5 text-[10px] font-bold text-white">
                    인기
                  </span>
                )}
                <div className="text-base font-extrabold text-[#2D5A3D] md:text-lg">
                  {t.label}
                </div>
                <div className="mt-1 text-[10px] font-semibold text-[#8B6F47]">
                  {t.sub}
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 커스텀 금액 */}
      <fieldset>
        <legend className="mb-2 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <input
            id="useCustom"
            type="checkbox"
            checked={useCustom}
            onChange={(e) => setUseCustom(e.target.checked)}
            className="h-4 w-4 rounded border-[#D4E4BC] text-[#2D5A3D] focus:ring-[#3A7A52]"
          />
          <label htmlFor="useCustom">✏️ 직접 입력</label>
        </legend>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={customAmount}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, "");
              setCustomAmount(digits ? Number(digits).toLocaleString("ko-KR") : "");
              setUseCustom(true);
            }}
            onFocus={() => setUseCustom(true)}
            placeholder="예: 500,000"
            aria-label="충전 금액 (원)"
            className="w-full rounded-xl border border-[#D4E4BC] bg-white px-4 py-3 pr-10 text-right text-base font-bold text-[#2D5A3D] placeholder-[#B5AFA8] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#8B6F47]">
            원
          </span>
        </div>
        <p className="mt-1 text-[11px] text-[#8B6F47]">
          최소 10,000원부터 충전 가능 · 1,000원당 🌰 1개 지급
        </p>
      </fieldset>

      {/* 결제 수단 */}
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-[#2D5A3D]">
          💳 결제 수단 (복수 선택)
        </legend>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {METHODS.map((m) => {
            const active = methods.includes(m.key);
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => toggleMethod(m.key)}
                aria-pressed={active}
                className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#3A7A52] ${
                  active
                    ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
                    : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#3A7A52]"
                }`}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 미리보기 */}
      <section
        aria-live="polite"
        className="rounded-2xl border-2 border-dashed border-[#C4956A]/60 bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-5"
      >
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8B6F47]">
          💡 결제 미리보기
        </h3>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-[#8B6F47]">공급가액</dt>
            <dd className="font-semibold text-[#6B4423]">{wonKR(amount)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[#8B6F47]">부가세 (10%)</dt>
            <dd className="font-semibold text-[#6B4423]">{wonKR(vat)}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-dashed border-[#C4956A]/40 pt-2">
            <dt className="font-bold text-[#6B4423]">최종 결제</dt>
            <dd className="text-xl font-extrabold text-[#6B4423]">
              {wonKR(totalPay)}
            </dd>
          </div>
        </dl>
        <div className="mt-3 rounded-xl bg-white/70 p-3">
          <p className="text-[11px] font-semibold text-[#8B6F47]">
            🌰 지급 도토리
          </p>
          <p className="mt-1 text-lg font-extrabold text-[#2D5A3D]">
            {totalAcorns.toLocaleString("ko-KR")}🌰
            {bonusRate > 0 && (
              <span className="ml-2 rounded-full bg-[#2D5A3D] px-2 py-0.5 text-[10px] font-bold text-white">
                보너스 +{Math.round(bonusRate * 100)}%
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-[#8B6F47]">
            기본 {baseAcorns.toLocaleString("ko-KR")}🌰
            {bonusAcorns > 0 && ` + 보너스 ${bonusAcorns.toLocaleString("ko-KR")}🌰`}
          </p>
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || amount < 10_000}
        className="w-full rounded-xl bg-[#2D5A3D] px-6 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {isPending ? "청구서 생성 중…" : "🧾 청구서 생성하기 →"}
      </button>
      <p className="text-center text-[11px] text-[#8B6F47]">
        청구서가 생성되면 결제 페이지로 이동해요 · 유효기간 7일
      </p>
    </form>
  );
}
