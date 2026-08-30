"use client";

// 지사 스위치판 — 도구 24개를 끔 / 켬 / 상단 세 자리로.
//
// 왜 스위치 두 개가 아니라 자리 셋인가:
//   "쓸 수 있나" 와 "상단에 둘까" 를 각각 켜고 끄게 하면 기능당 스위치가 둘,
//   기관 6곳이면 288번을 눌러야 한다. 게다가 **꺼졌는데 상단에 고정** 같은
//   앞뒤 안 맞는 조합이 만들어진다. 한 줄에 자리 셋이면 조합이 애초에 없다.
//   사람이 생각하는 순서와도 같다 — 안 씀 / 씀 / 자주 씀.
//
// 끔이 없는 줄이 있다: 참가자·담당자·서류·기관 설정 같은 코어다. 끄면 기관
// 포털이 통째로 못 쓰게 되므로 자리 자체를 주지 않는다. 상단에는 올릴 수 있다.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ORG_TOOL_GROUPS,
  ORG_TOOL_GROUP_ORDER,
  MAX_PINNED_TOOLS,
  type OrgToolGroup,
} from "@/lib/org-tools/registry";
import type { ToolState } from "@/lib/org-tools/actions";

export type BoardRow = {
  key: string;
  label: string;
  icon: string;
  group: OrgToolGroup;
  featureCode: string | null;
  state: ToolState;
  /** 지사 전체값 — 개별 화면에서 "원래는 ○○" 을 보여준다. */
  partnerState: ToolState;
  partnerHas: boolean;
  /**
   * 전체 화면 : 이 값과 다르게 둔 기관 수
   * 개별 화면 : 1이면 전체값과 다름
   *
   * ⚠ "행이 있으면 개별" 이 아니라 **값이 실제로 다를 때**만 센다. 행 기준으로
   *   세면 마이그레이션이 넣어 둔 행까지 예외로 세어져, 아무도 손대지 않은
   *   기관이 전부 「따로 1」 로 보인다(실제로 그랬다).
   */
  differs: number;
  /** 이 도구와 기능을 공유하는 다른 도구 이름들 — 같이 꺼진다는 걸 말해줘야 한다. */
  siblings: string[];
};

type Result = { ok: true } | { ok: false; message: string };

export function ToolBoard({
  rows,
  scope,
  onSet,
  onClear,
}: {
  rows: BoardRow[];
  /** partner = 전 기관 기본값 · org = 이 기관만 */
  scope: "partner" | "org";
  onSet: (toolKey: string, state: ToolState) => Promise<Result>;
  /** org 스코프에서만 — 개별 설정을 지워 전체값으로 되돌린다. */
  onClear?: (toolKey: string) => Promise<Result>;
}) {
  const pinnedCount = rows.filter((r) => r.state === "pinned").length;

  return (
    <div className="space-y-5">
      {/* 세 자리가 각각 무슨 뜻인지 — 스위치 바로 위에 한 줄. */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-[#F5F1E8] px-3 py-2 text-[11px] text-[#6B6560]">
        <span>
          <b className="text-zinc-600">끔</b> 안 씀 · 참가자 앱에서도 사라짐
        </span>
        <span>
          <b className="text-[#2D5A3D]">켬</b> 「모든 기능」 카드에서 씀
        </span>
        <span>
          <b className="text-amber-600">상단</b> 기관 포털 맨 위 메뉴에도
        </span>
        <span className="ml-auto font-bold text-[#2D5A3D]">
          상단 {pinnedCount}/{MAX_PINNED_TOOLS}
        </span>
      </p>

      {ORG_TOOL_GROUP_ORDER.map((g) => {
        const inGroup = rows.filter((r) => r.group === g);
        if (inGroup.length === 0) return null;
        return (
          <section key={g}>
            <p className="mb-1.5 text-[11px] font-bold text-[#8B7F75]">
              {ORG_TOOL_GROUPS[g].title}
            </p>
            <ul className="space-y-1">
              {inGroup.map((r) => (
                <Row
                  key={r.key}
                  row={r}
                  scope={scope}
                  onSet={onSet}
                  onClear={onClear}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Row({
  row,
  scope,
  onSet,
  onClear,
}: {
  row: BoardRow;
  scope: "partner" | "org";
  onSet: (toolKey: string, state: ToolState) => Promise<Result>;
  onClear?: (toolKey: string) => Promise<Result>;
}) {
  const router = useRouter();
  const [state, setState] = useState<ToolState>(row.state);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const locked = !row.partnerHas;
  const canTurnOff = row.featureCode !== null;

  function pick(next: ToolState) {
    if (locked || pending || next === state) return;
    const prev = state;
    setErr(null);
    setState(next);
    startTransition(async () => {
      const r = await onSet(row.key, next);
      if (!r.ok) {
        setState(prev);
        setErr(r.message);
        return;
      }
      router.refresh();
    });
  }

  function clear() {
    if (!onClear || pending) return;
    setErr(null);
    startTransition(async () => {
      const r = await onClear(row.key);
      if (!r.ok) setErr(r.message);
      else router.refresh();
    });
  }

  return (
    <li
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-3 py-2 ${
        locked
          ? "border-dashed border-[#E5DDD0] bg-[#FAF8F5]"
          : "border-[#E8DDC8] bg-white"
      }`}
    >
      <span className={`text-lg ${locked ? "opacity-40 grayscale" : ""}`} aria-hidden>
        {row.icon}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`text-[13px] font-bold ${
            locked ? "text-[#B0A99F]" : "text-[#2D5A3D]"
          }`}
        >
          {row.label}
        </p>
        {locked ? (
          <p className="text-[10px] font-semibold text-[#B5651D]">
            🔒 본사에서 아직 도입하지 않은 기능
          </p>
        ) : (
          <Note
            row={row}
            scope={scope}
            state={state}
            onClear={onClear ? clear : undefined}
          />
        )}
        {err && (
          <p className="mt-0.5 text-[10px] font-semibold text-rose-600">⚠ {err}</p>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label={`${row.label} 노출 설정`}
        className={`inline-flex shrink-0 overflow-hidden rounded-lg border border-[#E5D3B8] ${
          pending ? "opacity-60" : ""
        }`}
      >
        <Seat
          label="끔"
          on={state === "off"}
          disabled={locked || !canTurnOff}
          tone="off"
          onClick={() => pick("off")}
        />
        <Seat
          label="켬"
          on={state === "on"}
          disabled={locked}
          tone="on"
          onClick={() => pick("on")}
        />
        <Seat
          label="상단"
          on={state === "pinned"}
          disabled={locked}
          tone="pinned"
          onClick={() => pick("pinned")}
        />
      </div>
    </li>
  );
}

const STATE_LABEL: Record<ToolState, string> = {
  off: "끔",
  on: "켬",
  pinned: "상단",
};

/** 이 줄에서 알아야 할 단 한 가지. 없으면 아무것도 안 적는다. */
function Note({
  row,
  scope,
  state,
  onClear,
}: {
  row: BoardRow;
  scope: "partner" | "org";
  state: ToolState;
  onClear?: () => void;
}) {
  // 전체값과 다르면 그게 가장 중요한 사실이다 — 전체값을 바꿔도 안 바뀌니까.
  // 원래 값을 같이 적는다. "되돌리면 무엇이 되나" 를 눌러 보기 전에 알아야 한다.
  if (scope === "org" && row.differs > 0) {
    return (
      <p className="text-[10px] text-[#B5651D]">
        전체값은 <b>{STATE_LABEL[row.partnerState]}</b> — 이 기관만 다르게 둠
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="ml-1.5 font-semibold text-[#2D5A3D] underline-offset-2 hover:underline"
          >
            되돌리기
          </button>
        )}
      </p>
    );
  }
  if (scope === "org") {
    return <p className="text-[10px] text-[#B5AA9E]">전체값과 같아요</p>;
  }
  // 전체 화면 — 이 값을 안 따르는 기관이 있으면 말해야 한다.
  if (row.differs > 0) {
    return (
      <p className="text-[10px] text-[#B5651D]">
        기관 {row.differs}곳은 다르게 설정돼 있어 안 바뀌어요
      </p>
    );
  }
  // 같은 기능을 쓰는 도구가 있으면 끌 때 같이 꺼진다.
  if (state !== "off" && row.siblings.length > 0) {
    return (
      <p className="text-[10px] text-[#B5AA9E]">
        끄면 {row.siblings.join(" · ")}도 같이 꺼져요
      </p>
    );
  }
  return null;
}

function Seat({
  label,
  on,
  disabled,
  tone,
  onClick,
}: {
  label: string;
  on: boolean;
  disabled: boolean;
  tone: "off" | "on" | "pinned";
  onClick: () => void;
}) {
  const active =
    tone === "off"
      ? "bg-zinc-500 text-white"
      : tone === "on"
        ? "bg-[#2D5A3D] text-white"
        : "bg-amber-500 text-white";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`px-2.5 py-1.5 text-[11px] font-bold transition ${
        on ? active : "bg-white text-[#8B7F75] hover:bg-[#F5F1E8]"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {label}
    </button>
  );
}
