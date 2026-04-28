"use client";

// 행사 프로그램 탭 — /org/[orgId]/programs standalone 페이지와 동일한 가로 row 레이아웃을
// 행사 단위로 재사용. 이 행사에 연결된 프로그램만 표시. 행사제외 / 편집 + 일괄 추가 지원.

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import {
  setEventProgramsAction,
  removeProgramFromEventAction,
} from "@/lib/org-events/actions";

type ProgramStatus = "ACTIVATED" | "CUSTOMIZED" | "PUBLISHED" | "PAUSED";

export type ProgramOption = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  status: ProgramStatus;
  price_per_person: number;
  duration_hours: number | null;
  image_url: string | null;
};

type Props = {
  eventId: string;
  orgId: string;
  allPrograms: ProgramOption[];
  initialSelectedIds: string[];
};

type StatusFilter = "ALL" | ProgramStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "ACTIVATED", label: "✨ 활성화" },
  { key: "CUSTOMIZED", label: "✏️ 수정중" },
  { key: "PUBLISHED", label: "📢 공개중" },
  { key: "PAUSED", label: "⏸️ 일시정지" },
];

const STATUS_CHIP: Record<
  ProgramStatus,
  { label: string; icon: string; color: string }
> = {
  ACTIVATED: {
    label: "활성화",
    icon: "✨",
    color: "bg-sky-50 text-sky-800 border-sky-200",
  },
  CUSTOMIZED: {
    label: "수정중",
    icon: "✏️",
    color: "bg-amber-50 text-amber-800 border-amber-200",
  },
  PUBLISHED: {
    label: "공개중",
    icon: "📢",
    color: "bg-emerald-500 text-white border-emerald-500",
  },
  PAUSED: {
    label: "일시정지",
    icon: "⏸️",
    color: "bg-zinc-50 text-zinc-700 border-zinc-200",
  },
};

const CATEGORY_LABEL: Record<string, { label: string; icon: string }> = {
  FOREST: { label: "숲체험", icon: "🌲" },
  CAMPING: { label: "캠핑", icon: "⛺" },
  KIDS: { label: "어린이", icon: "🧸" },
  FAMILY: { label: "가족", icon: "👨‍👩‍👧" },
  TEAM: { label: "팀빌딩", icon: "🤝" },
  ART: { label: "예술", icon: "🎨" },
};

function formatWon(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return `${Number(n).toLocaleString("ko-KR")}원`;
}

export function ProgramsTab({
  eventId,
  orgId,
  allPrograms,
  initialSelectedIds,
}: Props) {
  const router = useRouter();

  const eventProgramIds = useMemo(
    () => new Set(initialSelectedIds),
    [initialSelectedIds]
  );

  const inEvent = useMemo(
    () => allPrograms.filter((p) => eventProgramIds.has(p.id)),
    [allPrograms, eventProgramIds]
  );
  const notInEvent = useMemo(
    () => allPrograms.filter((p) => !eventProgramIds.has(p.id)),
    [allPrograms, eventProgramIds]
  );

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const filteredInEvent = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inEvent.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${p.title ?? ""} ${p.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [inEvent, statusFilter, query]);

  // 행사제외 (단일)
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [, startRemoveTransition] = useTransition();

  function onRemoveFromEvent(programId: string, title: string): void {
    if (removingId) return;
    const ok = window.confirm(
      `[${title || "(이름 없음)"}] 프로그램을 이 행사에서 제외할까요?\n\n` +
        `이 행사에서만 빠지고, 프로그램 자체와 다른 행사 연결은 유지돼요.`
    );
    if (!ok) return;
    setRemoveError(null);
    setRemovingId(programId);
    startRemoveTransition(async () => {
      try {
        await removeProgramFromEventAction(eventId, programId);
        router.refresh();
      } catch (err) {
        setRemoveError(err instanceof Error ? err.message : "행사제외 실패");
      } finally {
        setRemovingId(null);
      }
    });
  }

  // 하단 접이식: 다른 프로그램 일괄 추가
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkQuery, setBulkQuery] = useState("");
  const [bulkStatus, setBulkStatus] = useState<StatusFilter>("ALL");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSavedAt, setBulkSavedAt] = useState<number | null>(null);
  const [bulkPending, startBulkTransition] = useTransition();

  useEffect(() => {
    if (bulkSavedAt == null) return;
    const t = setTimeout(() => setBulkSavedAt(null), 2000);
    return () => clearTimeout(t);
  }, [bulkSavedAt]);

  const filteredNotInEvent = useMemo(() => {
    const q = bulkQuery.trim().toLowerCase();
    return notInEvent.filter((p) => {
      if (bulkStatus !== "ALL" && p.status !== bulkStatus) return false;
      if (!q) return true;
      const hay = `${p.title ?? ""} ${p.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [notInEvent, bulkStatus, bulkQuery]);

  function toggleBulk(id: string): void {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInBulkView(): void {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      for (const r of filteredNotInEvent) next.add(r.id);
      return next;
    });
  }

  function clearBulk(): void {
    setBulkSelected(new Set());
  }

  function onBulkAdd(): void {
    if (bulkSelected.size === 0 || bulkPending) return;
    setBulkError(null);
    const nextIds = Array.from(
      new Set([...initialSelectedIds, ...Array.from(bulkSelected)])
    );
    startBulkTransition(async () => {
      try {
        await setEventProgramsAction(eventId, nextIds);
        setBulkSavedAt(Date.now());
        setBulkSelected(new Set());
        router.refresh();
      } catch (err) {
        setBulkError(err instanceof Error ? err.message : "추가에 실패했어요");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#2D5A3D] md:text-xl">
            <span aria-hidden>🗂️</span>
            <span>이 행사 프로그램</span>
            <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-xs text-[#2D5A3D]">
              {inEvent.length}
            </span>
          </h2>
          <p className="mt-1 text-xs text-[#6B6560]">
            이 행사에서 운영할 프로그램이에요. 새로 활성화하거나 기존
            프로그램을 연결할 수 있어요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/org/${orgId}/templates`}
            className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
          >
            📋 템플릿 둘러보기
          </Link>
          <Link
            href={`/org/${orgId}/programs`}
            className="rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#4A7C59] px-3 py-2 text-xs font-bold text-white hover:opacity-90"
          >
            🗂 내 프로그램 전체
          </Link>
        </div>
      </header>

      {/* 상태 탭 + 검색 */}
      <div className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((tab) => {
            const isActive = tab.key === statusFilter;
            const count =
              tab.key === "ALL"
                ? inEvent.length
                : inEvent.filter((p) => p.status === tab.key).length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                    : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D] hover:text-[#2D5A3D]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    isActive ? "bg-white/20" : "bg-[#F5F1E8]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
          <input
            type="search"
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setQuery(e.target.value)
            }
            placeholder="🔍 프로그램 이름/설명 검색"
            className="ml-auto w-full max-w-[260px] rounded-lg border border-[#E5D3B8] bg-white px-3 py-1.5 text-xs text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
          />
        </div>
      </div>

      {removeError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
        >
          ⚠️ {removeError}
        </div>
      )}

      {/* 프로그램 row 리스트 */}
      {filteredInEvent.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            {inEvent.length === 0 ? "🌱" : "🔍"}
          </div>
          <p className="mt-3 text-sm font-bold text-[#2D5A3D]">
            {inEvent.length === 0
              ? "이 행사에 연결된 프로그램이 없어요"
              : "조건에 맞는 프로그램이 없어요"}
          </p>
          <p className="mt-1 max-w-sm text-xs text-[#6B6560]">
            {inEvent.length === 0
              ? "[📋 템플릿 둘러보기] 에서 활성화하거나, 아래에서 기관에 있는 프로그램을 골라 연결하세요."
              : "다른 상태나 검색어로 시도해 보세요."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {filteredInEvent.map((p) => {
            const meta = STATUS_CHIP[p.status];
            const cat = CATEGORY_LABEL[p.category] ?? {
              label: p.category,
              icon: "📦",
            };
            const isRemoving = removingId === p.id;
            return (
              <li
                key={p.id}
                className="flex flex-col gap-4 rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm sm:flex-row"
              >
                {/* 이미지 */}
                <div className="h-32 w-full shrink-0 overflow-hidden rounded-xl bg-[#E8F0E4] sm:h-28 sm:w-32">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl">
                      🌲
                    </div>
                  )}
                </div>

                {/* 메인 */}
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}
                    >
                      {meta.icon} {meta.label}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                      {cat.icon} {cat.label}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#2C2C2C]">
                    {p.title || "(이름 없음)"}
                  </h3>
                  {p.description && (
                    <p className="line-clamp-2 text-xs text-[#6B6560]">
                      {p.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B6560]">
                    <span>💰 {formatWon(p.price_per_person)}</span>
                    {p.duration_hours != null && (
                      <span>⏱ {p.duration_hours}시간</span>
                    )}
                  </div>
                </div>

                {/* 액션 */}
                <div className="flex shrink-0 flex-wrap items-start gap-2 sm:flex-col">
                  <Link
                    href={`/org/${orgId}/programs/${p.id}/edit`}
                    className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#4A7C59] px-3 py-2 text-xs font-bold text-white hover:opacity-90"
                  >
                    ✏️ 편집
                  </Link>
                  <button
                    type="button"
                    onClick={() => onRemoveFromEvent(p.id, p.title)}
                    disabled={isRemoving}
                    title="이 행사에서만 제외 (프로그램 자체는 보존)"
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isRemoving ? "⏳" : "🚫"} 행사제외
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* 하단 접이식 — 다른 프로그램 추가 */}
      {notInEvent.length > 0 && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
          <details className="group" open={false}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-[#FAE7D0] via-white to-[#E8F0E4] p-4">
              <div className="flex items-center gap-2 text-[#2D5A3D]">
                <span aria-hidden className="text-xl">
                  ➕
                </span>
                <div>
                  <p className="text-sm font-bold">
                    기관에 있는 다른 프로그램 추가
                  </p>
                  <p className="text-[11px] text-[#6B6560]">
                    이 행사에 아직 연결되지 않은 프로그램 {notInEvent.length}개를
                    한꺼번에 골라 연결할 수 있어요.
                  </p>
                </div>
              </div>
              <span
                aria-hidden
                className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#2D5A3D] shadow-sm transition group-open:rotate-180"
              >
                ▼
              </span>
            </summary>

            <div className="space-y-3 border-t border-[#D4E4BC] p-4">
              <div className="flex flex-wrap items-center gap-2">
                {STATUS_FILTERS.map((tab) => {
                  const isActive = tab.key === bulkStatus;
                  const count =
                    tab.key === "ALL"
                      ? notInEvent.length
                      : notInEvent.filter((p) => p.status === tab.key).length;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setBulkStatus(tab.key)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                        isActive
                          ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                          : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D] hover:text-[#2D5A3D]"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className="text-[10px] opacity-80">{count}</span>
                    </button>
                  );
                })}
                <input
                  type="search"
                  value={bulkQuery}
                  onChange={(e) => setBulkQuery(e.target.value)}
                  placeholder="🔍 검색"
                  className="ml-auto w-full max-w-[200px] rounded-lg border border-[#E5D3B8] bg-white px-3 py-1.5 text-xs text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
                />
              </div>

              {bulkError && (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
                >
                  ⚠️ {bulkError}
                </div>
              )}
              {bulkSavedAt != null && (
                <div
                  role="status"
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"
                >
                  ✅ 추가됐어요
                </div>
              )}

              {filteredNotInEvent.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-3 py-4 text-center text-xs text-[#6B6560]">
                  조건에 맞는 후보가 없어요.
                </p>
              ) : (
                <ul className="grid max-h-[28rem] gap-2 overflow-y-auto sm:grid-cols-2">
                  {filteredNotInEvent.map((p) => {
                    const meta = STATUS_CHIP[p.status];
                    const cat = CATEGORY_LABEL[p.category] ?? {
                      label: p.category,
                      icon: "📦",
                    };
                    const isChecked = bulkSelected.has(p.id);
                    return (
                      <li key={p.id}>
                        <label
                          className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition ${
                            isChecked
                              ? "border-emerald-500 bg-emerald-50/50"
                              : "border-[#F0E8D8] bg-[#FFFDF8] hover:bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleBulk(p.id)}
                            className="mt-0.5 h-4 w-4 rounded border-[#D4E4BC] text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1">
                              <span
                                className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${meta.color}`}
                              >
                                {meta.icon} {meta.label}
                              </span>
                              <span className="rounded-full bg-[#E8F0E4] px-1.5 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                                {cat.icon} {cat.label}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs font-bold text-[#2D5A3D]">
                              {p.title || "(이름 없음)"}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[#6B6560]">
                              💰 {formatWon(p.price_per_person)}
                              {p.duration_hours != null &&
                                ` · ⏱ ${p.duration_hours}시간`}
                            </p>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-xs text-[#6B6560]">
                  선택{" "}
                  <b className="text-[#2D5A3D]">
                    {bulkSelected.size.toLocaleString("ko-KR")}개
                  </b>
                </span>
                <button
                  type="button"
                  onClick={clearBulk}
                  disabled={bulkSelected.size === 0}
                  className="rounded-lg border border-[#E5D3B8] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B4423] hover:bg-[#FFF8F0] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  전체 해제
                </button>
                <button
                  type="button"
                  onClick={selectAllInBulkView}
                  disabled={filteredNotInEvent.length === 0}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  보이는 항목 전체 선택
                </button>
                <button
                  type="button"
                  onClick={onBulkAdd}
                  disabled={bulkSelected.size === 0 || bulkPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2 text-xs font-bold text-white shadow-sm hover:from-[#234a30] hover:to-[#2D5A3D] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span aria-hidden>{bulkPending ? "⏳" : "➕"}</span>
                  <span>
                    {bulkPending ? "추가 중..." : "이 행사에 추가"}
                  </span>
                </button>
              </div>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
