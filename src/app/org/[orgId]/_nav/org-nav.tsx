"use client";

// 기관 포털 상단 네비게이션 — 워크플로우 6단계 + 관제실 단독 강조 + 우측 영구 액션.
//
// 단계 구성 (실제 행사 운영 흐름):
//   1️⃣ 만들기 → 2️⃣ 일정 → 3️⃣ 참가자 → 4️⃣ 콘텐츠 → 5️⃣ 진행 → 6️⃣ 결과
//
// 활성 매칭: pathname 의 prefix 가 group.match[*] 와 일치하면 active.
// 한 라우트가 여러 단계에 속해도 첫 번째 매칭 그룹에서만 active 표시.
// 모바일(<lg): 햄버거 → drawer 로 6단계 세로 스택.
//
// 배지 데이터(초안 N / 비공개 N / 검수 N / FM LIVE / 서류 미완료) 는 layout 에서
// loadOrgNavBadges 로 한 번 로드 후 prop 주입. 클라이언트 추가 fetch 없음.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrgAccountMenu } from "../org-account-menu";
import type { OrgNavBadges } from "@/lib/org-nav/badges";

type BadgeTone = "rose" | "amber" | "emerald" | "violet";

interface BadgeSpec {
  count?: number;
  pulse?: boolean;
  tone: BadgeTone;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: BadgeSpec;
}

interface NavGroup {
  key: string;
  step: number;
  label: string;
  shortLabel: string;
  icon: string;
  /** pathname 이 이 prefix 들 중 하나로 시작하면 그룹이 active. */
  match: string[];
  items: NavItem[];
  badge?: BadgeSpec;
}

function buildGroups(orgId: string, badges: OrgNavBadges): NavGroup[] {
  const base = `/org/${orgId}`;

  const draftBadge: BadgeSpec | undefined =
    badges.draftEvents > 0
      ? { count: badges.draftEvents, tone: "amber" }
      : undefined;
  const unpubBadge: BadgeSpec | undefined =
    badges.unpublishedPacks > 0
      ? { count: badges.unpublishedPacks, tone: "amber" }
      : undefined;
  const reviewBadge: BadgeSpec | undefined =
    badges.pendingReview > 0
      ? { count: badges.pendingReview, tone: "rose" }
      : undefined;
  const fmBadge: BadgeSpec | undefined = badges.fmLive
    ? { pulse: true, tone: "rose" }
    : undefined;

  return [
    // ───── 1단계 ─────
    {
      key: "create",
      step: 1,
      label: "+ 새 행사",
      shortLabel: "+ 새 행사",
      icon: "🎪",
      match: [`${base}/events/new`],
      items: [
        {
          label: "새 행사 만들기",
          href: `${base}/events/new`,
          icon: "➕",
        },
      ],
    },
    // ───── 2단계 ─────
    {
      key: "schedule",
      step: 2,
      label: "내 행사",
      shortLabel: "내 행사",
      icon: "📅",
      match: [`${base}/events`],
      badge: draftBadge,
      items: [
        {
          label: "행사 목록 · 타임테이블",
          href: `${base}/events`,
          icon: "📅",
          badge: draftBadge,
        },
      ],
    },
    // ───── 3단계 ─────
    {
      key: "participants",
      step: 3,
      label: "참가자",
      shortLabel: "참가자",
      icon: "🙋",
      match: [`${base}/users`],
      items: [
        { label: "참가자", href: `${base}/users`, icon: "🙋" },
      ],
    },
    // ───── 4단계 ─────
    {
      key: "content",
      step: 4,
      label: "콘텐츠",
      shortLabel: "콘텐츠",
      icon: "🎁",
      match: [
        `${base}/quest-packs`,
        `${base}/programs`,
        `${base}/trails`,
        `${base}/missions/catalog`,
        `${base}/templates`,
      ],
      badge: unpubBadge,
      items: [
        { label: "내 프로그램", href: `${base}/programs`, icon: "🗂" },
        {
          label: "스탬프북 관리",
          href: `${base}/quest-packs`,
          icon: "🌲",
          badge: unpubBadge,
        },
        { label: "우리 숲길", href: `${base}/trails`, icon: "🗺" },
        {
          label: "미션 카탈로그",
          href: `${base}/missions/catalog`,
          icon: "🎯",
        },
        { label: "기본 템플릿", href: `${base}/templates`, icon: "🪜" },
      ],
    },
    // ───── 5단계 ─────
    {
      key: "operate",
      step: 5,
      label: "진행",
      shortLabel: "진행",
      icon: "🎙",
      match: [
        `${base}/missions/broadcast`,
        `${base}/missions/review`,
        `${base}/missions/radio`,
        `${base}/gifts`,
      ],
      badge: fmBadge ?? reviewBadge,
      items: [
        {
          label: "토리FM 라이브 스튜디오",
          href: `${base}/tori-fm`,
          icon: "🎙",
          badge: fmBadge,
        },
        {
          label: "돌발 미션 방송",
          href: `${base}/missions/broadcast`,
          icon: "📡",
        },
        {
          label: "신청곡 모더레이션",
          href: `${base}/missions/radio`,
          icon: "🎵",
        },
        {
          label: "미션 제출 검수",
          href: `${base}/missions/review`,
          icon: "✅",
          badge: reviewBadge,
        },
        {
          label: "선물 수령",
          href: `${base}/gifts/redeem`,
          icon: "🎁",
        },
      ],
    },
    // ───── 6단계 ─────
    {
      key: "result",
      step: 6,
      label: "결과",
      shortLabel: "결과",
      icon: "📊",
      match: [`${base}/missions/stats`],
      items: [
        {
          label: "미션 통계",
          href: `${base}/missions/stats`,
          icon: "📊",
        },
      ],
    },
  ];
}

function isActiveGroup(group: NavGroup, pathname: string): boolean {
  return group.match.some(
    (m) => pathname === m || pathname.startsWith(m + "/")
  );
}

function isActiveHref(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

function badgeToneClass(tone: BadgeTone): string {
  switch (tone) {
    case "rose":
      return "bg-rose-600 text-white";
    case "amber":
      return "bg-amber-500 text-white";
    case "emerald":
      return "bg-emerald-500 text-white";
    case "violet":
      return "bg-violet-600 text-white";
  }
}

function Badge({ b }: { b: BadgeSpec }) {
  if (typeof b.count === "number" && b.count > 0) {
    return (
      <span
        className={`inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-tight ${badgeToneClass(
          b.tone
        )}`}
      >
        {b.count > 99 ? "99+" : b.count}
      </span>
    );
  }
  if (b.pulse) {
    return (
      <span className="relative inline-flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
      </span>
    );
  }
  return null;
}

interface Props {
  orgId: string;
  orgName: string;
  badges: OrgNavBadges;
}

export function OrgNav({ orgId, orgName, badges }: Props) {
  const pathname = usePathname() ?? "";
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => buildGroups(orgId, badges), [orgId, badges]);
  const controlRoomHref = `/org/${orgId}/control-room`;
  const controlRoomActive = isActiveHref(controlRoomHref, pathname);

  // 첫 번째 매칭 그룹만 active (한 라우트가 여러 그룹의 match 에 들어가도 single source of truth)
  const activeIdx = useMemo(() => {
    for (let i = 0; i < groups.length; i++) {
      if (isActiveGroup(groups[i], pathname)) return i;
    }
    return -1;
  }, [groups, pathname]);

  // 바깥 클릭으로 dropdown 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 라우트 이동 시 dropdown / drawer 닫기
  useEffect(() => {
    setOpenKey(null);
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-[#D4E4BC] bg-white/95 backdrop-blur">
      <div
        ref={wrapRef}
        className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3"
      >
        {/* 좌: 햄버거(모바일) + 로고 */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="메뉴 열기"
            aria-expanded={mobileOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#D4E4BC] bg-white text-lg text-[#2D5A3D] transition hover:bg-[#F5F1E8] lg:hidden"
          >
            <span aria-hidden>☰</span>
          </button>
          <Link
            href={`/org/${orgId}`}
            className="flex min-w-0 items-center gap-2 font-extrabold text-[#2D5A3D]"
          >
            <span aria-hidden className="text-xl">
              🌿
            </span>
            <span className="hidden max-w-[10rem] truncate text-sm sm:inline sm:text-base">
              {orgName}
            </span>
          </Link>
        </div>

        {/* 중: 6단계 그룹 (배치 순서 = 워크플로우) + 관제실 (lg 이상) */}
        <nav className="hidden flex-1 items-center justify-center gap-0.5 lg:flex">
          {groups.map((group, idx) => {
            const active = idx === activeIdx;
            const open = openKey === group.key;
            const linkClass = `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              active
                ? "bg-[#E8F0E4] text-[#2D5A3D]"
                : "text-[#2D5A3D] hover:bg-[#F5F1E8]"
            }`;

            // 항목이 1개면 드롭다운 없이 바로 이동
            if (group.items.length === 1) {
              const item = group.items[0];
              return (
                <Link
                  key={group.key}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={linkClass}
                >
                  <span aria-hidden>{group.icon}</span>
                  <span>{group.shortLabel}</span>
                  {group.badge && <Badge b={group.badge} />}
                </Link>
              );
            }

            // 2개 이상: 드롭다운
            return (
              <div key={group.key} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenKey(open ? null : group.key)}
                  aria-expanded={open}
                  aria-haspopup="menu"
                  aria-current={active ? "page" : undefined}
                  className={linkClass}
                >
                  <span aria-hidden>{group.icon}</span>
                  <span>{group.shortLabel}</span>
                  {group.badge && <Badge b={group.badge} />}
                  <span
                    aria-hidden
                    className={`text-[9px] text-[#8B7F75] transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {open && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-lg"
                  >
                    <ul className="py-1">
                      {group.items.map((item) => {
                        const itemActive = isActiveHref(item.href, pathname);
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setOpenKey(null)}
                              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold ${
                                itemActive
                                  ? "bg-[#E8F0E4] text-[#2D5A3D]"
                                  : "text-[#2C2C2C] hover:bg-[#FFF8F0] hover:text-[#2D5A3D]"
                              }`}
                            >
                              <span aria-hidden>{item.icon}</span>
                              <span className="flex-1">{item.label}</span>
                              {item.badge && <Badge b={item.badge} />}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}

          {/* 관제실 단독 강조 */}
          <Link
            href={controlRoomHref}
            className={`ml-2 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              controlRoomActive
                ? "border-[#0891A8] bg-[#E6FAFB] text-[#0891A8]"
                : "border-[#5EE9F0]/40 text-[#0891A8] hover:bg-[#E6FAFB]"
            }`}
            style={{ textShadow: "0 0 6px rgba(94,233,240,0.35)" }}
          >
            <span aria-hidden>🎛</span>
            <span>관제실</span>
            {badges.fmLive && (
              <span className="relative inline-flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
              </span>
            )}
          </Link>
        </nav>

        {/* 우: 영구 액션 — 알림 + 계정 */}
        <OrgAccountMenu
          orgId={orgId}
          orgName={orgName}
          hasUnreadNotification={badges.missingDocs > 0}
        />
      </div>

      {/* 모바일 drawer (<lg) */}
      {mobileOpen && (
        <div className="border-t border-[#D4E4BC] bg-white lg:hidden">
          <nav className="mx-auto max-w-7xl px-4 py-3">
            <ul className="space-y-3">
              {groups.map((group) => (
                <li key={group.key}>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#6B6560]">
                    <span aria-hidden>{group.icon}</span>
                    <span>{group.label}</span>
                    {group.badge && <Badge b={group.badge} />}
                  </div>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const itemActive = isActiveHref(item.href, pathname);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                              itemActive
                                ? "bg-[#E8F0E4] text-[#2D5A3D]"
                                : "text-[#2C2C2C] hover:bg-[#FFF8F0]"
                            }`}
                          >
                            <span aria-hidden>{item.icon}</span>
                            <span className="flex-1">{item.label}</span>
                            {item.badge && <Badge b={item.badge} />}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
              <li>
                <Link
                  href={controlRoomHref}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-bold ${
                    controlRoomActive
                      ? "border-[#0891A8] bg-[#E6FAFB] text-[#0891A8]"
                      : "border-[#5EE9F0]/40 text-[#0891A8]"
                  }`}
                >
                  <span aria-hidden>🎛</span>
                  <span>관제실</span>
                  {badges.fmLive && (
                    <span className="ml-auto relative inline-flex h-2 w-2" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                    </span>
                  )}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}
