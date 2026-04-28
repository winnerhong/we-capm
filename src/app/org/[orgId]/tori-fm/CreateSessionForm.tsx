"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFmSessionAction } from "@/lib/missions/review-actions";

type Props = {
  orgId: string;
  /** 있으면 새 세션이 이 행사에 자동 연결됩니다. */
  eventId?: string;
};

export function CreateSessionForm({ orgId, eventId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setMsg("세션 이름을 입력해 주세요");
      return;
    }
    if (!scheduledStart || !scheduledEnd) {
      setMsg("시작·종료 일시를 모두 입력해 주세요");
      return;
    }
    setMsg(null);
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("scheduled_start", scheduledStart);
    fd.set("scheduled_end", scheduledEnd);
    if (eventId) fd.set("event_id", eventId);

    startTransition(async () => {
      try {
        await createFmSessionAction(orgId, fd);
        setOpen(false);
        setName("");
        setScheduledStart("");
        setScheduledEnd("");
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "세션 생성 실패");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-[#1B2B3A] shadow-md shadow-amber-400/30 transition hover:bg-amber-300"
      >
        + 새 방송 세션 만들기
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-2xl border border-white/10 bg-gradient-to-br from-[#1B2B3A] via-[#26394C] to-[#1B2B3A] p-4 text-white shadow-xl"
    >
      <div>
        <label
          htmlFor="fm_name"
          className="mb-1 block text-xs font-semibold text-amber-200/80"
        >
          세션 이름 <span className="text-rose-300">*</span>
        </label>
        <input
          id="fm_name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예) 점심 라디오"
          autoComplete="off"
          required
          className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/30"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label
            htmlFor="fm_start"
            className="mb-1 block text-xs font-semibold text-amber-200/80"
          >
            시작 일시 <span className="text-rose-300">*</span>
          </label>
          <input
            id="fm_start"
            type="datetime-local"
            value={scheduledStart}
            onChange={(e) => setScheduledStart(e.target.value)}
            required
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/30 [color-scheme:dark]"
          />
        </div>
        <div>
          <label
            htmlFor="fm_end"
            className="mb-1 block text-xs font-semibold text-amber-200/80"
          >
            종료 일시 <span className="text-rose-300">*</span>
          </label>
          <input
            id="fm_end"
            type="datetime-local"
            value={scheduledEnd}
            onChange={(e) => setScheduledEnd(e.target.value)}
            required
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/30 [color-scheme:dark]"
          />
        </div>
      </div>
      {msg && (
        <p className="text-xs font-semibold text-rose-300" role="alert">
          {msg}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setMsg(null);
          }}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-[#1B2B3A] shadow-md shadow-amber-400/30 transition hover:bg-amber-300 disabled:opacity-50"
        >
          💾 생성
        </button>
      </div>
    </form>
  );
}
