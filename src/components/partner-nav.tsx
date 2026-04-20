"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
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
    label: "프로그램",
    icon: "🌲",
    match: ["/partner/programs", "/partner/missions"],
    items: [
      { label: "프로그램 관리", href: "/partner/programs", icon: "🗺️" },
      { label: "➕ 새 프로그램", href: "/partner/programs/new", icon: "➕" },
      { label: "나만의 숲길 (QR·미션)", href: "/partner/missions", icon: "🎨" },
    ],
  },
  {
    label: "고객",
    icon: "👥",
    match: ["/partner/customers", "/partner/b2b", "/partner/b2c"],
    items: [
      { label: "CRM 대시보드", href: "/partner/customers", icon: "🏠" },
      { label: "기관 고객 (B2B2C)", href: "/partner/customers/org", icon: "🏫" },
      { label: "개인 고객 (B2C)", href: "/partner/customers/individual", icon: "👨‍👩‍👧" },
      { label: "기업 고객 (B2B)", href: "/partner/customers/corporate", icon: "🏢" },
      { label: "세그먼트", href: "/partner/customers/segments", icon: "🎯" },
      { label: "실시간 활동", href: "/partner/customers/activity", icon: "📊" },
      { label: "엑셀 일괄등록", href: "/partner/customers/bulk-import", icon: "📥" },
    ],
  },
  {
    label: "재무",
    icon: "💰",
    match: ["/partner/billing", "/partner/settlements"],
    items: [
      { label: "결제 & 정산", href: "/partner/billing", icon: "💳" },
      { label: "받은 청구서", href: "/partner/billing/invoices", icon: "📄" },
      { label: "🌰 도토리 충전", href: "/partner/billing/acorns", icon: "🌰" },
      { label: "정산 내역", href: "/partner/billing/settlements", icon: "💸" },
      { label: "세금계산서/영수증", href: "/partner/billing/receipts", icon: "🧾" },
    ],
  },
  {
    label: "분석",
    icon: "📊",
    match: ["/partner/analytics"],
    items: [
      { label: "성과 리포트", href: "/partner/analytics", icon: "📊" },
      { label: "리뷰 관리", href: "/partner/analytics#reviews", icon: "⭐" },
    ],
  },
  {
    label: "마케팅",
    icon: "🛠️",
    match: ["/partner/marketing"],
    items: [
      { label: "판매 페이지", href: "/partner/marketing", icon: "🎨" },
      { label: "SNS 콘텐츠", href: "/partner/marketing/sns", icon: "📱" },
      { label: "쿠폰/프로모션", href: "/partner/marketing/coupons", icon: "🎁" },
    ],
  },
  {
    label: "설정",
    icon: "⚙️",
    match: ["/partner/settings", "/partner/my"],
    items: [
      { label: "내 정보", href: "/partner/my", icon: "🪪" },
      { label: "계정 설정", href: "/partner/settings", icon: "⚙️" },
      { label: "팀 관리", href: "/partner/settings/team", icon: "👥" },
      { label: "서류 제출", href: "/partner/settings/documents", icon: "📄" },
    ],
  },
];

interface Props {
  partnerName: string;
}

export function PartnerNav({ partnerName }: Props) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setOpenDropdown(null);
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-[#D4E4BC] bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2" ref={navRef}>
        <div className="flex items-center gap-4 lg:gap-6 min-w-0">
          <Link href="/partner/dashboard" className="flex items-center gap-2 font-bold text-[#2D5A3D] flex-shrink-0">
            <span className="text-xl">🏡</span>
            <span className="hidden sm:inline">숲지기</span>
          </Link>

          {/* 데스크탑 네비 */}
          <nav className="hidden lg:flex items-center gap-1 text-sm">
            <Link href="/partner/dashboard"
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors
                ${pathname === "/partner/dashboard" ? "bg-[#E8F0E4] text-[#2D5A3D] font-semibold" : "text-[#2C2C2C] hover:bg-[#F5F1E8]"}`}>
              🏠 대시보드
            </Link>

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
                    <div className="absolute top-full left-0 mt-1 min-w-[220px] rounded-xl border border-[#D4E4BC] bg-white shadow-lg overflow-hidden">
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
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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

        {/* 우측: 파트너 배지 + 로그아웃 */}
        <div className="flex items-center gap-2 text-sm flex-shrink-0">
          <span className="hidden sm:inline-flex items-center rounded-full bg-[#E8F0E4] px-3 py-1 text-xs font-semibold text-[#2D5A3D] truncate max-w-[160px]">
            🌿 {partnerName}
          </span>
          <form action="/api/auth/partner-logout" method="post">
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
            <Link href="/partner/dashboard"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#2C2C2C] hover:bg-[#F5F1E8]">
              🏠 대시보드
            </Link>
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
          </div>
        </div>
      )}
    </header>
  );
}
