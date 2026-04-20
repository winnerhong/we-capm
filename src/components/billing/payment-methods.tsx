"use client";

import { useState } from "react";

/**
 * 결제 수단 선택기 (탭 기반).
 * 5가지 수단 (카드/카카오/토스/네이버/계좌이체) 중 선택, 수단별 상세 영역 표시.
 * 계좌이체는 계좌번호 복사 버튼 제공.
 */

export type PaymentMethodId =
  | "CARD"
  | "KAKAOPAY"
  | "TOSSPAY"
  | "NAVERPAY"
  | "BANK_TRANSFER";

interface Props {
  value: PaymentMethodId;
  onChange: (method: PaymentMethodId) => void;
  /** 계좌이체 선택 시 표시할 계좌 */
  bankAccount?: string | null;
  /** 사용 가능한 수단 제한 (빈 배열이면 전체) */
  allowed?: PaymentMethodId[];
  disabled?: boolean;
}

const METHODS: { id: PaymentMethodId; label: string; icon: string; accent: string }[] = [
  { id: "CARD", label: "카드", icon: "💳", accent: "bg-neutral-100" },
  { id: "KAKAOPAY", label: "카카오페이", icon: "💛", accent: "bg-yellow-100" },
  { id: "TOSSPAY", label: "토스페이", icon: "💙", accent: "bg-blue-100" },
  { id: "NAVERPAY", label: "네이버페이", icon: "💚", accent: "bg-green-100" },
  { id: "BANK_TRANSFER", label: "계좌이체", icon: "🏦", accent: "bg-neutral-100" },
];

export function PaymentMethods({
  value,
  onChange,
  bankAccount,
  allowed,
  disabled,
}: Props) {
  const [copied, setCopied] = useState(false);
  const methods = allowed && allowed.length > 0
    ? METHODS.filter((m) => allowed.includes(m.id))
    : METHODS;

  const handleCopy = async () => {
    if (!bankAccount) return;
    try {
      await navigator.clipboard.writeText(bankAccount);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API 실패 시 무시 (HTTPS 아닌 환경 등)
    }
  };

  return (
    <div className="space-y-3">
      {/* 탭: 가로 스크롤 가능 (모바일) */}
      <div
        role="tablist"
        aria-label="결제 수단 선택"
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x"
      >
        {methods.map((m) => {
          const active = value === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`pm-panel-${m.id}`}
              id={`pm-tab-${m.id}`}
              onClick={() => onChange(m.id)}
              disabled={disabled}
              className={`flex-shrink-0 snap-start rounded-xl border px-3 py-2.5 flex items-center gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D] disabled:opacity-50 ${
                active
                  ? "border-[#2D5A3D] bg-[#E8F0E4] ring-2 ring-[#2D5A3D]/40"
                  : "border-[#D4E4BC] bg-white hover:bg-[#FFF8F0]"
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ${m.accent}`}
                aria-hidden="true"
              >
                {m.icon}
              </span>
              <span className="text-sm font-semibold text-[#2C2C2C] whitespace-nowrap">
                {m.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 패널: 선택된 수단에 대한 상세 */}
      <div
        role="tabpanel"
        id={`pm-panel-${value}`}
        aria-labelledby={`pm-tab-${value}`}
        className="rounded-xl bg-[#FFF8F0] border border-[#D4E4BC] p-4 text-sm text-[#6B4423]"
      >
        {value === "CARD" && (
          <p className="leading-relaxed">
            🛡️ 국내 모든 카드 사용 가능. 결제 버튼을 누르면 안전한 결제창으로
            이동합니다.
          </p>
        )}
        {value === "KAKAOPAY" && (
          <p className="leading-relaxed">
            💛 카카오톡 앱으로 간편하게 결제. 카카오페이 머니 또는 연결된
            카드로 결제됩니다.
          </p>
        )}
        {value === "TOSSPAY" && (
          <p className="leading-relaxed">
            💙 토스 앱에서 인증 한 번으로 결제. 토스머니/계좌이체/카드 선택
            가능.
          </p>
        )}
        {value === "NAVERPAY" && (
          <p className="leading-relaxed">
            💚 네이버 간편결제. 포인트 적립 혜택이 있습니다.
          </p>
        )}
        {value === "BANK_TRANSFER" && (
          <div className="space-y-3">
            <p className="leading-relaxed">
              🏦 아래 계좌로 직접 입금해주세요. 입금 확인 후 1영업일 내로
              확정됩니다.
            </p>
            {bankAccount ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-white border border-[#D4E4BC] px-3 py-2.5">
                <span className="font-mono text-sm text-[#2C2C2C] truncate">
                  {bankAccount}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={disabled}
                  aria-live="polite"
                  className="flex-shrink-0 rounded-md bg-[#2D5A3D] text-white text-xs font-bold px-3 py-1.5 hover:bg-[#1F4229] transition-colors disabled:opacity-50"
                >
                  {copied ? "✅ 복사됨" : "복사"}
                </button>
              </div>
            ) : (
              <p className="text-xs text-[#8B6F47]">
                계좌정보가 곧 표시됩니다.
              </p>
            )}
            <p className="text-[11px] text-[#8B6F47]">
              💡 입금자명은 발급받은 청구서와 동일하게 입력해주세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
