"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFmSessionAction } from "@/lib/missions/review-actions";

type Props = {
  orgId: string;
};

export function CreateSessionForm({ orgId }: Props) {
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
        className="rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2 text-sm font-bold text-white shadow-md transition hover:from-[#234a30] hover:to-[#2D5A3D]"
      >
        + 새 방송 세션 만들기
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
    >
      <div>
        <label
          htmlFor="fm_name"
          className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
        >
          세션 이름 <span className="text-rose-600">*</span>
        </label>
        <input
          id="fm_name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예) 점심 라디오"
          autoComplete="off"
          required
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label
            htmlFor="fm_start"
            className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
          >
            시작 일시 <span className="text-rose-600">*</span>
          </label>
          <input
            id="fm_start"
            type="datetime-local"
            value={scheduledStart}
            onChange={(e) => setScheduledStart(e.target.value)}
            required
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>
        <div>
          <label
            htmlFor="fm_end"
            className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
          >
            종료 일시 <span className="text-rose-600">*</span>
          </label>
          <input
            id="fm_end"
            type="datetime-local"
            value={scheduledEnd}
            onChange={(e) => setScheduledEnd(e.target.value)}
            required
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>
      </div>
      {msg && (
        <p className="text-xs font-semibold text-rose-700" role="alert">
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
          className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#2D5A3D]"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2 text-xs font-bold text-white shadow-md transition hover:from-[#234a30] hover:to-[#2D5A3D] disabled:opacity-50"
        >
          💾 생성
        </button>
      </div>
    </form>
  );
}
