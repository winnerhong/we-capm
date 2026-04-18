"use client";

import { useState } from "react";

const PORTALS = [
  { label: "👨‍💼 관리자포털", href: "/api/dev-login?role=admin", color: "bg-violet-600 hover:bg-violet-700" },
  { label: "🏢 기관포털", href: "/api/dev-login?role=manager", color: "bg-blue-600 hover:bg-blue-700" },
  { label: "👨‍👩‍👧 이용자포털", href: "/api/dev-login?role=participant", color: "bg-green-600 hover:bg-green-700" },
];

export function DevNav() {
  const [open, setOpen] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    if (!confirm("테스트 데이터를 초기화하고 새로 넣을까요?")) return;
    setSeeding(true);
    try {
      const res = await fetch("/api/dev-seed");
      const data = await res.json();
      alert(data.log?.join("\n") ?? "완료!");
      window.location.reload();
    } catch {
      alert("시드 실패");
    }
    setSeeding(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="fixed top-1 left-1 z-[9999] rounded bg-black/70 px-2 py-0.5 text-[10px] text-white hover:bg-black">
        DEV
      </button>
    );
  }

  return (
    <div className="sticky top-0 z-[9999] flex items-center gap-2 bg-neutral-900 px-3 py-1.5 text-xs text-white overflow-x-auto">
      <span className="rounded bg-yellow-500 px-1.5 py-0.5 text-[10px] font-bold text-black">DEV</span>
      <div className="h-4 w-px bg-neutral-600" />
      {PORTALS.map((p) => (
        <a key={p.href} href={p.href}
          className={`whitespace-nowrap rounded px-2.5 py-1 font-semibold text-white transition-colors ${p.color}`}>
          {p.label}
        </a>
      ))}
      <div className="h-4 w-px bg-neutral-600" />
      <button onClick={handleSeed} disabled={seeding}
        className="whitespace-nowrap rounded bg-orange-600 px-2.5 py-1 font-semibold hover:bg-orange-700 disabled:opacity-50">
        {seeding ? "⏳ 시드 중..." : "🌱 테스트 데이터"}
      </button>
      <button onClick={() => setOpen(false)}
        className="ml-auto rounded px-1.5 py-0.5 hover:bg-white/20 text-neutral-400">✕</button>
    </div>
  );
}
