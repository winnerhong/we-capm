"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { TeamRole } from "@/lib/team/types";
import { AcornIcon } from "@/components/acorn-icon";

interface NavItem {
  label: ReactNode;
  href: string;
  icon?: ReactNode;
  /** 이 메뉴를 볼 수 있는 역할 목록. 없으면 전원 공개. */
  allowedRoles?: TeamRole[];
}

interface NavGroup {
  label: string;
  icon: ReactNode;
  items: NavItem[];
  match: string[];
  /** 그룹 전체 가시성 제한 (있으면 아래 items 의 allowedRoles 보다 우선). */
  allowedRoles?: TeamRole[];
}

const ALL_ROLES: TeamRole[] = ["OWNER", "MANAGER", "STAFF", "FINANCE", "VIEWER"];

const NAV_GROUPS: NavGroup[] = [
  {
    label: "프로그램",
    icon: "🌲",
    match: [
      "/partner/programs",
      "/partner/trails",
      "/partner/missions",
      "/partner/stampbook-presets",
    ],
    items: [
      {
        label: "프로그램 관리",
        href: "/partner/programs",
        icon: "🗺️",
        allowedRoles: ALL_ROLES,
      },
      {
        label: "➕ 새 프로그램",
        href: "/partner/programs/new",
        icon: "➕",
        allowedRoles: ["OWNER", "MANAGER", "STAFF"],
      },
      {
        label: "나만의 숲길 (QR·미션)",
        href: "/partner/trails",
        icon: "🎨",
        allowedRoles: ALL_ROLES,
      },
      {
        label: "미션 라이브러리",
        href: "/partner/missions",
        icon: "🎯",
        allowedRoles: ["OWNER", "MANAGER", "STAFF"],
      },
      {
        label: "📊 미션 통계",
        href: "/partner/missions/stats",
        icon: "📊",
        allowedRoles: ["OWNER", "MANAGER", "STAFF", "VIEWER"],
      },
      {
        label: "📚 스탬프북 프리셋",
        href: "/partner/stampbook-presets",
        icon: "📚",
        allowedRoles: ["OWNER", "MANAGER", "STAFF"],
      },
      {
        label: "💌 기관 제안",
        href: "/partner/missions/contributions",
        icon: "💌",
        allowedRoles: ["OWNER", "MANAGER", "STAFF"],
      },
    ],
  },
  {
    label: "고객",
    icon: "👥",
    match: ["/partner/customers", "/partner/b2b", "/partner/b2c"],
    allowedRoles: ["OWNER", "MANAGER", "STAFF", "VIEWER"],
    items: [
      { label: "CRM 대시보드", href: "/partner/customers", icon: "🏠" },
      {
        label: "기관 고객 (B2B2C)",
        href: "/partner/customers/org",
        icon: "🏫",
      },
      {
        label: "개인 고객 (B2C)",
        href: "/partner/customers/individual",
        icon: "👨‍👩‍👧",
      },
      {
        label: "기업 고객 (B2B)",
        href: "/partner/customers/corporate",
        icon: "🏢",
      },
      {
        label: "세그먼트",
        href: "/partner/customers/segments",
        icon: "🎯",
        allowedRoles: ["OWNER", "MANAGER", "VIEWER"],
      },
      { label: "실시간 활동", href: "/partner/customers/activity", icon: "📊" },
      {
        label: "엑셀 일괄등록",
        href: "/partner/customers/bulk-import",
        icon: "📥",
        allowedRoles: ["OWNER", "MANAGER"],
      },
    ],
  },
  {
    label: "재무",
    icon: "💰",
    match: ["/partner/billing", "/partner/settlements"],
    allowedRoles: ["OWNER", "FINANCE"],
    items: [
      { label: "결제 & 정산", href: "/partner/billing", icon: "💳" },
      { label: "받은 청구서", href: "/partner/billing/invoices", icon: "📄" },
      {
        label: (
          <span className="inline-flex items-center gap-1">
            <AcornIcon size={14} /> 도토리 충전
          </span>
        ),
        href: "/partner/billing/acorns",
        icon: <AcornIcon size={16} />,
      },
      {
        label: "정산 내역",
        href: "/partner/billing/settlements",
        icon: "💸",
      },
      {
        label: "세금계산서/영수증",
        href: "/partner/billing/receipts",
        icon: "🧾",
      },
    ],
  },
  {
    label: "분석",
    icon: "📊",
    match: ["/partner/analytics"],
    allowedRoles: ["OWNER", "MANAGER", "STAFF", "FINANCE", "VIEWER"],
    items: [
      { label: "성과 리포트", href: "/partner/analytics", icon: "📊" },
      {
        label: "리뷰 관리",
        href: "/partner/analytics/reviews",
        icon: "⭐",
        allowedRoles: ["OWNER", "MANAGER", "STAFF", "VIEWER"],
      },
    ],
  },
  {
    label: "마케팅",
    icon: "🛠️",
    match: ["/partner/marketing"],
    allowedRoles: ["OWNER", "MANAGER", "VIEWER"],
    items: [
      { label: "판매 페이지", href: "/partner/marketing", icon: "🎨" },
      {
        label: "쿠폰/프로모션",
        href: "/partner/marketing/coupons",
        icon: "🎁",
      },
    ],
  },
  {
    label: "설정",
    icon: "⚙️",
    match: ["/partner/settings", "/partner/my"],
    items: [
      {
        label: "내 정보",
        href: "/partner/my",
        icon: "🪪",
        allowedRoles: ALL_ROLES,
      },
      {
        label: "계정 설정",
        href: "/partner/settings",
        icon: "⚙️",
        allowedRoles: ["OWNER", "MANAGER"],
      },
      {
        label: "팀 관리",
        href: "/partner/settings/team",
        icon: "👥",
        allowedRoles: ["OWNER"],
      },
      {
        label: "서류 템플릿",
        href: "/partner/settings/doc-templates",
        icon: "📄",
        allowedRoles: ["OWNER"],
      },
      {
        label: "서류 제출",
        href: "/partner/settings/documents",
        icon: "📄",
        allowedRoles: ["OWNER", "FINANCE"],
      },
    ],
  },
];

function canSee(role: TeamRole, allowed?: TeamRole[]): boolean {
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(role);
}

function filterGroups(role: TeamRole): NavGroup[] {
  return NAV_GROUPS.filter((g) => canSee(role, g.allowedRoles))
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => canSee(role, it.allowedRoles)),
    }))
    .filter((g) => g.items.length > 0);
}

interface Props {
  partnerName: string;
  role?: TeamRole | null;
  pendingCount?: number;
  profilePercent?: number | null;
}

function profileTone(percent: number): {
  bg: string;
  text: string;
  ring: string;
} {
  if (percent >= 100)
    return {
      bg: "bg-emerald-100",
      text: "text-emerald-800",
      ring: "ring-emerald-200",
    };
  if (percent >= 80)
    return {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      ring: "ring-emerald-200",
    };
  if (percent >= 50)
    return {
      bg: "bg-amber-50",
      text: "text-amber-800",
      ring: "ring-amber-200",
    };
  return { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200" };
}

export function PartnerNav({
  partnerName,
  role,
  pendingCount = 0,
  profilePercent = null,
}: Props) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  const effectiveRole: TeamRole = role ?? "OWNER";
  const groups = useMemo(() => filterGroups(effectiveRole), [effectiveRole]);

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

            {groups.map((group) => {
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

        {/* 우측: 팀 퀵 + 파트너 배지 + 로그아웃 */}
        <div className="flex items-center gap-2 text-sm flex-shrink-0">
          {(effectiveRole === "OWNER" || effectiveRole === "MANAGER") && (
            <Link
              href="/partner/settings/team"
              aria-label={
                pendingCount > 0
                  ? `팀 관리 (대기 팀원 ${pendingCount}명)`
                  : "팀 관리"
              }
              title={
                pendingCount > 0
                  ? `팀 관리 · 대기 ${pendingCount}명`
                  : "팀 관리"
              }
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F1E8] text-lg hover:bg-[#E8F0E4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3A7A52]/50"
            >
              <span aria-hidden>👥</span>
              {pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </Link>
          )}
          <Link
            href="/partner/my"
            className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#E8F0E4] px-3 py-1 text-xs font-semibold text-[#2D5A3D] truncate max-w-[200px] hover:bg-[#D4E4BC] transition-colors"
            title={
              profilePercent != null
                ? `내 정보 · 프로필 완성도 ${profilePercent}%`
                : "내 정보"
            }
          >
            <span className="truncate">🌿 {partnerName}</span>
            {profilePercent != null && (
              <span
                className={`ml-0.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${profileTone(profilePercent).bg} ${profileTone(profilePercent).text} ${profileTone(profilePercent).ring}`}
                aria-label={`프로필 완성도 ${profilePercent}%`}
              >
                {profilePercent === 100 ? "🎉" : `${profilePercent}%`}
              </span>
            )}
          </Link>
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
            {groups.map((group) => (
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
