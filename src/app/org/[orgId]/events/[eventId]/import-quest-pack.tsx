"use client";

// 지난 행사에서 스탬프북 가져오기.
//
// 스탬프북·미션을 행사 안에서 관리하게 되면서, 매년 같은 행사를 하는 기관이
// 미션 열 개를 손으로 다시 만들어야 하는 상황이 생겼다. 이 버튼이 그걸 막는다.
//
// 복사한 뒤 **무엇이 달라졌는지 말해준다** — 잠금이 풀린 미션, QR 을 새로 뽑은
// 미션. 조용히 복사하면 "작년 QR 이 왜 안 되지" 를 행사 당일에 알게 된다.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { copyQuestPackToEventAction } from "@/lib/missions/quest-pack-copy-actions";

export type ImportablePack = {
  id: string;
  name: string;
  missionCount: number;
  /** 이 스탬프북이 쓰였던 행사 이름 — "언제 거였지" 에 답한다. */
  usedIn: string | null;
};

export function ImportQuestPack({
  eventId,
  packs,
}: {
  eventId: string;
  packs: ImportablePack[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[] | null>(null);

  if (packs.length === 0) return null;

  function onImport(packId: string) {
    if (pending) return;
    setError(null);
    setNotes(null);
    setBusyId(packId);
    startTransition(async () => {
      const res = await copyQuestPackToEventAction(packId, eventId);
      setBusyId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const lines = [`미션 ${res.missionCount}개를 가져왔어요 (초안 상태)`];
      if (res.reissuedQrTitles.length > 0) {
        lines.push(
          `QR 을 새로 만들었어요 — 예전에 인쇄한 QR 은 못 써요: ${res.reissuedQrTitles.join(", ")}`
        );
      }
      if (res.unlockedTitles.length > 0) {
        lines.push(
          `잠금 조건을 풀었어요 (이어질 미션이 함께 오지 않음): ${res.unlockedTitles.join(", ")}`
        );
      }
      setNotes(lines);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] shadow-sm transition hover:border-[#2D5A3D]"
      >
        <span aria-hidden>📥</span>
        지난 행사에서 가져오기
        <span aria-hidden className={open ? "rotate-180" : ""}>
          ▾
        </span>
      </button>

      {open && (
        <ul className="divide-y divide-[#F0EBE3] overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white">
          {packs.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-2 px-4 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[#2D5A3D]">
                  {p.name}
                </span>
                <span className="block truncate text-[11px] text-[#8B7F75]">
                  미션 {p.missionCount}개
                  {p.usedIn ? ` · ${p.usedIn}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onImport(p.id)}
                disabled={pending}
                className="shrink-0 rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#3A7A52] disabled:opacity-50"
              >
                {busyId === p.id ? "가져오는 중…" : "가져오기"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {notes && (
        <div
          role="status"
          className="space-y-1 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-[11px] leading-relaxed text-emerald-900"
        >
          {notes.map((n, i) => (
            <p key={i} className={i === 0 ? "font-bold" : ""}>
              {i === 0 ? "✅ " : "• "}
              {n}
            </p>
          ))}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800"
        >
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
