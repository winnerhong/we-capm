"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

const CHECKLIST = [
  "모은 도토리가 모두 사라집니다",
  "획득한 보상을 더 이상 수령할 수 없습니다",
  "참여 이력이 사라집니다",
  "이 정보는 복구할 수 없습니다",
];

const REASONS = [
  { value: "", label: "선택 안 함" },
  { value: "SERVICE", label: "서비스 불만" },
  { value: "PRIVACY", label: "개인정보 우려" },
  { value: "NOT_USING", label: "잘 사용하지 않음" },
  { value: "OTHER", label: "기타" },
];

export function WithdrawForm({
  eventId,
  participantName,
  action,
}: {
  eventId: string;
  participantName: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [checks, setChecks] = useState<boolean[]>(
    CHECKLIST.map(() => false)
  );
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allChecked = checks.every(Boolean);
  const confirmOk = confirm === "탈퇴합니다";
  const canSubmit = allChecked && confirmOk && !pending;

  const buttonLabel = useMemo(() => {
    if (pending) return "탈퇴 처리 중...";
    if (!allChecked) return "모든 항목을 확인해 주세요";
    if (!confirmOk) return '확인 문구를 입력해 주세요';
    return "탈퇴하기";
  }, [pending, allChecked, confirmOk]);

  function toggleCheck(i: number) {
    setChecks((prev) => prev.map((c, idx) => (idx === i ? !c : c)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    const formData = new FormData();
    formData.set("confirm", confirm);
    if (reason) formData.set("reason", reason);
    if (reasonDetail) formData.set("reason_detail", reasonDetail);
    startTransition(async () => {
      try {
        await action(formData);
      } catch (err) {
        // redirect()는 예외를 던지지만 Next가 처리함. 그 외 오류만 표시.
        const msg = err instanceof Error ? err.message : "탈퇴 처리에 실패했어요";
        if (msg.includes("NEXT_REDIRECT")) return;
        setError(msg);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5 shadow-sm"
    >
      <div>
        <p className="text-sm text-[#2C2C2C]">
          <b>{participantName}</b>님, 정말 탈퇴하시겠어요?
        </p>
        <p className="mt-1 text-xs text-[#6B6560]">
          아래 내용을 모두 확인하시면 탈퇴를 진행할 수 있어요.
        </p>
      </div>

      {/* Checklist */}
      <ul className="space-y-2">
        {CHECKLIST.map((text, i) => (
          <li key={text}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 hover:bg-rose-100">
              <input
                type="checkbox"
                checked={checks[i]}
                onChange={() => toggleCheck(i)}
                className="mt-0.5 h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                aria-describedby={`check-${i}-desc`}
              />
              <span id={`check-${i}-desc`} className="text-sm text-rose-900">
                {text}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {/* Reason */}
      <div>
        <label
          htmlFor="reason"
          className="mb-1 block text-xs font-semibold text-[#6B6560]"
        >
          탈퇴 사유 (선택)
        </label>
        <select
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="reason_detail"
          className="mb-1 block text-xs font-semibold text-[#6B6560]"
        >
          남기고 싶은 말 (선택)
        </label>
        <textarea
          id="reason_detail"
          value={reasonDetail}
          onChange={(e) => setReasonDetail(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="더 나은 토리로를 만드는 데 도움이 돼요"
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
        />
        <p className="mt-1 text-[11px] text-[#8B7F75]">
          {reasonDetail.length} / 500
        </p>
      </div>

      {/* Confirm phrase */}
      <div>
        <label
          htmlFor="confirm"
          className="mb-1 block text-xs font-semibold text-rose-700"
        >
          확인을 위해 <b>&quot;탈퇴합니다&quot;</b>라고 입력해 주세요
        </label>
        <input
          id="confirm"
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          required
          className="w-full rounded-xl border border-rose-300 bg-white px-3 py-2.5 text-sm text-rose-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400/30"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-100 px-3 py-2 text-xs text-rose-800"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2 pt-1 md:flex-row-reverse">
        <button
          type="submit"
          disabled={!canSubmit}
          aria-disabled={!canSubmit}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 disabled:cursor-not-allowed disabled:bg-rose-300 md:w-auto"
        >
          {buttonLabel}
        </button>
        <Link
          href={`/event/${eventId}/my`}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-4 py-3 text-sm font-semibold text-[#6B6560] hover:bg-[#F0EBE3] md:w-auto"
        >
          취소
        </Link>
      </div>
    </form>
  );
}
