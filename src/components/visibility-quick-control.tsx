"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export type VisibilityValue = "DRAFT" | "ALL" | "SELECTED" | "ARCHIVED";

interface OrgOption {
  id: string;
  name: string;
  type?: string | null;
  phone?: string | null;
}

interface Props {
  resourceId: string;
  currentVisibility: VisibilityValue;
  initialAssignedOrgIds: string[];
  availableOrgs: OrgOption[];
  updateVisibilityAction: (id: string, v: VisibilityValue) => Promise<void>;
  setAssignmentsAction: (id: string, orgIds: string[]) => Promise<void>;
  editHref: string;
}

interface ChipDef {
  key: string;
  label: string;
  icon: string;
  targetValue: VisibilityValue; // 클릭 시 DB에 쓸 값
  matches: VisibilityValue[];   // 이 값들 중 하나면 active
  chipClass: string;
  activeClass: string;
}

const CHIPS: ChipDef[] = [
  {
    key: "SELECTED",
    label: "선택",
    icon: "🎯",
    targetValue: "SELECTED",
    matches: ["SELECTED"],
    chipClass: "border-sky-200 bg-white text-sky-700",
    activeClass: "border-sky-500 bg-sky-50 text-sky-900 ring-1 ring-sky-400",
  },
  {
    key: "ALL",
    label: "전체",
    icon: "🌍",
    targetValue: "ALL",
    matches: ["ALL"],
    chipClass: "border-emerald-200 bg-white text-emerald-700",
    activeClass:
      "border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-400",
  },
  {
    key: "HIDDEN",
    label: "비노출",
    icon: "🚫",
    targetValue: "DRAFT",
    matches: ["DRAFT", "ARCHIVED"],
    chipClass: "border-zinc-200 bg-white text-zinc-700",
    activeClass: "border-zinc-500 bg-zinc-100 text-zinc-900 ring-1 ring-zinc-400",
  },
];

export function VisibilityQuickControl({
  resourceId,
  currentVisibility,
  initialAssignedOrgIds,
  availableOrgs,
  updateVisibilityAction,
  setAssignmentsAction,
  editHref,
}: Props) {
  const [visibility, setVisibility] = useState<VisibilityValue>(currentVisibility);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(
    new Set(initialAssignedOrgIds)
  );
  const [expanded, setExpanded] = useState(currentVisibility === "SELECTED");
  const [search, setSearch] = useState("");
  const [visStatus, setVisStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [assignStatus, setAssignStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visSaveRef = useRef<VisibilityValue>(currentVisibility);

  // fire-and-forget: router.refresh 없이 서버 액션만 호출 (revalidatePath가 처리)
  const handleVisibilityChange = (next: VisibilityValue) => {
    if (next === visibility) return;
    setVisibility(next);
    if (next === "SELECTED") setExpanded(true);
    else setExpanded(false);
    setVisStatus("saving");

    // 최신 클릭만 반영 (연속 클릭 시 race 방지)
    visSaveRef.current = next;
    const myTarget = next;
    updateVisibilityAction(resourceId, next)
      .then(() => {
        if (visSaveRef.current === myTarget) {
          setVisStatus("saved");
          setTimeout(() => setVisStatus("idle"), 1200);
        }
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("NEXT_REDIRECT")) {
          alert(`변경 실패: ${msg}`);
          setVisibility(currentVisibility);
        }
        setVisStatus("idle");
      });
  };

  const syncAssignments = (newSet: Set<string>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setAssignStatus("saving");
    debounceRef.current = setTimeout(() => {
      setAssignmentsAction(resourceId, Array.from(newSet))
        .then(() => {
          setAssignStatus("saved");
          setTimeout(() => setAssignStatus("idle"), 1500);
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes("NEXT_REDIRECT")) {
            alert(`기관 할당 저장 실패: ${msg}`);
          }
          setAssignStatus("idle");
        });
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const toggleOrg = (orgId: string) => {
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      syncAssignments(next);
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set(availableOrgs.map((o) => o.id));
    setAssignedIds(all);
    syncAssignments(all);
  };

  const clearAll = () => {
    const empty = new Set<string>();
    setAssignedIds(empty);
    syncAssignments(empty);
  };

  const filteredOrgs = search
    ? availableOrgs.filter((o) => o.name.includes(search))
    : availableOrgs;

  const showWarning = visibility === "SELECTED" && assignedIds.size === 0;

  return (
    <div className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0]/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold text-[#8B7F75]">
          📡 배포 대상
          {visStatus === "saving" && (
            <span className="ml-1 text-[9px] text-[#8B6B3F]">⏳</span>
          )}
          {visStatus === "saved" && (
            <span className="ml-1 text-[9px] text-emerald-700">✅</span>
          )}
        </p>
        {visibility === "SELECTED" && !showWarning && (
          <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
            🎯 기관 {assignedIds.size}개
          </span>
        )}
        {showWarning && (
          <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
            ⚠️ 기관 미지정
          </span>
        )}
      </div>

      {/* 3개 칩 버튼 (선택 / 전체 / 비노출) */}
      <div className="flex flex-wrap gap-1">
        {CHIPS.map((chip) => {
          const isActive = chip.matches.includes(visibility);
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => handleVisibilityChange(chip.targetValue)}
              className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
                isActive
                  ? chip.activeClass
                  : `${chip.chipClass} hover:border-[#2D5A3D]`
              }`}
              aria-pressed={isActive}
            >
              <span>{chip.icon}</span>
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* SELECTED 펼침: 기관 피커 */}
      {expanded && visibility === "SELECTED" && (
        <div className="mt-3 space-y-2 rounded-lg border border-sky-200 bg-white p-2">
          <div className="flex items-center gap-1.5">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="기관 검색..."
              className="flex-1 rounded-md border border-[#D4E4BC] bg-white px-2 py-1 text-[11px] focus:border-[#2D5A3D] focus:outline-none"
            />
            <button
              type="button"
              onClick={selectAll}
              className="rounded-md border border-[#D4E4BC] bg-white px-2 py-1 text-[10px] font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              전체
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-md border border-[#D4E4BC] bg-white px-2 py-1 text-[10px] font-semibold text-[#6B6560] hover:bg-[#F5F1E8]"
            >
              해제
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto">
            {filteredOrgs.length === 0 ? (
              <p className="px-2 py-3 text-center text-[11px] text-[#8B7F75]">
                {availableOrgs.length === 0
                  ? "기관이 없어요. 기관 CRM에서 먼저 등록하세요."
                  : "검색 결과 없음"}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-1">
                {filteredOrgs.map((o) => {
                  const checked = assignedIds.has(o.id);
                  return (
                    <label
                      key={o.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] transition ${
                        checked
                          ? "border-sky-400 bg-sky-50 text-sky-900"
                          : "border-[#D4E4BC] bg-white text-[#2C2C2C] hover:bg-[#F5F1E8]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOrg(o.id)}
                        className="h-3.5 w-3.5 accent-[#2D5A3D]"
                      />
                      <span className="truncate font-semibold">{o.name}</span>
                      {o.type && (
                        <span className="ml-auto shrink-0 text-[9px] text-[#8B7F75]">
                          {o.type}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[#D4E4BC] pt-1.5">
            <span className="text-[10px] text-[#8B7F75]">
              {assignStatus === "saving" && "⏳ 저장 중..."}
              {assignStatus === "saved" && "✅ 저장됨"}
              {assignStatus === "idle" && `${assignedIds.size}개 선택됨`}
            </span>
            <Link
              href={editHref}
              className="text-[10px] font-semibold text-sky-700 hover:underline"
            >
              편집 페이지 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
