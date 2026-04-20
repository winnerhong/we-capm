"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WinnerTalkIcon } from "@/components/winner-talk-icon";

interface NavItem {
  label: string;
  href: string;
  badge?: string;
  icon?: string;
}

interface NavGroup {
  label: string;
  icon: string;
  items: NavItem[];
  match: string[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "행사",
    icon: "🌲",
    match: ["/admin/events", "/admin/challenges", "/admin/esg"],
    items: [
      { label: "행사 목록", href: "/admin/events", icon: "📋" },
      { label: "새 행사", href: "/admin/events/new", icon: "➕" },
      { label: "챌린지 관리", href: "/admin/challenges", icon: "🎯" },
      { label: "ESG 리포트", href: "/admin/esg", icon: "🌱" },
    ],
  },
  {
    label: "지사",
    icon: "🏡",
    match: ["/admin/partners", "/admin/acorns"],
    items: [
      { label: "숲지기 관리", href: "/admin/partners", icon: "🏡" },
      { label: "새 지사 등록", href: "/admin/partners/new", icon: "➕" },
      { label: "도토리 충전", href: "/admin/acorns", icon: "🌰" },
    ],
  },
  {
    label: "재무",
    icon: "💰",
    match: ["/admin/finance", "/admin/settlements", "/admin/invoices"],
    items: [
      { label: "재무 대시보드", href: "/admin/finance", icon: "📊" },
      { label: "정산 관리", href: "/admin/settlements", icon: "💸" },
      { label: "세금계산서", href: "/admin/invoices", icon: "🧾" },
      { label: "환불 처리", href: "/admin/finance#refunds", icon: "↩️" },
    ],
  },
  {
    label: "마케팅",
    icon: "🧚",
    match: ["/admin/ads", "/admin/b2b", "/admin/notifications"],
    items: [
      { label: "광고 관리", href: "/admin/ads", icon: "📣" },
      { label: "B2B 기업 문의", href: "/admin/b2b", icon: "💼" },
      { label: "알림 발송", href: "/admin/notifications", icon: "📨" },
    ],
  },
  {
    label: "분석",
    icon: "📊",
    match: ["/admin/stats", "/admin/audit-logs"],
    items: [
      { label: "전체 통계", href: "/admin/stats", icon: "📊" },
      { label: "접근 기록", href: "/admin/audit-logs", icon: "📋" },
    ],
  },
];

interface Props {
  isAdmin: boolean;
  displayName: string;
  managerEventId?: string;
}

export function AdminNav({ isAdmin, displayName, managerEventId }: Props) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on route change
  useEffect(() => {
    setOpenDropdown(null);
    setMobileOpen(false);
  }, [pathname]);

  if (!isAdmin) {
    return (
      <header className="border-b border-[#D4E4BC] bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
          <Link href={`/manager/${managerEventId}`} className="flex items-center gap-2 font-bold text-[#2D5A3D]">
            <span className="text-xl">🏢</span>
            <span>{displayName}</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-semibold">기관</span>
            <form action="/api/auth/manager-logout" method="post">
              <button className="rounded-lg border border-[#D4E4BC] px-3 py-1 text-xs text-[#6B6560] hover:bg-[#FFF8F0]">로그아웃</button>
            </form>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#D4E4BC] bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2" ref={navRef}>
        {/* 로고 + 네비 */}
        <div className="flex items-center gap-4 lg:gap-6">
          <Link href="/admin" className="flex items-center gap-2 font-bold text-[#2D5A3D] flex-shrink-0">
            <span className="text-xl">🌰</span>
            <span className="hidden sm:inline">토리로</span>
          </Link>

          {/* 데스크탑 네비 */}
          <nav className="hidden lg:flex items-center gap-1 text-sm">
            {NAV_GROUPS.map((group) => {
              const isActive = group.match.some((m) => pathname.startsWith(m));
              const isOpen = openDropdown === group.label;
              return (
                <div key={group.label} className="relative">
                  <button
                    onClick={() => setOpenDropdown(isOpen ? null : group.label)}
                    className={`flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors
                      ${isActive ? "bg-[#E8F0E4] text-[#2D5A3D] font-semibold" : "text-[#2C2C2C] hover:bg-[#F5F1E8]"}`}
                    aria-expanded={isOpen}
                  >
                    <span>{group.icon}</span>
                    <span>{group.label}</span>
                    <span className={`text-[10px] transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
                  </button>

                  {isOpen && (
                    <div className="absolute top-full left-0 mt-1 min-w-[200px] rounded-xl border border-[#D4E4BC] bg-white shadow-lg overflow-hidden">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpenDropdown(null)}
                          className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors
                            ${pathname === item.href ? "bg-[#E8F0E4] text-[#2D5A3D] font-semibold" : "text-[#2C2C2C] hover:bg-[#FFF8F0]"}`}
                        >
                          {item.icon && <span>{item.icon}</span>}
                          <span>{item.label}</span>
                          {item.badge && (
                            <span className="ml-auto rounded-full bg-red-500 text-white text-[10px] px-1.5 py-0.5 font-bold">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 직접 링크: 토리톡 */}
            <Link
              href="/admin/chat"
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors
                ${pathname.startsWith("/admin/chat") ? "bg-[#E8F0E4] text-[#2D5A3D] font-semibold" : "text-[#2C2C2C] hover:bg-[#F5F1E8]"}`}
            >
              <WinnerTalkIcon size={16} />
              <span>토리톡</span>
            </Link>
          </nav>

          {/* 모바일 햄버거 */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden rounded-lg p-2 hover:bg-[#E8F0E4]"
            aria-label="메뉴 열기"
          >
            <span className="text-lg">☰</span>
          </button>
        </div>

        {/* 우측: 알림 + 로그아웃 */}
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden sm:inline rounded-full bg-[#E8F0E4] text-[#2D5A3D] px-3 py-1 text-xs font-semibold">
            관리자
          </span>
          <form action="/api/auth/admin-logout" method="post">
            <button className="rounded-lg border border-[#D4E4BC] px-3 py-1 text-xs text-[#6B6560] hover:bg-[#FFF8F0]">
              로그아웃
            </button>
          </form>
        </div>
      </div>

      {/* 모바일 드로어 */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#D4E4BC] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-2 space-y-1">
            {NAV_GROUPS.map((group) => (
              <details key={group.label} className="group">
                <summary className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-[#F5F1E8] cursor-pointer text-sm font-semibold text-[#2C2C2C]">
                  <span>{group.icon}</span>
                  <span>{group.label}</span>
                  <span className="ml-auto text-[10px] text-[#6B6560] group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="pl-8 space-y-0.5">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm
                        ${pathname === item.href ? "bg-[#E8F0E4] text-[#2D5A3D] font-semibold" : "text-[#2C2C2C] hover:bg-[#FFF8F0]"}`}
                    >
                      {item.icon && <span>{item.icon}</span>}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </details>
            ))}
            <Link
              href="/admin/chat"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#2C2C2C] hover:bg-[#F5F1E8]"
            >
              <WinnerTalkIcon size={16} />
              <span>토리톡</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
