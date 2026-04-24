"use client";

import { useEffect, useState } from "react";

type Props = {
  /** localStorage 고유 식별자 (예: "live-event") */
  storageKey: string;
  /** 접혔을 때 한 줄 요약에 노출할 카드 이름 */
  title: string;
  /** 접혔을 때 노출할 이모지 아이콘 */
  icon: string;
  /** 서버 렌더된 카드 내용 */
  children: React.ReactNode;
};

/**
 * 기관 홈 카드 접기 토글.
 * - SSR 기본값은 "펼침" 으로 고정 → hydration mismatch 방지.
 * - 마운트 후 useEffect 에서 localStorage 읽어 필요 시 접힘 적용.
 * - 토글 버튼은 우측 상단 오버레이(펼침 상태) / 카드 전체(접힘 상태).
 */
export function CollapsibleCard({ storageKey, title, icon, children }: Props) {
  const storageName = `org-home-collapse:${storageKey}`;

  // SSR 안전: 항상 펼침으로 시작
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(storageName);
      if (v === "1") setCollapsed(true);
    } catch {
      // localStorage 비활성화 환경(시크릿모드 등) 무시
    }
    setHydrated(true);
  }, [storageName]);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageName, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  // 접힘 상태 → 한 줄 요약 카드
  if (hydrated && collapsed) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-expanded="false"
        aria-label={`${title} 펼치기`}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-violet-300 hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="text-lg" aria-hidden>
            {icon}
          </span>
          <span>{title}</span>
        </span>
        <span className="text-xs text-violet-600">펼치기 ▼</span>
      </button>
    );
  }

  // 펼침 상태 (기본) → children + 우측 상단 접기 버튼 오버레이
  return (
    <div className="relative">
      {children}
      <button
        type="button"
        onClick={toggle}
        aria-expanded="true"
        aria-label={`${title} 접기`}
        className="absolute top-3 right-3 z-10 rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm backdrop-blur transition hover:border-violet-300 hover:bg-white hover:text-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
      >
        접기 ▲
      </button>
    </div>
  );
}
