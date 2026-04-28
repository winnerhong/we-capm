"use client";

// 패널 펼치기/접기 토글 — 모든 LIVE 콘솔 zone 에서 재사용.
//
// 동작:
//   - expanded=true → 섹션 element 가 fixed inset-4 z-50 으로 풀스크린 오버레이
//     (배경 카드 chrome 유지: rounded-3xl, gradient 배경, 보더)
//   - body scroll lock (배경 페이지가 같이 스크롤되지 않도록)
//   - ESC 키로 접기
//   - 같은 시점에 여러 패널이 펼쳐져도 z-50 으로 최상단. (단일 펼침 정책은
//     상위 컨테이너가 책임 — 본 훅은 단순.)
//
// 사용법:
//   const { expanded, toggle, panelClassName } = usePanelExpand();
//   <section className={`base ${panelClassName}`}>
//     <header>... <PanelExpandButton expanded={expanded} onToggle={toggle} /></header>
//     ...
//   </section>

import { useEffect, useState, useCallback } from "react";

export const EXPANDED_PANEL_CLASS =
  "fixed inset-2 sm:inset-4 z-50 flex flex-col max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl";

export function usePanelExpand() {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  useEffect(() => {
    if (!expanded) return;

    // body scroll lock
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // ESC → close
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  return {
    expanded,
    toggle,
    setExpanded,
    panelClassName: expanded ? EXPANDED_PANEL_CLASS : "",
  };
}

interface ButtonProps {
  expanded: boolean;
  onToggle: () => void;
  /** 색조 — amber(기본) / rose / fuchsia 등 패널 액센트에 맞춤 */
  tone?: "amber" | "rose" | "fuchsia" | "emerald" | "sky";
}

const TONE_CLASSES: Record<NonNullable<ButtonProps["tone"]>, string> = {
  amber:
    "border-amber-300/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20",
  rose: "border-rose-300/40 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20",
  fuchsia:
    "border-fuchsia-300/40 bg-fuchsia-400/10 text-fuchsia-200 hover:bg-fuchsia-400/20",
  emerald:
    "border-emerald-300/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20",
  sky: "border-sky-300/40 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20",
};

export function PanelExpandButton({
  expanded,
  onToggle,
  tone = "amber",
}: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={expanded ? "패널 접기" : "패널 전체 보기"}
      title={expanded ? "ESC 또는 클릭으로 접기" : "전체 보기"}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${TONE_CLASSES[tone]}`}
    >
      {expanded ? (
        <>
          <span aria-hidden>↙</span>
          <span>접기</span>
        </>
      ) : (
        <>
          <span aria-hidden>⛶</span>
          <span>펼치기</span>
        </>
      )}
    </button>
  );
}
