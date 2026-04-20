"use client";

import { useMemo, useState, useTransition } from "react";
import { bulkCreateParentInvoicesAction, remindUnpaidParentsAction } from "../actions";

type Row = {
  id: string;
  name: string;
  phone: string | null;
  invoice: {
    target_id: string;
    amount: number;
    total_amount: number;
    status: string;
    invoice_number: string;
    payment_link_token: string | null;
  } | null;
};

function maskPhone(phone: string | null): string {
  if (!phone) return "-";
  // 010-1234-5678 → 010-****-5678
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 8) return phone;
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  }
  return phone.replace(/(\d{3,4})(?=\d{4})/, "****");
}

function statusBadge(status: string | undefined) {
  switch (status) {
    case "CONFIRMED":
    case "PAID":
      return { label: "결제완료", cls: "bg-emerald-100 text-emerald-800" };
    case "PENDING":
      return { label: "미납", cls: "bg-amber-100 text-amber-800" };
    case "EXPIRED":
      return { label: "만료", cls: "bg-neutral-100 text-neutral-500" };
    case "CANCELED":
      return { label: "취소", cls: "bg-neutral-100 text-neutral-500" };
    default:
      return { label: "미발급", cls: "bg-neutral-100 text-neutral-600" };
  }
}

export function ParentBillingPanel({
  eventId,
  eventName,
  rows,
  unpaidCount,
  notBilledCount,
}: {
  eventId: string;
  eventName: string;
  rows: Row[];
  unpaidCount: number;
  notBilledCount: number;
}) {
  const [amount, setAmount] = useState<string>("30000");
  const [desc, setDesc] = useState<string>(`${eventName} 참가비`);
  const [bulkPending, startBulk] = useTransition();
  const [remindPending, startRemind] = useTransition();
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null,
  );

  const csvUrl = useMemo(() => {
    const header = "이름,전화번호,청구번호,금액,상태";
    const body = rows
      .map((r) => {
        const status = statusBadge(r.invoice?.status).label;
        return [
          `"${r.name.replace(/"/g, '""')}"`,
          r.phone ?? "",
          r.invoice?.invoice_number ?? "",
          r.invoice?.total_amount ?? "",
          status,
        ].join(",");
      })
      .join("\n");
    const csv = `${header}\n${body}`;
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    return URL.createObjectURL(blob);
  }, [rows]);

  function handleBulk(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 1000) {
      setNotice({ kind: "err", msg: "1,000원 이상으로 입력해주세요" });
      return;
    }
    const ok = confirm(
      `미발급 ${notBilledCount}명에게 ${amt.toLocaleString("ko-KR")}원 청구서를 발급할까요?`,
    );
    if (!ok) return;
    startBulk(async () => {
      try {
        const res = await bulkCreateParentInvoicesAction(eventId, amt, desc);
        if (res.ok) {
          setNotice({
            kind: "ok",
            msg: `${res.created ?? 0}건 발급, ${res.skipped ?? 0}건 건너뜀`,
          });
        } else {
          setNotice({ kind: "err", msg: res.message ?? "실패" });
        }
      } catch (err) {
        setNotice({
          kind: "err",
          msg: err instanceof Error ? err.message : "오류",
        });
      }
    });
  }

  function handleRemind() {
    if (unpaidCount === 0) {
      setNotice({ kind: "err", msg: "독촉할 미납자가 없습니다" });
      return;
    }
    const ok = confirm(`미납 ${unpaidCount}명에게 결제 링크를 재발송할까요?`);
    if (!ok) return;
    startRemind(async () => {
      try {
        const res = await remindUnpaidParentsAction(eventId);
        if (res.ok) {
          setNotice({ kind: "ok", msg: `${res.reminded ?? 0}명 독촉 처리` });
        } else {
          setNotice({ kind: "err", msg: res.message ?? "실패" });
        }
      } catch (err) {
        setNotice({
          kind: "err",
          msg: err instanceof Error ? err.message : "오류",
        });
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Bulk Actions */}
      <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold text-blue-800">
          <span aria-hidden>📨</span>
          <span>일괄 청구서 발행</span>
        </h2>
        <p className="mt-1 text-xs text-[#6B6560]">
          미발급된 {notBilledCount}명에게 청구서를 만들고 결제 링크를 자동 발송해요
        </p>
        <form
          onSubmit={handleBulk}
          className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_auto]"
        >
          <div>
            <label
              htmlFor="parent-amount"
              className="block text-[11px] font-semibold text-[#2C2C2C]"
            >
              인당 금액
            </label>
            <input
              id="parent-amount"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="30000"
              className="mt-1 w-full rounded-lg border border-blue-100 bg-white p-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label
              htmlFor="parent-desc"
              className="block text-[11px] font-semibold text-[#2C2C2C]"
            >
              청구서 항목
            </label>
            <input
              id="parent-desc"
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={100}
              className="mt-1 w-full rounded-lg border border-blue-100 bg-white p-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={bulkPending || notBilledCount === 0}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {bulkPending ? "발행 중..." : `${notBilledCount}명 발급`}
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRemind}
            disabled={remindPending || unpaidCount === 0}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {remindPending ? "발송 중..." : `📣 미납자 ${unpaidCount}명 일괄 독촉`}
          </button>
          <a
            href={csvUrl}
            download={`참가자_결제현황_${eventName}.csv`}
            className="rounded-lg border border-blue-200 bg-white px-4 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            📊 CSV 다운로드
          </a>
        </div>

        {notice && (
          <div
            role="status"
            className={`mt-3 rounded-lg p-2 text-xs ${
              notice.kind === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {notice.msg}
          </div>
        )}
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-blue-50 text-blue-800">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">이름</th>
                <th className="px-3 py-2 text-left font-semibold">전화번호</th>
                <th className="px-3 py-2 text-left font-semibold">청구번호</th>
                <th className="px-3 py-2 text-right font-semibold">금액</th>
                <th className="px-3 py-2 text-center font-semibold">상태</th>
                <th className="px-3 py-2 text-right font-semibold">결제</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-sm text-[#6B6560]"
                  >
                    등록된 가족이 없습니다
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const b = statusBadge(r.invoice?.status);
                  return (
                    <tr key={r.id} className="border-t border-blue-50">
                      <td className="px-3 py-2 font-semibold text-[#2C2C2C]">{r.name}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[#6B6560]">
                        {maskPhone(r.phone)}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[#6B6560]">
                        {r.invoice?.invoice_number ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.invoice ? `${r.invoice.total_amount.toLocaleString("ko-KR")}원` : "-"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${b.cls}`}>
                          {b.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.invoice && r.invoice.status === "PENDING" && r.invoice.payment_link_token ? (
                          <a
                            href={`/pay/${r.invoice.payment_link_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            링크
                          </a>
                        ) : (
                          <span className="text-[11px] text-[#6B6560]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] text-[#6B6560]">
        * 전화번호는 보안을 위해 가운데 4자리가 마스킹됩니다.
        실제 결제 링크는 SMS/이메일로 발송됩니다.
      </p>
    </div>
  );
}
