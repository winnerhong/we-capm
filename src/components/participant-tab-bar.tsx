"use client";

// 참가자 하단 탭바 — 누른 즉시 반응하고, 지금 있는 탭이 보인다.
//
// 사용자 2026-10-30 "스탬프 버튼을 눌러도 움직임의 변화가 별로 없다".
//   예전 탭은 그냥 Link 라서 (1) 누른 뒤 서버가 페이지를 다 만들 때까지 아무 표시가 없었고
//   (2) 지금 어느 탭인지도 안 보였다. 스탬프는 리다이렉트를 두 번 거쳐 특히 오래 멈춰 보였다.
//   → 지금 탭 = 초록 글자 + 위 막대, 누른 탭 = 그 자리에서 「…」(useLinkStatus).

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export interface TabBarItem {
  href: string;
  label: string;
  icon: ReactNode;
}

/** 이 탭이 지금 화면인가. 행사홈은 정확히 그 주소만, 스탬프는 스탬프북·미션 안도 포함, 나머지는 그 주소 아래 전부 */
function isActive(pathname: string, t: TabBarItem, homeHref: string): boolean {
  const base = t.href.split("?")[0].replace(/\/$/, "");
  if (t.href === homeHref) return pathname.replace(/\/$/, "") === base;
  if (t.label === "스탬프") {
    const root = base.replace(/\/(stampbook|stamps)$/, "");
    return /\/(stampbook|stamps|missions)(\/|$)/.test(pathname.slice(root.length));
  }
  return pathname === base || pathname.startsWith(base + "/");
}

export function ParticipantTabBar({ tabs }: { tabs: TabBarItem[] }) {
  const pathname = usePathname() ?? "";
  const homeHref = tabs[0]?.href ?? "";
  return (
    <ul className="mx-auto flex max-w-md items-stretch">
      {tabs.map((t) => {
        const on = isActive(pathname, t, homeHref);
        return (
          <li key={t.href} className="flex-1">
            <Link
              href={t.href}
              aria-current={on ? "page" : undefined}
              data-tab={t.label}
              className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition active:scale-95 active:bg-[#EEF4E6] ${
                on ? "text-[#2D5A3D]" : "text-[#6B6560] hover:bg-[#F5F1E8] hover:text-[#2D5A3D]"
              }`}
            >
              {on && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-[#2D5A3D]" aria-hidden />}
              <TabBody icon={t.icon} label={t.label} on={on} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Link 안에서만 useLinkStatus 를 쓸 수 있다 — 누른 뒤 새 화면이 뜰 때까지 「…」 */
function TabBody({ icon, label, on }: { icon: ReactNode; label: string; on: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className={`text-xl leading-none transition ${pending ? "animate-pulse opacity-60" : ""} ${on ? "scale-110" : ""}`} aria-hidden>
        {icon}
      </span>
      <span className={on ? "font-extrabold" : undefined}>{pending ? "…" : label}</span>
    </>
  );
}
