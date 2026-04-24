"use client";

import { useState, useTransition } from "react";
import {
  sendCampaignAction,
  pauseCampaignAction,
  scheduleCampaignAction,
  deleteCampaignAction,
} from "../actions";

type Props = {
  campaignId: string;
  canSend: boolean;
  canPause: boolean;
};

export function ActionButtons({ campaignId, canSend, canPause }: Props) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  const handleSend = () => {
    if (!confirm("지금 바로 발송할까요? 되돌릴 수 없어요.")) return;
    setErr(null);
    startTransition(async () => {
      try {
        await sendCampaignAction(campaignId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("NEXT_REDIRECT")) setErr(msg);
      }
    });
  };

  const handlePause = () => {
    setErr(null);
    startTransition(async () => {
      try {
        await pauseCampaignAction(campaignId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("NEXT_REDIRECT")) setErr(msg);
      }
    });
  };

  const handleSchedule = () => {
    if (!scheduledAt) {
      setErr("예약 시각을 선택해주세요");
      return;
    }
    setErr(null);
    startTransition(async () => {
      try {
        await scheduleCampaignAction(campaignId, scheduledAt);
        setShowScheduleForm(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("NEXT_REDIRECT")) setErr(msg);
      }
    });
  };

  const handleDelete = () => {
    if (
      !confirm(
        "정말 이 캠페인을 삭제할까요? 발송 기록도 함께 삭제되며 되돌릴 수 없어요."
      )
    )
      return;
    setErr(null);
    startTransition(async () => {
      try {
        await deleteCampaignAction(campaignId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("NEXT_REDIRECT")) setErr(msg);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canSend && (
          <>
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending}
              className="rounded-xl bg-[#2D5A3D] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#4A7C59] disabled:opacity-60"
            >
              {isPending ? "..." : "💌 즉시 발송"}
            </button>
            <button
              type="button"
              onClick={() => setShowScheduleForm((s) => !s)}
              disabled={isPending}
              className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-60"
            >
              📅 예약
            </button>
          </>
        )}
        {canPause && (
          <button
            type="button"
            onClick={handlePause}
            disabled={isPending}
            className="rounded-xl border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
          >
            ⏸ 일시중지
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
        >
          🗑 삭제
        </button>
      </div>

      {showScheduleForm && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#D4E4BC] bg-white p-2">
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-xs focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
            aria-label="예약 시각"
          />
          <button
            type="button"
            onClick={handleSchedule}
            disabled={isPending}
            className="rounded-lg bg-[#2D5A3D] px-2 py-1 text-xs font-bold text-white hover:bg-[#4A7C59] disabled:opacity-60"
          >
            예약하기
          </button>
        </div>
      )}

      {err && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] text-rose-700"
        >
          ⚠️ {err}
        </div>
      )}
    </div>
  );
}
