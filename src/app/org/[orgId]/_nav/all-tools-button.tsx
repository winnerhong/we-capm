"use client";

// 상단 줄의 「⋯ 전체」 — 어느 화면에 있든 도구 24개를 연다.
//
// 왜 필요했나:
//   도구 전체 목록판(기관 홈 「🧭 모든 기능」)은 **홈에만** 있었다. 다른 화면에서
//   토리FM 설정을 찾으려면 🌿 로고로 홈에 돌아와서 다시 카드까지 내려가야 했다.
//
// 목록은 만들지 않는다 — 레지스트리(lib/org-tools/registry.ts)를 읽어 레이아웃이
// 서버에서 풀어 준 것을 그대로 그린다. 홈 카드와 **같은 원본**이라 둘이 갈라질
// 수 없다. 잠긴 칸도 홈과 똑같이 자리를 지키고 왜 못 쓰는지 말한다.
//
// 상단 줄의 고정 도구 정원(MAX_PINNED_TOOLS = 5) 밖이다. 이건 지사가 고르는
// 칸이 아니라 목록으로 가는 문이라 정원을 먹으면 안 된다.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type DrawerTool = {
  key: string;
  label: string;
  icon: string;
  href: string;
  newTab?: boolean;
  locked: boolean;
  /** 잠긴 이유 한 줄. 쓸 수 있으면 null. */
  why: string | null;
};

export type DrawerGroup = {
  key: string;
  title: string;
  hint: string;
  tools: DrawerTool[];
};

export function AllToolsButton({ groups }: { groups: DrawerGroup[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // 화면을 옮기면 닫는다 — 열어 둔 채로 이동하면 새 화면 위에 그대로 덮인다.
  //
  // 링크를 눌러 옮길 때는 onClick 이 이미 닫으므로, 여기가 잡는 건 뒤로가기다.
  // useEffect 로 닫지 않는 이유 — 그러면 덮인 화면이 한 번 그려진 다음 사라져
  // 깜빡인다. 렌더 중에 맞추면 그 한 번이 화면에 나가지 않는다.
  // (React 공식 권장 형태: "이전 값과 달라졌으면 렌더 중에 조정")
  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    if (open) setOpen(false);
  }

  // Esc 로 닫고, 닫을 때 포커스를 버튼으로 돌려준다(키보드로 온 사람이
  // 페이지 맨 위로 튕기지 않게).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // 열리면 패널로 포커스를 옮긴다.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="이 기관이 쓸 수 있는 기능 전부"
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#D4E4BC] bg-white px-2.5 py-2 text-xs font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8] sm:text-sm"
      >
        <span aria-hidden>⋯</span>
        <span>전체</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/25"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="모든 기능"
            tabIndex={-1}
            className="fixed inset-x-0 top-[60px] z-50 mx-auto max-h-[calc(100dvh-72px)] max-w-3xl overflow-y-auto rounded-3xl border border-[#E8DDC8] bg-white p-5 shadow-2xl outline-none sm:inset-x-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#2D5A3D]">🧭 모든 기능</h2>
                <p className="mt-0.5 text-[11px] text-[#6B6560]">
                  행사를 열지 않아도 여기서 바로 갑니다
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-xl border border-[#E8DDC8] px-2.5 py-1.5 text-xs font-semibold text-[#6B6560] transition hover:bg-[#F5F1E8]"
              >
                닫기
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {groups.map((g) => (
                <div key={g.key}>
                  <p className="text-[11px] font-bold text-[#6B6560]">
                    {g.title}
                    <span className="ml-1.5 font-normal text-[#8B7F75]">
                      {g.hint}
                    </span>
                  </p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {g.tools.map((t) =>
                      t.locked ? (
                        <li key={t.key}>
                          {/* 눌리는데 아무 일도 안 나는 것이 제일 나쁘다 —
                              홈 카드와 같은 규칙으로 span 이다. */}
                          <span
                            aria-disabled
                            title={t.why ?? "지금은 사용할 수 없어요"}
                            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-dashed border-[#E5DDD0] bg-[#F7F5F2] px-2.5 py-1.5 text-[12px] font-semibold text-[#B0A99F]"
                          >
                            <span aria-hidden>🔒</span>
                            <span className="line-through decoration-[#D8D0C4]">
                              {t.label}
                            </span>
                          </span>
                        </li>
                      ) : (
                        <li key={t.key}>
                          <Link
                            href={t.href}
                            {...(t.newTab
                              ? { target: "_blank", rel: "noopener" }
                              : {})}
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8DDC8] bg-[#FDFBF6] px-2.5 py-1.5 text-[12px] font-semibold text-[#4A4139] transition hover:border-[#2D5A3D] hover:bg-[#E8F0E4] hover:text-[#2D5A3D]"
                          >
                            <span aria-hidden>{t.icon}</span>
                            <span>{t.label}</span>
                            {t.newTab && (
                              <span aria-hidden className="text-[#8B7F75]">
                                ↗
                              </span>
                            )}
                          </Link>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
