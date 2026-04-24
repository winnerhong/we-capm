"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

interface Portal {
  label: string;
  icon: string;
  href: string;
  matches: string[];
  color: string;
  activeColor: string;
}

const PORTALS: Portal[] = [
  { label: "관리자", icon: "👨‍💼", href: "/api/dev-login?role=admin", matches: ["/admin"], color: "bg-violet-600", activeColor: "bg-violet-500 ring-2 ring-white" },
  { label: "숲지기(지사)", icon: "🏡", href: "/api/dev-login?role=partner", matches: ["/partner"], color: "bg-emerald-600", activeColor: "bg-emerald-500 ring-2 ring-white" },
  { label: "기관", icon: "🏢", href: "/api/dev-login?role=manager", matches: ["/manager", "/org"], color: "bg-blue-600", activeColor: "bg-blue-500 ring-2 ring-white" },
  { label: "참가자", icon: "👨‍👩‍👧", href: "/api/dev-login?role=participant", matches: ["/event", "/trail"], color: "bg-green-600", activeColor: "bg-green-500 ring-2 ring-white" },
  { label: "광고주", icon: "🧚", href: "/ads-portal", matches: ["/ads-portal"], color: "bg-amber-600", activeColor: "bg-amber-500 ring-2 ring-white" },
  { label: "가맹점(지역상점)", icon: "🌳", href: "/store", matches: ["/store"], color: "bg-orange-600", activeColor: "bg-orange-500 ring-2 ring-white" },
];

function matchesPortal(pathname: string, portal: Portal): boolean {
  return portal.matches.some((m) => pathname.startsWith(m));
}

const QUICK_LINKS = [
  { label: "랜딩", icon: "🏠", href: "/" },
  { label: "행사", icon: "🌲", href: "/events" },
  { label: "블로그", icon: "📝", href: "/blog" },
  { label: "FAQ", icon: "❓", href: "/faq" },
  { label: "B2B", icon: "💼", href: "/enterprise" },
];

export function DevNav() {
  const [open, setOpen] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const activePortal = PORTALS.find((p) => matchesPortal(pathname, p));

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
    <div className="sticky top-0 z-[9999] flex items-center gap-1.5 bg-neutral-900 px-3 py-1.5 text-xs text-white overflow-x-auto">
      <span className="rounded bg-yellow-500 px-1.5 py-0.5 text-[10px] font-bold text-black flex-shrink-0">DEV</span>
      {activePortal && (
        <span className="text-[10px] text-neutral-400 flex-shrink-0 whitespace-nowrap">
          {activePortal.icon} {activePortal.label}
        </span>
      )}
      <div className="h-4 w-px bg-neutral-600 flex-shrink-0" />
      {PORTALS.map((p) => {
        const isActive = matchesPortal(pathname, p);
        return (
          <a key={p.href} href={p.href}
            className={`whitespace-nowrap rounded px-2 py-0.5 font-semibold text-white transition-colors flex-shrink-0 ${isActive ? p.activeColor : p.color} hover:brightness-110`}>
            {p.icon} {p.label}
          </a>
        );
      })}
      <div className="h-4 w-px bg-neutral-600 flex-shrink-0" />
      <div className="relative flex-shrink-0">
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="whitespace-nowrap rounded bg-neutral-700 px-2 py-0.5 font-semibold hover:bg-neutral-600">
          🔗 링크
        </button>
        {menuOpen && (
          <div className="absolute top-full left-0 mt-1 rounded-lg bg-neutral-800 border border-neutral-700 shadow-xl p-1 min-w-[120px] z-[10000]">
            {QUICK_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-neutral-700 text-white whitespace-nowrap">
                <span>{l.icon}</span><span>{l.label}</span>
              </a>
            ))}
          </div>
        )}
      </div>
      <button onClick={handleSeed} disabled={seeding}
        className="whitespace-nowrap rounded bg-orange-600 px-2 py-0.5 font-semibold hover:bg-orange-700 disabled:opacity-50 flex-shrink-0">
        {seeding ? "⏳ 시드 중..." : "🌱 테스트 데이터"}
      </button>
      <button onClick={() => setOpen(false)}
        className="ml-auto rounded px-1.5 py-0.5 hover:bg-white/20 text-neutral-400 flex-shrink-0">✕</button>
    </div>
  );
}
