"use client";

// 참가자 탭 [참석] 배지 — 눌러서 바로 고친다.
//
// 인원은 신청 이후에도 계속 바뀐다("한 명 더 가요"). 그때마다 보호자에게
// 신청서를 다시 내게 하면 승인이 풀렸다 붙었다 하고, 기관은 그 사이 간식·버스
// 수량을 확정하지 못한다. 전화 한 통으로 끝날 일은 여기서 끝나야 한다.
//
// 총원은 입력받지 않는다 — 구성의 합으로만 만든다(어긋난 행을 만들 수 없게).
//
// 편집 카드를 body 로 portal 하는 이유:
//   이 배지는 스크롤되는 표(overflow-hidden + overflow-x-auto) 안에 있다.
//   같은 자리에 절대 위치로 띄우면 표 경계에서 잘려, 아래쪽 행일수록 카드가
//   안 보인다. 화면 좌표로 계산해 body 에 띄우면 어떤 컨테이너에도 갇히지 않는다.

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { updateEventPartyCountsAction } from "./users/actions";
import { MAX_APPLICATION_PARTY_SIZE } from "@/lib/org-events/types";
import type { EventPartyCount } from "@/lib/org-events/application-queries";

type Row = { key: "child" | "adult" | "senior"; icon: string; label: string };

const ROWS: Row[] = [
  { key: "child", icon: "👶", label: "유아" },
  { key: "adult", icon: "🧑", label: "성인" },
  { key: "senior", icon: "👴", label: "조부모" },
];

const PANEL_W = 224;
const PANEL_H = 260;
const MARGIN = 8;

/** 버튼 위치 → 카드가 화면 밖으로 나가지 않는 좌표. 아래가 좁으면 위로 뒤집는다. */
function placeNear(el: HTMLElement): { top: number; left: number } {
  const r = el.getBoundingClientRect();
  const below = window.innerHeight - r.bottom;
  const top =
    below >= PANEL_H + MARGIN
      ? r.bottom + 4
      : Math.max(MARGIN, r.top - PANEL_H - 4);
  const left = Math.min(
    Math.max(MARGIN, r.right - PANEL_W),
    window.innerWidth - PANEL_W - MARGIN
  );
  return { top, left };
}

export function PartyCountEditor({
  orgId,
  eventId,
  userId,
  displayName,
  current,
  variant = "table",
}: {
  orgId: string;
  eventId: string;
  userId: string;
  displayName: string;
  /** 없거나 0/0/0 이면 "구성 모름"(관리자 직접 등록분) — 그래도 고칠 수 있다. */
  current: EventPartyCount | undefined;
  variant?: "table" | "card";
}) {
  const router = useRouter();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [child, setChild] = useState(current?.child_count ?? 0);
  const [adult, setAdult] = useState(current?.adult_count ?? 0);
  const [senior, setSenior] = useState(current?.senior_count ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const open = pos !== null;

  // 열려 있는 동안 표를 스크롤하거나 창 크기를 바꾸면 카드가 버튼에서 떨어진다.
  // 닫아버리면 입력하던 값이 날아가므로 따라 움직이게 한다.
  useEffect(() => {
    if (!open) return;
    const follow = () => {
      if (btnRef.current) setPos(placeNear(btnRef.current));
    };
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open]);

  const known = child > 0 || adult > 0 || senior > 0;
  const total = child + adult + senior;

  const badge = (() => {
    const c = current?.child_count ?? 0;
    const a = current?.adult_count ?? 0;
    const s = current?.senior_count ?? 0;
    if (c === 0 && a === 0 && s === 0) return null;
    const parts = [`👶${c}`, `🧑${a}`];
    if (s > 0) parts.push(`👴${s}`);
    return parts.join("·");
  })();

  function openEditor() {
    // 열 때마다 서버 값으로 되돌린다 — 취소하고 다시 열었을 때 옛 입력이 남지 않게.
    setChild(current?.child_count ?? 0);
    setAdult(current?.adult_count ?? 0);
    setSenior(current?.senior_count ?? 0);
    setError(null);
    if (btnRef.current) setPos(placeNear(btnRef.current));
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await updateEventPartyCountsAction(orgId, eventId, userId, {
        childCount: child,
        adultCount: adult,
        seniorCount: senior,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setPos(null);
      router.refresh();
    });
  }

  const value = { child, adult, senior };
  const setValue = { child: setChild, adult: setAdult, senior: setSenior };

  const panel = pos ? (
    <>
      {/* 바깥을 눌러 닫기 */}
      <button
        type="button"
        aria-label="닫기"
        onClick={() => setPos(null)}
        className="fixed inset-0 z-[60] cursor-default bg-black/10"
      />
      <div
        role="dialog"
        aria-label={`${displayName} 참석 인원`}
        style={{ top: pos.top, left: pos.left, width: PANEL_W }}
        className="fixed z-[61] rounded-2xl border-2 border-[#D4E4BC] bg-white p-3 text-left shadow-xl"
      >
        <p className="mb-2 truncate text-[11px] font-bold text-[#2D5A3D]">
          👨‍👩‍👧 {displayName} 참석 인원
        </p>

        <div className="space-y-1.5">
          {ROWS.map((r) => (
            <div key={r.key} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] font-semibold text-[#4A4340]">
                <span aria-hidden>{r.icon}</span> {r.label}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setValue[r.key](Math.max(0, value[r.key] - 1))}
                  disabled={pending || value[r.key] <= 0}
                  aria-label={`${r.label} 한 명 줄이기`}
                  className="h-7 w-7 rounded-lg border border-[#D4E4BC] bg-white text-sm font-bold leading-none text-[#2D5A3D] disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-extrabold tabular-nums text-[#2D5A3D]">
                  {value[r.key]}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setValue[r.key](
                      Math.min(MAX_APPLICATION_PARTY_SIZE, value[r.key] + 1)
                    )
                  }
                  disabled={pending || total >= MAX_APPLICATION_PARTY_SIZE}
                  aria-label={`${r.label} 한 명 늘리기`}
                  className="h-7 w-7 rounded-lg border border-[#D4E4BC] bg-white text-sm font-bold leading-none text-[#2D5A3D] disabled:opacity-30"
                >
                  ＋
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 총원은 합으로만 — 따로 입력받지 않는다. */}
        <p className="mt-2 rounded-xl bg-[#F5F1E8] px-2 py-1.5 text-center text-xs font-extrabold tabular-nums text-[#2D5A3D]">
          총 {total}명
        </p>

        {error && (
          <p className="mt-1.5 text-[10px] font-semibold text-rose-700">
            {error}
          </p>
        )}
        {!known && (
          <p className="mt-1.5 text-[10px] text-[#8B7F75]">
            최소 1명이어야 저장할 수 있어요.
          </p>
        )}

        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            onClick={() => setPos(null)}
            disabled={pending}
            className="flex-1 rounded-xl border border-[#D4E4BC] bg-white py-1.5 text-[11px] font-bold text-[#6B6560] disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !known}
            className="flex-1 rounded-xl bg-[#2D5A3D] py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
          >
            {pending ? "저장 중" : "저장"}
          </button>
        </div>
      </div>
    </>
  ) : null;

  return (
    <span className={variant === "table" ? "inline-block" : "block"}>
      <button
        ref={btnRef}
        type="button"
        onClick={openEditor}
        title={
          badge
            ? `총 ${current?.party_size ?? total}명 — 눌러서 수정`
            : "참석 인원을 몰라요. 눌러서 입력"
        }
        aria-label={`${displayName} 참석 인원 수정`}
        aria-expanded={open}
        className={
          badge
            ? "inline-flex items-center gap-0.5 rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[#2D5A3D] transition hover:bg-[#D4E4BC]"
            : "inline-flex items-center rounded-full border border-dashed border-[#D4E4BC] px-2 py-0.5 text-[10px] font-semibold text-[#B0A89D] transition hover:border-[#2D5A3D] hover:text-[#2D5A3D]"
        }
      >
        {badge ?? "＋ 인원"}
      </button>

      {/* SSR 에는 document 가 없다. 열렸을 때만(=클릭 후) portal 하므로 안전. */}
      {panel && typeof document !== "undefined"
        ? createPortal(panel, document.body)
        : null}
    </span>
  );
}
