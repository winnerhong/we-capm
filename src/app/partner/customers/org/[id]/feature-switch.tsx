"use client";

// 기능 하나의 온오프 스위치.
//
// 낙관적으로 먼저 움직인다 — 스위치는 누르면 즉시 반응해야 눌린 줄 안다.
// 실패하면 되돌리고 이유를 옆에 적는다(조용히 되돌아가면 "안 눌렸나?" 가 된다).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrgFeatureAction } from "./feature-actions";

export function FeatureSwitch({
  orgId,
  code,
  name,
  icon,
  desc,
  enabled,
  /** 지사가 이 기능을 보유하지 않음 — 켤 수 없다. */
  disabledReason,
}: {
  orgId: string;
  code: string;
  name: string;
  icon: string;
  desc: string | null;
  enabled: boolean;
  disabledReason: string | null;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const locked = disabledReason !== null;

  function toggle() {
    if (locked || pending) return;
    const next = !on;
    setErr(null);
    setOn(next);
    startTransition(async () => {
      const r = await setOrgFeatureAction(orgId, code, next);
      if (!r.ok) {
        setOn(!next);
        setErr(r.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
        locked
          ? "border-dashed border-[#E5DDD0] bg-[#FAF8F5]"
          : on
            ? "border-[#D4E4BC] bg-white"
            : "border-[#E8DDC8] bg-[#FDFBF6]"
      }`}
    >
      <span
        className={`text-2xl leading-none ${on && !locked ? "" : "opacity-40 grayscale"}`}
        aria-hidden
      >
        {icon}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-bold ${
            on && !locked ? "text-[#2D5A3D]" : "text-[#8B7F75]"
          }`}
        >
          {name}
        </p>
        {desc && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-[#8B7F75]">{desc}</p>
        )}
        {locked && (
          <p className="mt-1 text-[11px] font-semibold text-[#B5651D]">
            🔒 {disabledReason}
          </p>
        )}
        {err && (
          <p className="mt-1 text-[11px] font-semibold text-rose-600">⚠ {err}</p>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${name} ${on ? "끄기" : "켜기"}`}
        onClick={toggle}
        disabled={locked || pending}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          locked
            ? "cursor-not-allowed bg-[#E5DDD0]"
            : on
              ? "bg-[#2D5A3D]"
              : "bg-[#D8D0C4]"
        } ${pending ? "opacity-60" : ""}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
            on ? "left-6" : "left-1"
          }`}
        />
      </button>
    </li>
  );
}
