"use client";

// AcornGuideButton — 기관 포털 상단 nav 의 [🌰 도토리 배점] 버튼.
//
// 왜 상단에 있나:
//   행사장에서 보호자가 제일 많이 묻는 것이 "이거 하면 도토리 몇 개예요?" 와
//   "왜 저 집이 우리보다 위예요?" 다. 담당자가 그때마다 미션 설정 화면을 열어
//   하나씩 세고 있을 수는 없다. 어느 화면에 있든 한 번 눌러 읽어 주면 끝나야 한다.
//
// 왜 숫자를 손으로 안 적나:
//   배점은 미션 설정에서, 등수 규칙은 lib/scoring/core.ts 상수에서 뽑는다.
//   안내문을 따로 적어 두면 미션을 고쳤을 때 같이 안 고쳐지고, 그러면 화면에는
//   "+2" 라고 적혀 있는데 실제로는 +3 이 들어오는 가장 나쁜 안내가 남는다.
//
// 서버 컴포넌트가 아닌 이유: 팝오버 열고 닫기가 필요하다. 데이터는 이미 만들어진
// 것을 prop 으로 받으므로 조회는 서버에서 한 번만 일어난다.

import { useEffect, useRef, useState } from "react";
import {
  SCORE_RULE_NOTES,
  type AcornScoreGuide,
} from "@/lib/scoring/guide-core";

interface Props {
  guide: AcornScoreGuide;
}

const STATUS_LABEL: Record<string, string> = {
  LIVE: "진행중",
  DRAFT: "예정",
  ENDED: "종료",
  ARCHIVED: "보관",
};

const TONE: Record<string, string> = {
  base: "text-[#2D5A3D]",
  bonus: "text-emerald-700",
  penalty: "text-rose-700",
};

export function AcornGuideButton({ guide }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 바깥을 누르면 닫힌다. 상단 nav 의 팝오버라 안 닫히면 다음 메뉴를 가린다.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="도토리 배점과 등수 규칙"
        className={`ml-1 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition ${
          open
            ? "border-[#C9A227] bg-[#FBEFC8] text-[#6B4423] shadow-sm"
            : "border-[#E5D3B8] bg-[#FFFBEF] text-[#6B4423] hover:bg-[#FBEFC8]"
        }`}
      >
        <span aria-hidden>🌰</span>
        <span>도토리 배점</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="도토리 배점표"
          className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-[23rem] overflow-y-auto rounded-2xl border border-[#E5D3B8] bg-white shadow-xl"
        >
          <div className="border-b border-[#E8DDC8] bg-[#FFFBEF] px-4 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-[#6B4423]">
              <span aria-hidden>🌰</span>
              <span>도토리 배점표</span>
            </p>
            <p className="mt-0.5 text-[11px] text-[#6B6560]">
              {guide.eventName ? (
                <>
                  <b>{guide.eventName}</b>
                  {guide.eventStatus && (
                    <span className="ml-1">
                      ({STATUS_LABEL[guide.eventStatus] ?? guide.eventStatus})
                    </span>
                  )}{" "}
                  기준이에요.
                </>
              ) : (
                "지금 켜져 있는 미션 설정에서 자동으로 만들어져요."
              )}
            </p>
          </div>

          {/* 1) 도토리 받는 법 */}
          <section className="px-4 py-3">
            <p className="mb-1.5 text-[11px] font-bold text-[#8B7F75]">
              어떻게 하면 도토리를 받나요
            </p>
            {guide.earn.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#E5DDD0] bg-[#FAF8F5] px-3 py-4 text-center text-[11px] text-[#6B6560]">
                아직 켜 둔 미션이 없어요. 스탬프북에 미션을 추가하면 여기에
                자동으로 나타나요.
              </p>
            ) : (
              <ul className="space-y-1">
                {guide.earn.map((it, i) => (
                  <li
                    key={`${it.label}-${i}`}
                    className="flex items-center gap-2 rounded-xl bg-[#FAF8F5] px-3 py-2"
                  >
                    <span className="text-base" aria-hidden>
                      {it.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#2D5A3D]">
                      {it.label}
                    </span>
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-[#6B4423]">
                      {it.detail}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 2) 등수 규칙 — 도토리와 다른 값이라는 걸 여기서 처음 말한다 */}
          <section className="border-t border-[#E8DDC8] bg-[#FFFDF8] px-4 py-3">
            <p className="mb-1.5 text-[11px] font-bold text-[#8B7F75]">
              등수는 이렇게 갈려요
            </p>
            <ul className="space-y-1">
              {guide.rules.map((r) => (
                <li key={r.label} className="flex items-start gap-2">
                  <span className="mt-0.5 text-sm" aria-hidden>
                    {r.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`text-[12px] font-bold ${TONE[r.tone] ?? TONE.base}`}
                    >
                      {r.label}
                    </span>
                    <span className="ml-1.5 text-[11px] text-[#6B6560]">
                      {r.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            {/* 문구를 여기 적지 않는 이유는 숫자와 같다 — 규칙이 바뀌면 같이
                바뀌어야 한다. guide-core 가 갖는다. */}
            <ul className="mt-2 space-y-0.5 rounded-xl bg-[#F5F1E8] px-3 py-2">
              {SCORE_RULE_NOTES.map((n) => (
                <li key={n} className="text-[11px] text-[#6B6560]">
                  💡 {n}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
