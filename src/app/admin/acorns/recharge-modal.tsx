"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PaymentModal } from "@/components/payment-modal";
import type { PaymentResult } from "@/lib/payments";
import { rechargePartnerAction } from "./actions";
import { AcornIcon } from "@/components/acorn-icon";

export interface PartnerLite {
  id: string;
  name: string;
  business_name: string | null;
  acorn_balance: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  partners: PartnerLite[];
  /** 선택된 파트너 id (외부 제어). 없으면 내부에서 첫 번째 자동 선택 */
  defaultPartnerId?: string | null;
}

/**
 * 충전 티어 정의.
 * - `amountKRW`: 실 결제 금액(원)
 * - `baseUnits`: 기본 지급 도토리 수량 (3,000원/도토리)
 * - `bonusPct`: 보너스 비율
 * - `totalUnits`: baseUnits * (1 + bonusPct/100)
 */
const TIERS = [
  { amountKRW: 100_000, baseUnits: 33, bonusPct: 0, popular: false, unitLabel: "3,000원" },
  { amountKRW: 300_000, baseUnits: 100, bonusPct: 10, popular: false, unitLabel: "2,727원" },
  { amountKRW: 1_000_000, baseUnits: 333, bonusPct: 15, popular: true, unitLabel: "2,608원" },
  { amountKRW: 3_000_000, baseUnits: 1000, bonusPct: 20, popular: false, unitLabel: "2,500원" },
] as const;

function totalUnits(t: (typeof TIERS)[number]): number {
  return Math.floor(t.baseUnits * (1 + t.bonusPct / 100));
}

export function RechargeModal({ open, onClose, partners, defaultPartnerId }: Props) {
  const router = useRouter();
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    defaultPartnerId ?? partners[0]?.id ?? "",
  );
  const [tierIdx, setTierIdx] = useState(2); // 기본 100만원 (인기)
  const [payOpen, setPayOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ balance: number; units: number } | null>(null);

  if (!open) return null;

  const tier = TIERS[tierIdx];
  const totalAcorns = totalUnits(tier);
  const bonusAcorns = totalAcorns - tier.baseUnits;
  const selectedPartner = partners.find((p) => p.id === selectedPartnerId) ?? null;

  const canProceed = selectedPartnerId && !!selectedPartner;

  const openPayment = () => {
    setError(null);
    if (!canProceed) {
      setError("먼저 숲지기를 선택해주세요");
      return;
    }
    setPayOpen(true);
  };

  const handlePaymentSuccess = (result: PaymentResult) => {
    setPayOpen(false);
    if (!selectedPartner) return;

    startTransition(async () => {
      try {
        const res = await rechargePartnerAction(
          selectedPartner.id,
          totalAcorns,
          result.transactionId ?? "MOCK_TXN",
        );
        if (res?.ok) {
          setSuccess({ balance: res.newBalance ?? 0, units: totalAcorns });
          router.refresh();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "충전 실패";
        setError(msg);
      }
    });
  };

  const reset = () => {
    setSuccess(null);
    setError(null);
    setTierIdx(2);
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recharge-modal-title"
        className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={() => {
          if (!isPending) onClose();
        }}
      >
        <div
          className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 id="recharge-modal-title" className="inline-flex items-center gap-1.5 text-lg font-bold text-[#2D5A3D]">
                <AcornIcon size={18} /> 도토리 충전
              </h2>
              <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
                테스트 모드
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#6B6560] text-xl hover:bg-neutral-100 disabled:opacity-40"
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          {success ? (
            /* 성공 상태 */
            <div className="text-center py-6">
              <div className="text-5xl" aria-hidden="true">
                🎉
              </div>
              <h3 className="mt-3 text-xl font-bold text-[#2D5A3D]">충전 완료!</h3>
              <p className="mt-2 text-sm text-[#6B6560]">
                <b className="text-[#2D5A3D]">{selectedPartner?.name}</b> 님에게
                <br />
                <AcornIcon /> <b>{success.units.toLocaleString("ko-KR")}</b>개가 지급되었어요
              </p>
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-[#8B6F47]">
                현재 잔액: <AcornIcon /> {success.balance.toLocaleString("ko-KR")}
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 rounded-2xl border border-[#D4E4BC] bg-white py-3 text-sm font-semibold text-[#2D5A3D] hover:bg-[#FFF8F0]"
                >
                  추가 충전
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    reset();
                  }}
                  className="flex-1 rounded-2xl bg-[#2D5A3D] py-3 text-sm font-bold text-white hover:bg-[#1F4229]"
                >
                  확인
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 숲지기 선택 */}
              <div className="mb-4">
                <label
                  htmlFor="recharge-partner"
                  className="text-sm font-semibold text-[#2C2C2C] block mb-2"
                >
                  충전할 숲지기
                </label>
                {partners.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    등록된 숲지기가 없어요. 먼저 파트너를 등록해주세요.
                  </div>
                ) : (
                  <select
                    id="recharge-partner"
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-xl border border-[#D4E4BC] bg-white px-4 py-3 text-sm text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
                  >
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.business_name ? ` (${p.business_name})` : ""} · 현재 도토리{" "}
                        {p.acorn_balance.toLocaleString("ko-KR")}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 티어 선택 */}
              <div className="mb-4">
                <p className="text-sm font-semibold text-[#2C2C2C] mb-2">충전 금액</p>
                <div className="grid grid-cols-2 gap-2">
                  {TIERS.map((t, i) => {
                    const active = i === tierIdx;
                    const total = totalUnits(t);
                    return (
                      <button
                        key={t.amountKRW}
                        type="button"
                        onClick={() => setTierIdx(i)}
                        disabled={isPending}
                        aria-pressed={active}
                        className={`relative rounded-xl border p-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D] disabled:opacity-60 ${
                          active
                            ? "border-[#2D5A3D] bg-[#E8F0E4] ring-2 ring-[#2D5A3D]"
                            : "border-[#D4E4BC] bg-white hover:bg-[#FFF8F0]"
                        }`}
                      >
                        {t.popular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[#2D5A3D] text-white px-2 py-0.5 text-[9px] font-bold">
                            인기
                          </span>
                        )}
                        <div className="text-base font-extrabold text-[#2D5A3D]">
                          {(t.amountKRW / 10000).toLocaleString("ko-KR")}만원
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#6B6560]">
                          <AcornIcon /> {total.toLocaleString("ko-KR")}개
                        </div>
                        <div
                          className={`mt-0.5 text-[10px] font-bold ${
                            t.bonusPct > 0 ? "text-[#C4956A]" : "text-[#8B6F47]"
                          }`}
                        >
                          {t.bonusPct > 0 ? `+${t.bonusPct}% 보너스` : "보너스 없음"}
                        </div>
                        <div className="mt-0.5 text-[10px] text-[#8B6F47]">
                          단가 {t.unitLabel}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 요약 */}
              <div className="rounded-xl bg-[#FFF8F0] border border-[#D4E4BC] p-4 mb-4 space-y-1 text-sm">
                <div className="flex justify-between text-[#6B6560]">
                  <span>결제 금액</span>
                  <span className="font-semibold text-[#2C2C2C]">
                    ₩ {tier.amountKRW.toLocaleString("ko-KR")}
                  </span>
                </div>
                <div className="flex justify-between text-[#6B6560]">
                  <span>기본 지급</span>
                  <span className="inline-flex items-center gap-1"><AcornIcon /> {tier.baseUnits.toLocaleString("ko-KR")}</span>
                </div>
                {bonusAcorns > 0 && (
                  <div className="flex justify-between text-[#C4956A] font-semibold">
                    <span>보너스 (+{tier.bonusPct}%)</span>
                    <span className="inline-flex items-center gap-1"><AcornIcon /> +{bonusAcorns.toLocaleString("ko-KR")}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 mt-2 border-t border-[#D4E4BC] text-base">
                  <span className="font-bold text-[#2D5A3D]">총 지급 도토리</span>
                  <span className="inline-flex items-center gap-1 font-extrabold text-[#2D5A3D]">
                    <AcornIcon /> {totalAcorns.toLocaleString("ko-KR")}
                  </span>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-3"
                >
                  {error}
                </p>
              )}

              {/* 액션 */}
              <button
                type="button"
                onClick={openPayment}
                disabled={isPending || !canProceed || partners.length === 0}
                className="w-full rounded-2xl bg-[#2D5A3D] py-4 font-bold text-white hover:bg-[#1F4229] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending
                  ? "충전 처리 중..."
                  : `₩ ${tier.amountKRW.toLocaleString("ko-KR")} 결제하기`}
              </button>

              <p className="text-[10px] text-center text-[#6B6560] mt-3">
                🔒 테스트 모드 — 실제 결제는 이루어지지 않습니다
              </p>
            </>
          )}
        </div>
      </div>

      {selectedPartner && (
        <PaymentModal
          open={payOpen}
          onClose={() => setPayOpen(false)}
          onSuccess={handlePaymentSuccess}
          orderName={`도토리 충전 · ${selectedPartner.name}`}
          amount={tier.amountKRW}
          orderPrefix="ACORN"
          metadata={{ partnerId: selectedPartner.id, units: totalAcorns }}
        />
      )}
    </>
  );
}
