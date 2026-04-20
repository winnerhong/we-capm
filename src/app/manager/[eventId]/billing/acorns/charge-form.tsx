"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { chargeEventAcornsAction } from "../actions";

const PACKAGES = [
  { amount: 100_000, label: "10만원", bonus: 0 },
  { amount: 300_000, label: "30만원", bonus: 0.1 },
  { amount: 1_000_000, label: "100만원", bonus: 0.15, popular: true },
  { amount: 3_000_000, label: "300만원", bonus: 0.2 },
];

const METHODS = [
  { value: "BANK_TRANSFER", label: "🏦 계좌이체", desc: "세금계산서 발행 가능" },
  { value: "CARD", label: "💳 카드결제", desc: "즉시 처리" },
  { value: "KAKAOPAY", label: "💛 카카오페이", desc: "모바일 편리" },
];

type Result =
  | { ok: true; invoiceNumber: string; paymentLinkToken: string }
  | { ok: false; message: string };

export function ChargeAcornsForm({
  eventId,
  recommendedAcorns,
}: {
  eventId: string;
  recommendedAcorns: number;
}) {
  const defaultIdx = recommendedAcorns >= 1000 ? 2 : recommendedAcorns >= 300 ? 1 : 0;
  const [selected, setSelected] = useState<number>(defaultIdx);
  const [custom, setCustom] = useState<string>("");
  const [method, setMethod] = useState<string>("BANK_TRANSFER");
  const [memo, setMemo] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  const useCustom = selected === -1;
  const amount = useMemo(() => {
    if (useCustom) {
      const n = Number(custom.replace(/[^0-9]/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
    return PACKAGES[selected].amount;
  }, [useCustom, custom, selected]);

  const bonusRate = useMemo(() => {
    if (amount >= 3_000_000) return 0.2;
    if (amount >= 1_000_000) return 0.15;
    if (amount >= 300_000) return 0.1;
    return 0;
  }, [amount]);

  const baseAcorns = Math.floor(amount / 1000);
  const bonusAcorns = Math.floor(baseAcorns * bonusRate);
  const totalAcorns = baseAcorns + bonusAcorns;
  const vat = Math.floor(amount * 0.1);
  const totalKrw = amount + vat;

  const canSubmit = amount >= 10_000 && !pending;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    const fd = new FormData();
    fd.set("amount", String(amount));
    fd.set("method", method);
    if (memo) fd.set("memo", memo);

    startTransition(async () => {
      try {
        const res = await chargeEventAcornsAction(eventId, fd);
        if (res.ok && res.invoiceNumber && res.paymentLinkToken) {
          setResult({
            ok: true,
            invoiceNumber: res.invoiceNumber,
            paymentLinkToken: res.paymentLinkToken,
          });
        } else {
          setResult({ ok: false, message: res.message ?? "충전에 실패했습니다" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "오류가 발생했습니다";
        setResult({ ok: false, message: msg });
      }
    });
  }

  if (result?.ok) {
    return (
      <section className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 text-center shadow-sm">
        <div className="text-4xl" aria-hidden>🎉</div>
        <h2 className="mt-2 text-lg font-bold text-emerald-800">청구서가 발급됐어요</h2>
        <p className="mt-1 text-sm text-emerald-700">
          #{result.invoiceNumber}
        </p>
        <p className="mt-1 text-xs text-[#6B6560]">결제 후 자동으로 도토리가 충전됩니다.</p>
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Link
            href={`/pay/${result.paymentLinkToken}`}
            className="inline-block rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            지금 결제하기 →
          </Link>
          <Link
            href={`/manager/${eventId}/billing`}
            className="inline-block rounded-lg border border-blue-200 bg-white px-6 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            청구서 목록으로
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"
    >
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-blue-800">
          <span aria-hidden>📦</span>
          <span>충전 패키지 선택</span>
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {PACKAGES.map((p, i) => {
            const isSelected = selected === i;
            return (
              <button
                key={p.amount}
                type="button"
                onClick={() => setSelected(i)}
                className={`relative rounded-xl border-2 p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 shadow-md"
                    : "border-blue-100 bg-white hover:border-blue-300"
                }`}
                aria-pressed={isSelected}
              >
                {p.popular && (
                  <span className="absolute -top-2 right-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    인기
                  </span>
                )}
                <div className="font-bold text-blue-800">{p.label}</div>
                <div className="mt-1 text-[11px] text-[#6B6560]">
                  {p.bonus > 0 ? `+${p.bonus * 100}% 보너스` : "보너스 없음"}
                </div>
                <div className="mt-1 text-xs font-semibold text-emerald-700">
                  🌰 {Math.floor(
                    (p.amount / 1000) * (1 + p.bonus),
                  ).toLocaleString("ko-KR")}
                </div>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelected(-1)}
            className={`rounded-xl border-2 p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 md:col-span-4 ${
              useCustom
                ? "border-blue-500 bg-blue-50 shadow-md"
                : "border-dashed border-blue-200 bg-white hover:border-blue-300"
            }`}
            aria-pressed={useCustom}
          >
            <div className="font-bold text-blue-800">💰 직접 입력</div>
            <div className="mt-1 text-[11px] text-[#6B6560]">원하는 금액으로 충전</div>
          </button>
        </div>
      </div>

      {useCustom && (
        <div>
          <label
            htmlFor="custom-amount"
            className="block text-xs font-semibold text-[#2C2C2C]"
          >
            충전 금액 (원)
          </label>
          <input
            id="custom-amount"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="최소 10,000"
            className="mt-1 w-full rounded-lg border border-blue-100 bg-white p-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      )}

      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-blue-800">
          <span aria-hidden>💳</span>
          <span>결제 방식</span>
        </h2>
        <div className="mt-3 space-y-2">
          {METHODS.map((m) => (
            <label
              key={m.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors ${
                method === m.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-blue-100 bg-white hover:border-blue-300"
              }`}
            >
              <input
                type="radio"
                name="method"
                value={m.value}
                checked={method === m.value}
                onChange={() => setMethod(m.value)}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-[#2C2C2C]">{m.label}</span>
                <span className="block text-[11px] text-[#6B6560]">{m.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="memo" className="block text-xs font-semibold text-[#2C2C2C]">
          메모 (선택)
        </label>
        <input
          id="memo"
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          maxLength={200}
          placeholder="예: 5월 체험학습용"
          className="mt-1 w-full rounded-lg border border-blue-100 bg-white p-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {/* 요약 */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-[#6B6560]">공급가액</span>
          <span className="font-semibold">{amount.toLocaleString("ko-KR")}원</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-[#6B6560]">VAT (10%)</span>
          <span className="font-semibold">{vat.toLocaleString("ko-KR")}원</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-blue-200 pt-2">
          <span className="font-bold text-blue-800">결제 금액</span>
          <span className="font-bold text-blue-800">
            {totalKrw.toLocaleString("ko-KR")}원
          </span>
        </div>
        <div className="mt-2 flex justify-between">
          <span className="text-emerald-700">충전될 도토리</span>
          <span className="font-bold text-emerald-700">
            🌰 {totalAcorns.toLocaleString("ko-KR")}
            {bonusAcorns > 0 && (
              <span className="ml-1 text-[11px] font-normal">
                (기본 {baseAcorns.toLocaleString("ko-KR")} + 보너스 {bonusAcorns.toLocaleString("ko-KR")})
              </span>
            )}
          </span>
        </div>
      </div>

      {result && !result.ok && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {result.message}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {pending ? "청구서 발급 중..." : `${totalKrw.toLocaleString("ko-KR")}원 청구서 받기`}
      </button>
      <p className="text-center text-[11px] text-[#6B6560]">
        결제 후 자동으로 도토리가 충전되며, 청구서는 영업일 기준 7일 내 결제해야 합니다.
      </p>
    </form>
  );
}
