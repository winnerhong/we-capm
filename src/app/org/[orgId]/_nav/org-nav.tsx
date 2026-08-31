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
import { QuickNoticeButton } from "./QuickNoticeButton";
import { AcornGuideButton } from "./AcornGuideButton";
import { AllToolsButton, type DrawerGroup } from "./all-tools-button";
import type { AcornScoreGuide } from "@/lib/scoring/guide-core";
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

/**
 * @param showStampbook 지사가 스탬프북 기능을 켰나
 * @param showStats     지사가 미션 라이브러리(통계) 기능을 켰나
 *
 * 꺼진 기능은 **줄에서 사라진다.** 회색으로 남기지 않는 이유 — 이 줄은 이동
 * 수단이고, 눌리지 않는 이동 수단은 그냥 고장으로 읽힌다. "있는데 꺼져 있다"
 * 는 사실은 기관 홈의 「모든 기능」 목록판이 자물쇠로 말해 준다.
 */
function buildGroups(
  orgId: string,
  badges: OrgNavBadges,
  showStampbook: boolean,
  showStats: boolean
): NavGroup[] {
  const base = `/org/${orgId}`;

  // 메뉴가 [내 행사] 하나로 줄면서 배지도 하나만 걸 수 있다. 급한 것부터 건다:
  //   검수 대기(사람이 기다린다) > 시작 안 한 행사 > FM 라이브(진행 중 표시).
  // 배지를 없애지 않는 이유 — 검수 대기는 방치하면 참가자 도토리가 안 나간다.
  const draftBadge: BadgeSpec | undefined =
    badges.pendingReview > 0
      ? { count: badges.pendingReview, tone: "rose" }
      : badges.draftEvents > 0
        ? { count: badges.draftEvents, tone: "amber" }
        : badges.fmLive
          ? { pulse: true, tone: "rose" }
          : undefined;

  return [
    // 상단은 "어느 행사?" 만 고른다.
    //
    // 예전에는 여기 6그룹(초대장·내 행사·참가자·콘텐츠·진행·결과)이 있었고,
    // 행사 상세에도 9탭이 따로 있었다. 참가자·스탬프북·프로그램·숲길·타임테이블·
    // 성과가 **양쪽에** 있어서 "참가자를 어디서 보지" 를 매번 다시 고민했다.
    //
    // 지금은 행사 하나가 워크스페이스다:
    //   내 행사 → 초대장 → 참가자 → 진행 → 결과   (event-steps.ts)
    // 행사를 가로지르는 것들(초대장 모음·참가자 관리·전체 통계)은 행사 목록
    // 화면 위의 바로가기 줄이 맡는다.
    {
      key: "schedule",
      step: 1,
      label: "내 행사",
      shortLabel: "내 행사",
      icon: "📅",
      match: [`${base}/events`],
      badge: draftBadge,
      items: [
        {
          label: "행사 목록",
          href: `${base}/events`,
          icon: "📅",
          badge: draftBadge,
        },
      ],
    },
    // 행사를 **가로지르는** 두 화면. 행사 안에도 스탬프북(진행)과 성과(결과)가
    // 있지만 그건 그 행사 하나의 것이고, 여기 둘은 기관 전체다
    // ("우리 기관 스탬프북", "우리 기관 미션 통계").
    //
    // 예전엔 화면마다 그려지는 탭 한 줄(기관 홈·행사 목록·스탬프북·통계)에
    // 있었다. 그 줄을 없애면서 이 줄로 옮겼다 — 상단에 줄이 둘이면 어느 쪽이
    // 위인지 매번 다시 판단하게 된다.
    ...(showStampbook
      ? [
          {
            key: "quest-packs",
            step: 2,
            label: "스탬프북",
            shortLabel: "스탬프북",
            icon: "📚",
            match: [`${base}/quest-packs`],
            items: [
              {
                label: "우리 기관 스탬프북",
                href: `${base}/quest-packs`,
                icon: "📚",
              },
            ],
          } satisfies NavGroup,
        ]
      : []),
    ...(showStats
      ? [
          {
            key: "stats",
            step: 3,
            label: "통계",
            shortLabel: "통계",
            icon: "📊",
            match: [`${base}/missions/stats`],
            items: [
              {
                label: "우리 기관 미션 통계",
                href: `${base}/missions/stats`,
                icon: "📊",
              },
            ],
          } satisfies NavGroup,
        ]
      : []),
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

/** 지사가 상단으로 올린 도구 한 칸. 목록은 layout 이 서버에서 풀어 준다. */
export type NavTool = {
  key: string;
  label: string;
  icon: string;
  href: string;
  newTab?: boolean;
};

interface Props {
  orgId: string;
  orgName: string;
  badges: OrgNavBadges;
  /**
   * 상단에 고정된 도구들 (lib/org-tools).
   *
   * 예전엔 [관제실] 이 코드에 박혀 있었다. 어느 기관이든 무조건 떴고, 관제실을
   * 안 쓰는 기관에는 평생 안 누르는 칸이었다. 이제 지사가 정한다 —
   * 마이그레이션이 기존 지사에 control-room 을 고정해 둬서 지금 화면은 그대로다.
   */
  tools: NavTool[];
  /** 지사가 스탬프북 기능을 켰나 — 꺼져 있으면 상단 줄에서 사라진다. */
  showStampbook: boolean;
  /** 지사가 미션 라이브러리(통계) 기능을 켰나. */
  showStats: boolean;
  /** 상단 [🌰 도토리 배점] 팝오버에 그릴 것. 조회는 레이아웃이 한 번만 한다. */
  acornGuide: AcornScoreGuide;
  /**
   * 「⋯ 전체」 서랍에 그릴 도구 전부 — 기관 홈 「모든 기능」 과 **같은 원본**
   * (lib/org-tools/registry.ts)에서 레이아웃이 서버에서 풀어 준다.
   */
  allToolGroups: DrawerGroup[];
}

export function OrgNav({
  orgId,
  orgName,
  badges,
  tools,
  acornGuide,
  showStampbook,
  showStats,
  allToolGroups,
}: Props) {
  const pathname = usePathname() ?? "";
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(
    () => buildGroups(orgId, badges, showStampbook, showStats),
    [orgId, badges, showStampbook, showStats]
  );
  const controlRoomHref = `/org/${orgId}/control-room`;
  const controlRoomActive = isActiveHref(controlRoomHref, pathname);
  // 관제실만 시안 강조 + FM 라이브 점을 갖는다(진행 중 신호라 눈에 띄어야 한다).
  // 나머지 고정 도구는 일반 칸이다 — 다 강조하면 아무것도 강조가 아니다.
  const hasControlRoom = tools.some((t) => t.key === "control-room");
  const otherTools = tools.filter((t) => t.key !== "control-room");

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
            const linkClass = `inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-2.5 py-2 text-sm font-semibold transition ${
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

          {/* 관제실 단독 강조 — 지사가 상단에 올려 뒀을 때만 */}
          {hasControlRoom && (
          <Link
            href={controlRoomHref}
            className={`ml-2 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition ${
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
          )}

          {/* 지사가 상단에 올린 나머지 도구들 */}
          {otherTools.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              {...(t.newTab ? { target: "_blank", rel: "noopener" } : {})}
              aria-current={isActiveHref(t.href, pathname) ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-2.5 py-2 text-sm font-semibold transition ${
                isActiveHref(t.href, pathname)
                  ? "bg-[#E8F0E4] text-[#2D5A3D]"
                  : "text-[#2D5A3D] hover:bg-[#F5F1E8]"
              }`}
            >
              <span aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          ))}

          {/* 도토리 배점표 — 행사장에서 "이거 하면 몇 개예요?" 를 그 자리에서
              답하기 위한 것이라, 어느 화면에 있든 손이 닿는 상단에 둔다. */}
          <AcornGuideButton guide={acornGuide} />

          {/* LIVE 멘트 빠른 게시 — LIVE FM 세션의 BANNER spotlight 트리거 */}
          <QuickNoticeButton liveFmSessionId={badges.liveFmSessionId} />
        </nav>

        {/* 우: 영구 액션 — 전체 목록 + 알림 + 계정.
            서랍이 여기 있는 이유 — 가운데 <nav> 는 lg 미만에서 사라진다.
            도구를 못 찾는 일은 좁은 화면에서 더 자주 생기므로, 이 문만은
            폭에 상관없이 늘 같은 자리에 있어야 한다. */}
        <div className="flex shrink-0 items-center gap-2">
          <AllToolsButton groups={allToolGroups} />
          <OrgAccountMenu
            orgId={orgId}
            orgName={orgName}
            hasUnreadNotification={badges.missingDocs > 0}
          />
        </div>
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
              {hasControlRoom && (
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
              )}
              {otherTools.map((t) => (
                <li key={t.key}>
                  <Link
                    href={t.href}
                    onClick={() => setMobileOpen(false)}
                    {...(t.newTab ? { target: "_blank", rel: "noopener" } : {})}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-[#2C2C2C] hover:bg-[#FFF8F0] hover:text-[#2D5A3D]"
                  >
                    <span aria-hidden>{t.icon}</span>
                    <span>{t.label}</span>
                  </Link>
                </li>
              ))}
              {/* 배점표·LIVE 멘트 — drawer 안에서도 동일 컴포넌트 */}
              <li>
                <AcornGuideButton guide={acornGuide} />
              </li>
              <li>
                <QuickNoticeButton liveFmSessionId={badges.liveFmSessionId} />
              </li>
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}
