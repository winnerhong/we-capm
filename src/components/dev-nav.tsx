"use client";

// 개발용 상단 네비게이션 — production 에서는 layout 에서 렌더하지 않음.
//
// 🔄 항상 최신 라우트와 동기화 유지!
// 새 포털/역할/주요 페이지를 추가하면 아래 PORTALS / QUICK_LINKS / SEED_ACTIONS
// 세 배열만 갱신하면 됨. 단일 소스 — 다른 곳에 흩어진 하드코딩 없음.
//
// matches 배열: 현재 pathname 이 그 prefix 로 시작하면 active 처리. 한 포털에
// 속한 모든 하위 경로(예: 참가자의 /home, /tori-fm, /invitation 등)를 폭넓게
// 등록해두면 어디서 진입해도 active 표시가 정확.

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
  {
    label: "관리자",
    icon: "👨‍💼",
    href: "/api/dev-login?role=admin",
    matches: ["/admin"],
    color: "bg-violet-600",
    activeColor: "bg-violet-500 ring-2 ring-white",
  },
  {
    label: "숲지기(지사)",
    icon: "🏡",
    href: "/api/dev-login?role=partner",
    matches: ["/partner"],
    color: "bg-emerald-600",
    activeColor: "bg-emerald-500 ring-2 ring-white",
  },
  {
    label: "기관",
    icon: "🏢",
    href: "/api/dev-login?role=manager",
    matches: ["/manager", "/org"],
    color: "bg-blue-600",
    activeColor: "bg-blue-500 ring-2 ring-white",
  },
  {
    label: "참가자",
    icon: "👨‍👩‍👧",
    href: "/api/dev-login?role=participant",
    // 참가자 진입경로 — 로그인 / 홈 / FM / 미션 / 초대장 / 스탬프북 / 알림 / 토리톡 / 트레일.
    // (user) route group 안의 모든 경로는 최상위 path 로 노출됨.
    matches: [
      "/user-login",
      "/home",
      "/tori-fm",
      "/tori-talk",
      "/invitation",
      "/join",
      "/missions",
      "/stampbook",
      "/stamps",
      "/gifts",
      "/rewards",
      "/acorns",
      "/broadcasts",
      "/notifications",
      "/profile",
      "/schedule",
      "/event",
      "/trail",
    ],
    color: "bg-green-600",
    activeColor: "bg-green-500 ring-2 ring-white",
  },
  {
    label: "광고주",
    icon: "🧚",
    href: "/ads-portal",
    matches: ["/ads-portal"],
    color: "bg-amber-600",
    activeColor: "bg-amber-500 ring-2 ring-white",
  },
  {
    label: "가맹점(지역상점)",
    icon: "🌳",
    href: "/store",
    matches: ["/store"],
    color: "bg-orange-600",
    activeColor: "bg-orange-500 ring-2 ring-white",
  },
];

function matchesPortal(pathname: string, portal: Portal): boolean {
  return portal.matches.some((m) => pathname.startsWith(m));
}

// 🔗 링크 드롭다운 — 자주 가는 공개/운영 페이지 모음.
//   새 페이지 추가 시 여기에 한 줄만 더하면 끝.
type LinkItem = { label: string; icon: string; href: string };
type LinkSection = { heading: string; items: LinkItem[] };

const LINK_SECTIONS: LinkSection[] = [
  {
    heading: "공개",
    items: [
      { label: "랜딩", icon: "🏠", href: "/" },
      { label: "행사 목록", icon: "🌲", href: "/events" },
      { label: "블로그", icon: "📝", href: "/blog" },
      { label: "FAQ", icon: "❓", href: "/faq" },
      { label: "B2B", icon: "💼", href: "/enterprise" },
      { label: "소개", icon: "🌿", href: "/about" },
      { label: "갤러리", icon: "🖼", href: "/gallery" },
      { label: "프로그램", icon: "🎯", href: "/programs" },
    ],
  },
  {
    heading: "참가자",
    items: [
      { label: "참가자 로그인", icon: "🔑", href: "/user-login" },
      { label: "홈", icon: "🏡", href: "/home" },
      { label: "토리FM", icon: "🎙", href: "/tori-fm" },
      { label: "토리톡", icon: "💬", href: "/tori-talk" },
      { label: "스탬프북", icon: "📚", href: "/stampbook" },
      { label: "도토리", icon: "🌰", href: "/acorns" },
      { label: "알림", icon: "🔔", href: "/notifications" },
      { label: "프로필", icon: "🙋", href: "/profile" },
    ],
  },
  {
    heading: "운영자",
    items: [
      { label: "기관 로그인", icon: "🏢", href: "/login" },
      { label: "사이트맵", icon: "🗺", href: "/sitemap.xml" },
    ],
  },
];

// 🌱 테스트 데이터 시드 액션 — 새 시드 엔드포인트 추가하면 여기 추가.
type SeedAction = {
  label: string;
  icon: string;
  endpoint: string;
  confirm: string;
};

const SEED_ACTIONS: SeedAction[] = [
  {
    label: "테스트 데이터",
    icon: "🌱",
    endpoint: "/api/dev-seed",
    confirm: "테스트 데이터를 초기화하고 새로 넣을까요?",
  },
];

export function DevNav() {
  const [open, setOpen] = useState(true);
  const [seedingKey, setSeedingKey] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const activePortal = PORTALS.find((p) => matchesPortal(pathname, p));

  const handleSeed = async (action: SeedAction) => {
    if (!confirm(action.confirm)) return;
    setSeedingKey(action.endpoint);
    try {
      const res = await fetch(action.endpoint);
      const data = (await res.json().catch(() => null)) as {
        log?: string[];
      } | null;
      alert(data?.log?.join("\n") ?? "완료!");
      window.location.reload();
    } catch {
      alert("시드 실패");
    }
    setSeedingKey(null);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed top-1 left-1 z-[9999] rounded bg-black/70 px-2 py-0.5 text-[10px] text-white hover:bg-black"
      >
        DEV
      </button>
    );
  }

  return (
    <div className="sticky top-0 z-[9999] flex items-center gap-1.5 overflow-x-auto bg-neutral-900 px-3 py-1.5 text-xs text-white">
      <span className="flex-shrink-0 rounded bg-yellow-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
        DEV
      </span>
      {activePortal && (
        <span className="flex-shrink-0 whitespace-nowrap text-[10px] text-neutral-400">
          {activePortal.icon} {activePortal.label}
        </span>
      )}
      <div className="h-4 w-px flex-shrink-0 bg-neutral-600" />
      {PORTALS.map((p) => {
        const isActive = matchesPortal(pathname, p);
        return (
          <a
            key={p.href}
            href={p.href}
            className={`flex-shrink-0 whitespace-nowrap rounded px-2 py-0.5 font-semibold text-white transition-colors ${
              isActive ? p.activeColor : p.color
            } hover:brightness-110`}
          >
            {p.icon} {p.label}
          </a>
        );
      })}
      <div className="h-4 w-px flex-shrink-0 bg-neutral-600" />
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="whitespace-nowrap rounded bg-neutral-700 px-2 py-0.5 font-semibold hover:bg-neutral-600"
        >
          🔗 링크
        </button>
        {menuOpen && (
          <div className="absolute left-0 top-full z-[10000] mt-1 max-h-[80vh] min-w-[180px] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-800 p-1 shadow-xl">
            {LINK_SECTIONS.map((section) => (
              <div key={section.heading} className="mb-1 last:mb-0">
                <p className="px-2 pt-1.5 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                  {section.heading}
                </p>
                {section.items.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 whitespace-nowrap rounded px-2 py-1.5 text-white hover:bg-neutral-700"
                  >
                    <span>{l.icon}</span>
                    <span>{l.label}</span>
                  </a>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      {SEED_ACTIONS.map((s) => (
        <button
          key={s.endpoint}
          onClick={() => handleSeed(s)}
          disabled={seedingKey !== null}
          className="flex-shrink-0 whitespace-nowrap rounded bg-orange-600 px-2 py-0.5 font-semibold hover:bg-orange-700 disabled:opacity-50"
        >
          {seedingKey === s.endpoint ? "⏳ 시드 중..." : `${s.icon} ${s.label}`}
        </button>
      ))}
      <button
        onClick={() => setOpen(false)}
        className="ml-auto flex-shrink-0 rounded px-1.5 py-0.5 text-neutral-400 hover:bg-white/20"
      >
        ✕
      </button>
    </div>
  );
}
