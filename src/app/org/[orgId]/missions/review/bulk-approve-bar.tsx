"use client";

// 검토 대기 목록 위의 「전부 승인」 막대.
//
// 왜 필요한가: 행사 당일 사진 미션 하나에 스무 집이 몰린다. 한 건씩 누르면
// 스무 번이고, 누르는 사이에도 계속 들어온다. 실제로 24건이 쌓인 채
// "검수 확정이 안 된다" 는 말이 나왔다 — 안 되는 게 아니라 감당이 안 됐다.
//
// 왜 체크박스가 아닌가: 고르는 화면을 만들면 스무 개를 또 스무 번 눌러야 한다.
// 이 화면은 이미 카드로 사진을 다 보여주고 있으니, 훑어 내린 뒤 한 번 누르는
// 것이 실제 동선이다. 대신 **되돌릴 수 없다는 것**과 몇 건인지를 누르기 전에
// 분명히 말한다.
//
// 탭 필터로 범위를 좁힐 수 있다 — 지금 화면에 보이는 것만 승인한다.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveSubmissionsBulkAction } from "@/lib/missions/review-actions";

type Props = {
  /** 지금 화면에 떠 있는 대기 건들. 이 목록만 승인한다. */
  submissionIds: string[];
  /** 전부 승인했을 때 나갈 도토리 합계 — 되돌릴 수 없는 값이라 미리 말한다. */
  totalAcorns: number;
};

export function BulkApproveBar({ submissionIds, totalAcorns }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const count = submissionIds.length;

  if (count === 0) return null;

  function onApproveAll(): void {
    if (pending) return;
    const ok = window.confirm(
      `지금 목록의 ${count}건을 모두 승인할까요?\n\n` +
        `· 도토리 약 ${totalAcorns}개가 지급돼요 (개인 상한이 걸리면 줄어들 수 있어요)\n` +
        `· 참가자에게 승인 알림이 나가요\n\n` +
        `되돌리려면 한 건씩 반려해야 해요.`
    );
    if (!ok) return;

    setMsg(null);
    startTransition(async () => {
      try {
        const r = await approveSubmissionsBulkAction(submissionIds);
        const parts = [`✅ ${r.approved}건 승인`];
        if (r.alreadyDone > 0) parts.push(`이미 승인됨 ${r.alreadyDone}건`);
        if (r.failed > 0) {
          parts.push(`실패 ${r.failed}건${r.firstError ? ` — ${r.firstError}` : ""}`);
        }
        setMsg(parts.join(" · "));
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "일괄 승인에 실패했어요");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs text-[#6B6560]">
          <b className="font-bold text-[#2D5A3D]">{count}건</b>이 검토를
          기다리고 있어요 · 도토리 약{" "}
          <b className="font-bold text-[#6B4423]">{totalAcorns}개</b>
        </p>
        <button
          type="button"
          onClick={onApproveAll}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <span aria-hidden>✅</span>
          <span>{pending ? "승인 중…" : `${count}건 전부 승인`}</span>
        </button>
      </div>

      {msg && (
        <p
          role="status"
          className="mt-2 rounded-lg border border-[#D4E4BC] bg-[#F5F1E8] px-3 py-2 text-[11px] font-semibold text-[#2D5A3D]"
        >
          {msg}
        </p>
      )}
    </section>
  );
}
