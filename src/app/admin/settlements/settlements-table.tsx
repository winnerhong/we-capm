"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateMonthlySettlementsAction,
  approveSettlementAction,
  bulkApproveSettlementsAction,
  markSettlementPaidAction,
} from "./actions";

export type SettlementStatus = "DRAFT" | "REVIEW" | "APPROVED" | "PAID" | "DISPUTED";

export type SettlementRow = {
  id: string;
  partner_id: string | null;
  period_start: string;
  period_end: string;
  gross_sales: number;
  refunds: number;
  commission_rate: number;
  commission_amount: number;
  acorn_deduction: number;
  other_deductions: number;
  net_amount: number;
  status: SettlementStatus;
  paid_at: string | null;
  pay_reference: string | null;
  bank_account: string | null;
  account_holder: string | null;
};

type PartnerInfo = { name: string; business_name: string | null };

const STATUS_LABEL: Record<
  SettlementStatus,
  { label: string; cls: string; dot: string }
> = {
  DRAFT: { label: "초안", cls: "bg-gray-100 text-gray-700", dot: "bg-gray-400" },
  REVIEW: {
    label: "검토중",
    cls: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
  APPROVED: {
    label: "승인",
    cls: "bg-blue-100 text-blue-800",
    dot: "bg-blue-500",
  },
  PAID: { label: "지급완료", cls: "bg-green-100 text-green-800", dot: "bg-green-500" },
  DISPUTED: { label: "이의제기", cls: "bg-red-100 text-red-700", dot: "bg-red-500" },
};

function fmtKRW(n: number): string {
  return n.toLocaleString("ko-KR");
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
}

interface Props {
  rows: SettlementRow[];
  month: string; // YYYY-MM
  partners: Record<string, PartnerInfo>;
}

export function SettlementsTable({ rows, month, partners }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [payModal, setPayModal] = useState<SettlementRow | null>(null);
  const [payRef, setPayRef] = useState("");

  const allSelectableIds = useMemo(
    () =>
      rows
        .filter((r) => r.status === "DRAFT" || r.status === "REVIEW")
        .map((r) => r.id),
    [rows],
  );
  const allSelected =
    allSelectableIds.length > 0 &&
    allSelectableIds.every((id) => selected.has(id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allSelectableIds.forEach((id) => next.delete(id));
      } else {
        allSelectableIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runAction = (fn: () => Promise<unknown>, msg: string) => {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      try {
        await fn();
        setSuccessMsg(msg);
        setSelected(new Set());
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "작업 실패");
      }
    });
  };

  const handleGenerate = () =>
    runAction(
      async () => {
        const res = await generateMonthlySettlementsAction(month);
        return res;
      },
      `${month} 정산서를 생성했어요`,
    );

  const handleBulkApprove = () => {
    if (selected.size === 0) {
      setError("정산서를 선택해주세요");
      return;
    }
    runAction(
      () => bulkApproveSettlementsAction(Array.from(selected)),
      `${selected.size}개 정산서를 일괄 승인했어요`,
    );
  };

  const handlePay = () => {
    if (!payModal) return;
    if (!payRef.trim()) {
      setError("이체 참조번호를 입력해주세요");
      return;
    }
    runAction(
      () => markSettlementPaidAction(payModal.id, payRef),
      "지급 완료로 기록했어요",
    );
    setPayModal(null);
    setPayRef("");
  };

  return (
    <>
      {/* 액션 바 */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#D4E4BC] bg-white p-4">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3A7A52] disabled:opacity-50"
        >
          {isPending ? "처리 중..." : `📊 ${month} 정산서 생성`}
        </button>
        <button
          type="button"
          onClick={handleBulkApprove}
          disabled={isPending || selected.size === 0}
          className="rounded-xl border border-[#2D5A3D] bg-white px-4 py-2 text-sm font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4] disabled:opacity-50"
        >
          ✓ 선택한 {selected.size}개 일괄 승인
        </button>
        <a
          href={`/api/admin/settlements/export?month=${month}`}
          className="ml-auto rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-xs font-semibold text-[#6B4423] hover:bg-[#F5E6D3]"
        >
          ⬇️ CSV 내보내기
        </a>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {successMsg && (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {successMsg}
        </p>
      )}

      {/* 데스크톱 테이블 */}
      <div className="hidden overflow-x-auto rounded-2xl border border-[#D4E4BC] bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-[#F5E6D3]/40 text-left text-xs text-[#8B6F47]">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                  className="h-4 w-4 rounded border-[#D4E4BC] text-[#2D5A3D] focus:ring-[#2D5A3D]"
                />
              </th>
              <th className="px-4 py-3 font-semibold">숲지기</th>
              <th className="px-4 py-3 text-right font-semibold">매출</th>
              <th className="px-4 py-3 text-right font-semibold">환불</th>
              <th className="px-4 py-3 text-right font-semibold">수수료</th>
              <th className="px-4 py-3 text-right font-semibold">정산액</th>
              <th className="px-4 py-3 font-semibold">상태</th>
              <th className="px-4 py-3 font-semibold">지급일</th>
              <th className="px-4 py-3 font-semibold">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8F0E4]">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-sm text-[#6B6560]"
                >
                  <div className="text-3xl">🧮</div>
                  <p className="mt-2 font-semibold text-[#2D5A3D]">
                    아직 {month} 정산서가 없어요
                  </p>
                  <p className="mt-1 text-xs">
                    위의 &quot;정산서 생성&quot; 버튼으로 일괄 생성할 수 있어요
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const s = STATUS_LABEL[r.status];
                const info = r.partner_id ? partners[r.partner_id] : null;
                const canSelect = r.status === "DRAFT" || r.status === "REVIEW";
                return (
                  <tr key={r.id} className="hover:bg-[#FFF8F0]/40">
                    <td className="px-4 py-3">
                      {canSelect && (
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleOne(r.id)}
                          aria-label={`${info?.name ?? r.id} 선택`}
                          className="h-4 w-4 rounded border-[#D4E4BC] text-[#2D5A3D] focus:ring-[#2D5A3D]"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#2C2C2C]">
                        {info?.name ?? "(알 수 없음)"}
                      </div>
                      {info?.business_name && (
                        <div className="text-[11px] text-[#6B6560]">
                          {info.business_name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[#2D5A3D]">
                      {fmtKRW(r.gross_sales)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-700">
                      {r.refunds > 0 ? `-${fmtKRW(r.refunds)}` : "0"}
                    </td>
                    <td className="px-4 py-3 text-right text-[#6B4423]">
                      -{fmtKRW(r.commission_amount)}
                      <div className="text-[10px] text-[#8B6F47]">
                        ({r.commission_rate}%)
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#2D5A3D]">
                      {fmtKRW(r.net_amount)}원
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B6560]">
                      {fmtDate(r.paid_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(r.status === "DRAFT" || r.status === "REVIEW") && (
                          <button
                            type="button"
                            onClick={() =>
                              runAction(
                                () => approveSettlementAction(r.id),
                                "승인했어요",
                              )
                            }
                            disabled={isPending}
                            className="rounded-lg border border-[#2D5A3D] bg-white px-2 py-1 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4] disabled:opacity-50"
                          >
                            승인
                          </button>
                        )}
                        {r.status === "APPROVED" && (
                          <button
                            type="button"
                            onClick={() => {
                              setPayModal(r);
                              setPayRef("");
                            }}
                            disabled={isPending}
                            className="rounded-lg bg-[#2D5A3D] px-2 py-1 text-xs font-semibold text-white hover:bg-[#3A7A52] disabled:opacity-50"
                          >
                            지급처리
                          </button>
                        )}
                        {r.status === "PAID" && r.pay_reference && (
                          <span className="rounded-lg bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-700">
                            Ref: {r.pay_reference.slice(0, 8)}…
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 */}
      <div className="space-y-2 md:hidden">
        {rows.map((r) => {
          const s = STATUS_LABEL[r.status];
          const info = r.partner_id ? partners[r.partner_id] : null;
          const canSelect = r.status === "DRAFT" || r.status === "REVIEW";
          return (
            <div
              key={r.id}
              className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {canSelect && (
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                        aria-label={`${info?.name ?? r.id} 선택`}
                        className="h-4 w-4 rounded border-[#D4E4BC] text-[#2D5A3D] focus:ring-[#2D5A3D]"
                      />
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}
                    >
                      {s.label}
                    </span>
                  </div>
                  <div className="mt-1 font-bold text-[#2C2C2C]">
                    {info?.name ?? "(알 수 없음)"}
                  </div>
                  {info?.business_name && (
                    <div className="text-[11px] text-[#8B6F47]">
                      {info.business_name}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold text-[#2D5A3D]">
                    {fmtKRW(r.net_amount)}
                  </div>
                  <div className="text-[10px] text-[#8B6F47]">원</div>
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                <div className="rounded-lg bg-[#FFF8F0] p-2 text-center">
                  <dt className="text-[#8B6F47]">매출</dt>
                  <dd className="font-semibold text-[#2D5A3D]">
                    {fmtKRW(r.gross_sales)}
                  </dd>
                </div>
                <div className="rounded-lg bg-[#FFF8F0] p-2 text-center">
                  <dt className="text-[#8B6F47]">수수료</dt>
                  <dd className="font-semibold text-[#6B4423]">
                    -{fmtKRW(r.commission_amount)}
                  </dd>
                </div>
                <div className="rounded-lg bg-[#FFF8F0] p-2 text-center">
                  <dt className="text-[#8B6F47]">환불</dt>
                  <dd className="font-semibold text-red-700">
                    -{fmtKRW(r.refunds)}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1">
                {(r.status === "DRAFT" || r.status === "REVIEW") && (
                  <button
                    type="button"
                    onClick={() =>
                      runAction(
                        () => approveSettlementAction(r.id),
                        "승인했어요",
                      )
                    }
                    disabled={isPending}
                    className="flex-1 rounded-lg border border-[#2D5A3D] bg-white py-1.5 text-xs font-semibold text-[#2D5A3D] disabled:opacity-50"
                  >
                    승인
                  </button>
                )}
                {r.status === "APPROVED" && (
                  <button
                    type="button"
                    onClick={() => {
                      setPayModal(r);
                      setPayRef("");
                    }}
                    disabled={isPending}
                    className="flex-1 rounded-lg bg-[#2D5A3D] py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    지급처리
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 지급 처리 모달 */}
      {payModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-modal-title"
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          onClick={() => !isPending && setPayModal(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="pay-modal-title" className="text-lg font-bold text-[#2D5A3D]">
              💸 지급 처리
            </h3>
            <p className="mt-1 text-xs text-[#6B6560]">
              {partners[payModal.partner_id ?? ""]?.name ?? "파트너"}에게{" "}
              <b className="text-[#2D5A3D]">{fmtKRW(payModal.net_amount)}원</b>을
              이체했다면, 참조번호를 기록하세요.
            </p>
            {payModal.bank_account && (
              <div className="mt-3 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 text-xs text-[#6B4423]">
                📮 {payModal.account_holder ?? ""} · {payModal.bank_account}
              </div>
            )}
            <label
              htmlFor="pay-ref"
              className="mt-4 block text-sm font-semibold text-[#2D5A3D]"
            >
              이체 참조번호
            </label>
            <input
              id="pay-ref"
              type="text"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="예) TR20260420-001"
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setPayModal(null)}
                disabled={isPending}
                className="flex-1 rounded-xl border border-[#D4E4BC] bg-white py-2.5 text-sm font-semibold text-[#6B4423] hover:bg-[#FFF8F0] disabled:opacity-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handlePay}
                disabled={isPending}
                className="flex-1 rounded-xl bg-[#2D5A3D] py-2.5 text-sm font-bold text-white hover:bg-[#3A7A52] disabled:opacity-50"
              >
                {isPending ? "처리 중..." : "지급 완료 기록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
