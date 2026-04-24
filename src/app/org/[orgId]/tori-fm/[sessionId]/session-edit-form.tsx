"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFmSessionAction } from "@/lib/missions/review-actions";

type Props = {
  sessionId: string;
  initialName: string;
  initialStart: string;
  initialEnd: string;
  isLive: boolean;
};

const INPUT_CLASS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30 disabled:cursor-not-allowed disabled:bg-[#F5F1E8] disabled:text-[#8B7F75]";

/** ISO (UTC) → datetime-local input value "YYYY-MM-DDTHH:mm" (local time) */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${dd}T${hh}:${mm}`;
  } catch {
    return "";
  }
}

export function SessionEditForm({
  sessionId,
  initialName,
  initialStart,
  initialEnd,
  isLive,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialName);
  const [scheduledStart, setScheduledStart] = useState(toLocalInput(initialStart));
  const [scheduledEnd, setScheduledEnd] = useState(toLocalInput(initialEnd));
  const [msg, setMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const disabled = isLive || isPending;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setOkMsg(null);

    if (isLive) {
      setMsg("LIVE 중에는 수정할 수 없어요. 먼저 방송을 종료하세요.");
      return;
    }
    if (!name.trim()) {
      setMsg("세션 이름을 입력해 주세요");
      return;
    }
    if (!scheduledStart || !scheduledEnd) {
      setMsg("시작·종료 일시를 모두 입력해 주세요");
      return;
    }

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("scheduled_start", scheduledStart);
    fd.set("scheduled_end", scheduledEnd);

    startTransition(async () => {
      try {
        await updateFmSessionAction(sessionId, fd);
        setOkMsg("저장됐어요");
        router.refresh();
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "저장에 실패했어요");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
        <span aria-hidden>📝</span>
        <span>세션 정보</span>
      </h2>

      {isLive && (
        <div
          role="status"
          className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3"
        >
          <p className="text-xs font-bold text-rose-800">
            🔴 LIVE 중에는 수정할 수 없어요.
          </p>
          <p className="mt-0.5 text-[11px] text-rose-700">
            먼저 방송을 종료한 뒤에 일정을 바꿔 주세요.
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="fm_edit_name"
            className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
          >
            세션 이름 <span className="text-rose-600">*</span>
          </label>
          <input
            id="fm_edit_name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 점심 라디오"
            autoComplete="off"
            required
            disabled={disabled}
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label
              htmlFor="fm_edit_start"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              시작 일시 <span className="text-rose-600">*</span>
            </label>
            <input
              id="fm_edit_start"
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
              required
              disabled={disabled}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label
              htmlFor="fm_edit_end"
              className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
            >
              종료 일시 <span className="text-rose-600">*</span>
            </label>
            <input
              id="fm_edit_end"
              type="datetime-local"
              value={scheduledEnd}
              onChange={(e) => setScheduledEnd(e.target.value)}
              required
              disabled={disabled}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {msg && (
          <p className="text-xs font-semibold text-rose-700" role="alert">
            {msg}
          </p>
        )}
        {okMsg && (
          <p className="text-xs font-semibold text-emerald-700" role="status">
            {okMsg}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={disabled}
            className="rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2 text-xs font-bold text-white shadow-md transition hover:from-[#234a30] hover:to-[#2D5A3D] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "저장 중…" : "💾 저장하기"}
          </button>
        </div>
      </form>
    </section>
  );
}
