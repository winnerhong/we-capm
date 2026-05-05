"use client";

// 접기/펼치기 가능한 섹션 래퍼 — 서버 컴포넌트 form 안에서도 사용 가능.
// 헤더 전체 클릭으로 토글, 우측 chevron 회전.
//
// 핵심: 접혔을 때도 children 은 DOM 에 남겨 두고 display:none 으로만 숨김
//       → form input 들이 그대로 FormData 로 전송됨 (값 손실 방지).

import { useState } from "react";

export function CollapsibleSection({
  icon,
  title,
  hint,
  badge,
  defaultOpen = true,
  children,
}: {
  icon: string;
  title: string;
  hint?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left text-sm font-bold text-[#2D5A3D] transition hover:opacity-80"
      >
        <span aria-hidden>{icon}</span>
        <span>{title}</span>
        {hint && (
          <span className="text-[10px] font-normal text-[#8B7F75]">
            {hint}
          </span>
        )}
        {badge && (
          <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D]">
            {badge}
          </span>
        )}
        <span
          aria-hidden
          className={`ml-auto text-[#6B6560] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>
      {/* 접혔을 때도 input 들은 살려둠 (FormData 전송 보장) */}
      <div className={open ? "mt-4" : "hidden"}>{children}</div>
    </section>
  );
}
