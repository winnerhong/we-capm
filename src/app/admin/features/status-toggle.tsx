"use client";

import { useState, useTransition } from "react";
import {
  FEATURE_STATUS_META,
  FEATURE_STATUSES,
  type FeatureStatus,
} from "@/lib/features/types";
import { setFeatureStatusAction } from "./actions";

export function StatusToggle({
  code,
  current,
}: {
  code: string;
  current: FeatureStatus;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const meta = FEATURE_STATUS_META[current];

  const onPick = (next: FeatureStatus) => {
    setOpen(false);
    if (next === current) return;
    start(async () => {
      const res = await setFeatureStatusAction(code, next);
      if (!res.ok) alert(res.message);
    });
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.bg} ${meta.text}`}
      >
        <span>{meta.label}</span>
        <span aria-hidden className="text-[9px] opacity-60">
          ▼
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-32 overflow-hidden rounded-xl border border-[#D4E4BC] bg-white text-left shadow-lg">
          {FEATURE_STATUSES.map((s) => {
            const sm = FEATURE_STATUS_META[s];
            const active = s === current;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onPick(s)}
                className={`block w-full px-3 py-1.5 text-left text-xs transition ${
                  active
                    ? "bg-[#FFF8F0] font-bold text-[#2D5A3D]"
                    : "text-[#2C2C2C] hover:bg-[#FFF8F0]"
                }`}
              >
                <span className={sm.text}>{sm.label}</span>
                {active && <span className="ml-2">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
