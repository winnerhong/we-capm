"use client";

import { useState } from "react";

const PORTALS = [
  { label: "👨‍💼 관리자포털", href: "/api/dev-login?role=admin", color: "bg-violet-600 hover:bg-violet-700" },
  { label: "🏢 기관포털", href: "/api/dev-login?role=manager", color: "bg-blue-600 hover:bg-blue-700" },
  { label: "👨‍👩‍👧 이용자포털", href: "/api/dev-login?role=participant", color: "bg-green-600 hover:bg-green-700" },
];

export function DevNav() {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="fixed top-1 left-1 z-[9999] rounded bg-black/70 px-2 py-0.5 text-[10px] text-white hover:bg-black">
        DEV
      </button>
    );
  }

  return (
    <div className="sticky top-0 z-[9999] flex items-center gap-2 bg-neutral-900 px-3 py-1.5 text-xs text-white">
      <span className="rounded bg-yellow-500 px-1.5 py-0.5 text-[10px] font-bold text-black">DEV</span>
      <div className="h-4 w-px bg-neutral-600" />
      {PORTALS.map((p) => (
        <a key={p.href} href={p.href}
          className={`rounded px-2.5 py-1 font-semibold text-white transition-colors ${p.color}`}>
          {p.label}
        </a>
      ))}
      <button onClick={() => setOpen(false)}
        className="ml-auto rounded px-1.5 py-0.5 hover:bg-white/20 text-neutral-400">✕</button>
    </div>
  );
}
