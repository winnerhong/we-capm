"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { createInvoiceAction, acornBonusRate } from "../actions";

export interface PartnerOption {
  id: string;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
}

type TargetType =
  | "PARTNER"
  | "MANAGER"
  | "ADVERTISER"
  | "AFFILIATE"
  | "B2B_CLIENT"
  | "ORG"
  | "PARTICIPANT";

type Category =
  | "ACORN_RECHARGE"
  | "SUBSCRIPTION"
  | "EVENT_FEE"
  | "AD_CAMPAIGN"
  | "COUPON_FEE"
  | "B2B_CONTRACT"
  | "SETTLEMENT"
  | "REFUND"
  | "OTHER";

const TARGET_OPTIONS: { value: TargetType; label: string; emoji: string }[] = [
  { value: "PARTNER", label: "숲지기", emoji: "🏡" },
  { value: "MANAGER", label: "기관", emoji: "🏢" },
  { value: "ADVERTISER", label: "광고주", emoji: "📣" },
  { value: "AFFILIATE", label: "가맹점", emoji: "🛍️" },
  { value: "B2B_CLIENT", label: "B2B 기업", emoji: "💼" },
  { value: "ORG", label: "단체", emoji: "🤝" },
  { value: "PARTICIPANT", label: "참가자", emoji: "👤" },
];

const CATEGORY_OPTIONS: { value: Category; label: string; emoji: string }[] = [
  { value: "ACORN_RECHARGE", label: "도토리 충전", emoji: "🌰" },
  { value: "SUBSCRIPTION", label: "구독료", emoji: "🔁" },
  { value: "EVENT_FEE", label: "행사 참가비", emoji: "🎫" },
  { value: "AD_CAMPAIGN", label: "광고비", emoji: "📣" },
  { value: "COUPON_FEE", label: "쿠폰 수수료", emoji: "🎟️" },
  { value: "B2B_CONTRACT", label: "B2B 계약", emoji: "💼" },
  { value: "SETTLEMENT", label: "정산", emoji: "💸" },
  { value: "OTHER", label: "기타", emoji: "📄" },
];

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "CARD", label: "카드" },
  { value: "BANK_TRANSFER", label: "계좌이체" },
  { value: "VIRTUAL_ACCOUNT", label: "가상계좌" },
  { value: "KAKAOPAY", label: "카카오페이" },
  { value: "NAVERPAY", label: "네이버페이" },
  { value: "TOSSPAY", label: "토스페이" },
];

function fmtKRW(n: number): string {
  return n.toLocaleString("ko-KR");
}

interface Props {
  partners: PartnerOption[];
}

export function InvoiceForm({ partners }: Props) {
  const searchParams = useSearchParams();
  const initialCategory = (searchParams.get("category") as Category) ?? "ACORN_RECHARGE";
  const initialTargetType = (searchParams.get("target_type") as TargetType) ?? "PARTNER";

  const [targetType, setTargetType] = useState<TargetType>(initialTargetType);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    searchParams.get("target_id") ?? partners[0]?.id ?? "",
  );
  const [manualTargetId, setManualTargetId] = useState("");
  const [manualTargetName, setManualTargetName] = useState("");
  const [manualTargetEmail, setManualTargetEmail] = useState("");
  const [manualTargetPhone, setManualTargetPhone] = useState("");
  const [partnerSearch, setPartnerSearch] = useState("");

  const [category, setCategory] = useState<Category>(initialCategory);
  const [amount, setAmount] = useState<number>(
    initialCategory === "ACORN_RECHARGE" ? 1_000_000 : 100_000,
  );
  const [methods, setMethods] = useState<string[]>(["CARD", "BANK_TRANSFER"]);
  const [description, setDescription] = useState("");
  const [memo, setMemo] = useState("");
  const [expiresDays, setExpiresDays] = useState(7);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredPartners = useMemo(() => {
    const q = partnerSearch.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.business_name ?? "").toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q),
    );
  }, [partners, partnerSearch]);

  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === selectedPartnerId) ?? null,
    [partners, selectedPartnerId],
  );

  // Auto-calc VAT/bonus preview.
  const vat = Math.floor(amount * 0.1);
  const total = amount + vat;
  const bonusRate = category === "ACORN_RECHARGE" ? acornBonusRate(amount) : 0;
  const baseAcorns = category === "ACORN_RECHARGE" ? Math.floor(amount / 3000) : 0;
  const bonusAcorns = Math.floor(baseAcorns * (bonusRate / 100));
  const totalAcorns = baseAcorns + bonusAcorns;

  const usePartnerList = targetType === "PARTNER";

  const toggleMethod = (value: string) => {
    setMethods((prev) =>
      prev.includes(value) ? prev.filter((m) => m !== value) : [...prev, value],
    );
  };

  const handleSubmit = (formData: FormData) => {
    setError(null);

    if (usePartnerList) {
      if (!selectedPartner) {
        setError("숲지기를 선택해주세요");
        return;
      }
      formData.set("target_id", selectedPartner.id);
      formData.set("target_name", selectedPartner.business_name ?? selectedPartner.name);
      formData.set("target_email", selectedPartner.email ?? "");
      formData.set("target_phone", selectedPartner.phone ?? "");
    } else {
      if (!manualTargetId.trim() || !manualTargetName.trim()) {
        setError("대상 ID와 이름을 입력해주세요");
        return;
      }
      formData.set("target_id", manualTargetId);
      formData.set("target_name", manualTargetName);
      formData.set("target_email", manualTargetEmail);
      formData.set("target_phone", manualTargetPhone);
    }

    if (methods.length === 0) {
      setError("결제 수단을 최소 1개 선택해주세요");
      return;
    }

    startTransition(async () => {
      try {
        await createInvoiceAction(formData);
      } catch (err) {
        // redirect() throws NEXT_REDIRECT — re-throw so Next handles it.
        const msg = err instanceof Error ? err.message : "발송 실패";
        if (msg === "NEXT_REDIRECT") throw err;
        setError(msg);
      }
    });
  };

  return (
    <form
      action={handleSubmit}
      className="space-y-5 rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm"
    >
      {/* Hidden mirrors */}
      <input type="hidden" name="target_type" value={targetType} />
      <input type="hidden" name="category" value={category} />

      {/* 대상 유형 */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-[#2D5A3D]">
          🎯 대상 유형 <span className="text-red-500">*</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {TARGET_OPTIONS.map((opt) => {
            const active = targetType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTargetType(opt.value)}
                aria-pressed={active}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D] ${
                  active
                    ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
                    : "border-[#D4E4BC] bg-white text-[#6B4423] hover:bg-[#FFF8F0]"
                }`}
              >
                {opt.emoji} {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 대상 선택 */}
      {usePartnerList ? (
        <div>
          <label
            htmlFor="partner-search"
            className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
          >
            🏡 숲지기 선택 <span className="text-red-500">*</span>
          </label>
          <input
            id="partner-search"
            type="search"
            value={partnerSearch}
            onChange={(e) => setPartnerSearch(e.target.value)}
            placeholder="이름/사업자명/이메일 검색"
            autoComplete="off"
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
          {partners.length === 0 ? (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              등록된 숲지기가 없어요. 먼저 <code>/admin/partners/new</code>에서 등록해주세요.
            </p>
          ) : (
            <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-[#D4E4BC] bg-white">
              {filteredPartners.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#8B6F47]">
                  검색 결과가 없어요
                </div>
              ) : (
                <ul role="listbox" className="divide-y divide-[#E8F0E4]">
                  {filteredPartners.map((p) => {
                    const active = p.id === selectedPartnerId;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedPartnerId(p.id)}
                          aria-selected={active}
                          className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                            active
                              ? "bg-[#E8F0E4] font-semibold text-[#2D5A3D]"
                              : "hover:bg-[#FFF8F0]"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-[#2C2C2C]">{p.name}</div>
                            {p.business_name && (
                              <div className="truncate text-[11px] text-[#8B6F47]">
                                {p.business_name}
                              </div>
                            )}
                          </div>
                          {active && (
                            <span className="text-xs font-bold text-[#2D5A3D]">✓</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
          {selectedPartner && (
            <div className="mt-2 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 text-xs text-[#6B4423]">
              선택: <b>{selectedPartner.name}</b>
              {selectedPartner.business_name && ` (${selectedPartner.business_name})`} ·{" "}
              {selectedPartner.email ?? "이메일 미등록"}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label
              htmlFor="manual-target-id"
              className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
            >
              대상 ID <span className="text-red-500">*</span>
            </label>
            <input
              id="manual-target-id"
              type="text"
              required
              value={manualTargetId}
              onChange={(e) => setManualTargetId(e.target.value)}
              placeholder="UUID 또는 식별자"
              autoComplete="off"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
          </div>
          <div>
            <label
              htmlFor="manual-target-name"
              className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
            >
              대상 이름 <span className="text-red-500">*</span>
            </label>
            <input
              id="manual-target-name"
              type="text"
              required
              value={manualTargetName}
              onChange={(e) => setManualTargetName(e.target.value)}
              placeholder="예) OO기업"
              autoComplete="organization"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
          </div>
          <div>
            <label
              htmlFor="manual-target-email"
              className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
            >
              이메일
            </label>
            <input
              id="manual-target-email"
              type="email"
              value={manualTargetEmail}
              onChange={(e) => setManualTargetEmail(e.target.value)}
              placeholder="invoice@company.co.kr"
              autoComplete="email"
              inputMode="email"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
          </div>
          <div>
            <label
              htmlFor="manual-target-phone"
              className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
            >
              전화번호
            </label>
            <input
              id="manual-target-phone"
              type="tel"
              value={manualTargetPhone}
              onChange={(e) => setManualTargetPhone(e.target.value)}
              placeholder="010-0000-0000"
              autoComplete="tel"
              inputMode="tel"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
          </div>
        </div>
      )}

      {/* 분류 */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-[#2D5A3D]">
          📂 분류 <span className="text-red-500">*</span>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CATEGORY_OPTIONS.map((opt) => {
            const active = category === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCategory(opt.value)}
                aria-pressed={active}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D] ${
                  active
                    ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
                    : "border-[#D4E4BC] bg-white text-[#6B4423] hover:bg-[#FFF8F0]"
                }`}
              >
                <div>{opt.emoji}</div>
                <div className="text-xs">{opt.label}</div>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 금액 */}
      <div>
        <label
          htmlFor="amount"
          className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
        >
          💰 금액 (원) <span className="text-red-500">*</span>
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          min="1000"
          step="1000"
          required
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value) || 0)}
          inputMode="numeric"
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-right text-lg font-bold text-[#2D5A3D] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
        />
        {/* 금액 빠른 선택 */}
        {category === "ACORN_RECHARGE" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {[100_000, 300_000, 1_000_000, 3_000_000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                  amount === v
                    ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
                    : "border-[#D4E4BC] bg-white text-[#6B4423] hover:bg-[#FFF8F0]"
                }`}
              >
                {(v / 10_000).toLocaleString("ko-KR")}만원
              </button>
            ))}
          </div>
        )}

        {/* 요약 프리뷰 */}
        <div className="mt-3 space-y-1 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 text-sm">
          <div className="flex justify-between text-[#6B6560]">
            <span>공급가액</span>
            <span className="font-semibold text-[#2C2C2C]">{fmtKRW(amount)}원</span>
          </div>
          <div className="flex justify-between text-[#6B6560]">
            <span>부가세 (10%)</span>
            <span className="font-semibold text-[#2C2C2C]">{fmtKRW(vat)}원</span>
          </div>
          <div className="flex justify-between border-t border-[#D4E4BC] pt-1 text-base">
            <span className="font-bold text-[#2D5A3D]">총 청구액</span>
            <span className="font-extrabold text-[#2D5A3D]">{fmtKRW(total)}원</span>
          </div>
          {category === "ACORN_RECHARGE" && (
            <div className="mt-2 rounded-lg bg-[#E8F0E4] p-2 text-xs text-[#2D5A3D]">
              입금 확인 시 자동 지급: 🌰{" "}
              <b>{fmtKRW(totalAcorns)}</b> (기본 {fmtKRW(baseAcorns)} + 보너스{" "}
              {bonusRate}% = {fmtKRW(bonusAcorns)})
            </div>
          )}
        </div>
      </div>

      {/* 결제 수단 */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-[#2D5A3D]">
          💳 결제 수단 (복수 선택) <span className="text-red-500">*</span>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PAYMENT_METHODS.map((m) => {
            const active = methods.includes(m.value);
            return (
              <label
                key={m.value}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
                    : "border-[#D4E4BC] bg-white text-[#6B4423] hover:bg-[#FFF8F0]"
                }`}
              >
                <input
                  type="checkbox"
                  name="payment_methods"
                  value={m.value}
                  checked={active}
                  onChange={() => toggleMethod(m.value)}
                  className="h-4 w-4 rounded border-[#D4E4BC] text-[#2D5A3D] focus:ring-[#2D5A3D]"
                />
                <span>{m.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* 설명/메모 */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label
            htmlFor="description"
            className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
          >
            📝 설명 (대상에게 보여짐)
          </label>
          <input
            id="description"
            name="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="예) 2026년 1월 도토리 충전 100만원 티어"
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>
        <div>
          <label
            htmlFor="memo"
            className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
          >
            🗒️ 내부 메모 (관리자 전용)
          </label>
          <textarea
            id="memo"
            name="memo"
            rows={2}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="내부 관리용 메모"
            className="w-full resize-none rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>
      </div>

      {/* 만료일 */}
      <div>
        <label
          htmlFor="expires_days"
          className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
        >
          ⏰ 결제 기한 (일)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="expires_days"
            name="expires_days"
            type="number"
            min="1"
            max="90"
            value={expiresDays}
            onChange={(e) => setExpiresDays(Number(e.target.value) || 7)}
            inputMode="numeric"
            className="w-24 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-right text-sm font-semibold focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
          <span className="text-sm text-[#6B6560]">일 이내 입금</span>
          <div className="ml-auto flex gap-1">
            {[3, 7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setExpiresDays(d)}
                className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                  expiresDays === d
                    ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
                    : "border-[#D4E4BC] bg-white text-[#6B4423] hover:bg-[#FFF8F0]"
                }`}
              >
                {d}일
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {/* 액션 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => window.history.back()}
          disabled={isPending}
          className="rounded-2xl border border-[#D4E4BC] bg-white px-5 py-3 text-sm font-semibold text-[#6B4423] hover:bg-[#FFF8F0] disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-2xl bg-[#2D5A3D] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#3A7A52] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "발송 중..." : `📤 청구서 발송 (${fmtKRW(total)}원)`}
        </button>
      </div>
    </form>
  );
}
