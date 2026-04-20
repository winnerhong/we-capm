"use client";

import { useState, useTransition } from "react";
import {
  deleteInquiryAction,
  updateInquiryAssigneeAction,
  updateInquiryStatusAction,
} from "@/app/enterprise/actions";

type Status = "NEW" | "CONTACTED" | "PROPOSED" | "WON" | "LOST";

export function InquiryRowActions({
  id,
  status,
  assignedTo,
  companyName,
}: {
  id: string;
  status: Status;
  assignedTo: string | null;
  companyName: string;
}) {
  const [pending, start] = useTransition();
  const [assignee, setAssignee] = useState(assignedTo ?? "");

  const onStatus = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (next === status) return;
    start(async () => {
      try {
        await updateInquiryStatusAction(id, next);
      } catch (err) {
        alert(err instanceof Error ? err.message : "상태 변경 실패");
      }
    });
  };

  const onAssigneeBlur = () => {
    if ((assignedTo ?? "") === assignee) return;
    start(async () => {
      try {
        await updateInquiryAssigneeAction(id, assignee);
      } catch (err) {
        alert(err instanceof Error ? err.message : "담당자 변경 실패");
      }
    });
  };

  const onDelete = () => {
    if (!confirm(`정말로 "${companyName}"의 문의를 삭제할까요? 되돌릴 수 없어요.`)) return;
    start(async () => {
      try {
        await deleteInquiryAction(id);
      } catch (err) {
        alert(err instanceof Error ? err.message : "삭제 실패");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={status}
        onChange={onStatus}
        disabled={pending}
        aria-label="상태 변경"
        className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-xs text-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
      >
        <option value="NEW">🆕 신규</option>
        <option value="CONTACTED">📞 상담중</option>
        <option value="PROPOSED">📄 제안완료</option>
        <option value="WON">🎉 계약성사</option>
        <option value="LOST">❌ 무산</option>
      </select>

      <input
        type="text"
        value={assignee}
        onChange={(e) => setAssignee(e.target.value)}
        onBlur={onAssigneeBlur}
        disabled={pending}
        placeholder="담당자"
        aria-label="담당자"
        className="w-24 rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-xs text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
      />

      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        삭제
      </button>
    </div>
  );
}
