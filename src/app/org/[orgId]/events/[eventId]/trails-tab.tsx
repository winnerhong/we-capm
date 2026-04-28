"use client";

// 행사 숲길 탭 — /org/[orgId]/trails standalone 페이지와 동일한 4-col 카드 그리드를
// 행사 단위로 재사용. 이 행사에 연결된 숲길만 표시. 행사제외 / QR / 공유 + 일괄 추가 지원.

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
  setEventTrailsAction,
  removeTrailFromEventAction,
} from "@/lib/org-events/actions";

type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type TrailOption = {
  id: string;
  name: string;
  description: string | null;
  difficulty: Difficulty;
  estimated_minutes: number | null;
  total_slots: number;
  cover_image_url: string | null;
  slug: string | null;
};

type Props = {
  eventId: string;
  orgId: string;
  allTrails: TrailOption[];
  initialSelectedIds: string[];
};

type DifficultyFilter = "ALL" | Difficulty;

const DIFFICULTY_FILTERS: { key: DifficultyFilter; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "EASY", label: "🌱 쉬움" },
  { key: "MEDIUM", label: "🌿 보통" },
  { key: "HARD", label: "🌲 어려움" },
];

const DIFFICULTY_CHIP: Record<
  Difficulty,
  { label: string; icon: string; color: string }
> = {
  EASY: {
    label: "쉬움",
    icon: "🌱",
    color: "bg-[#F5F1E8] text-[#2D5A3D] border-[#D4E4BC]",
  },
  MEDIUM: {
    label: "보통",
    icon: "🌿",
    color: "bg-amber-50 text-amber-800 border-amber-200",
  },
  HARD: {
    label: "어려움",
    icon: "🌲",
    color: "bg-rose-50 text-rose-800 border-rose-200",
  },
};

export function TrailsTab({
  eventId,
  orgId,
  allTrails,
  initialSelectedIds,
}: Props) {
  const router = useRouter();

  const eventTrailIds = useMemo(
    () => new Set(initialSelectedIds),
    [initialSelectedIds]
  );

  const inEvent = useMemo(
    () => allTrails.filter((t) => eventTrailIds.has(t.id)),
    [allTrails, eventTrailIds]
  );
  const notInEvent = useMemo(
    () => allTrails.filter((t) => !eventTrailIds.has(t.id)),
    [allTrails, eventTrailIds]
  );

  const [diffFilter, setDiffFilter] = useState<DifficultyFilter>("ALL");
  const [query, setQuery] = useState("");
  const filteredInEvent = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inEvent.filter((t) => {
      if (diffFilter !== "ALL" && t.difficulty !== diffFilter) return false;
      if (!q) return true;
      const hay = `${t.name ?? ""} ${t.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [inEvent, diffFilter, query]);

  // 행사제외
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [, startRemoveTransition] = useTransition();

  function onRemoveFromEvent(trailId: string, name: string): void {
    if (removingId) return;
    const ok = window.confirm(
      `[${name || "(이름 없음)"}] 숲길을 이 행사에서 제외할까요?\n\n` +
        `이 행사에서만 빠지고, 숲길 자체와 다른 행사 연결은 유지돼요.`
    );
    if (!ok) return;
    setRemoveError(null);
    setRemovingId(trailId);
    startRemoveTransition(async () => {
      try {
        await removeTrailFromEventAction(eventId, trailId);
        router.refresh();
      } catch (err) {
        setRemoveError(err instanceof Error ? err.message : "행사제외 실패");
      } finally {
        setRemovingId(null);
      }
    });
  }

  // 하단 접이식: 다른 숲길 일괄 추가
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkQuery, setBulkQuery] = useState("");
  const [bulkDiff, setBulkDiff] = useState<DifficultyFilter>("ALL");
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
    return notInEvent.filter((t) => {
      if (bulkDiff !== "ALL" && t.difficulty !== bulkDiff) return false;
      if (!q) return true;
      const hay = `${t.name ?? ""} ${t.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [notInEvent, bulkDiff, bulkQuery]);

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
        await setEventTrailsAction(eventId, nextIds);
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
            <span aria-hidden>🗺️</span>
            <span>이 행사 숲길</span>
            <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-xs text-[#2D5A3D]">
              {inEvent.length}
            </span>
          </h2>
          <p className="mt-1 text-xs text-[#6B6560]">
            이 행사에서 사용할 숲길이에요. 지사가 배포한 숲길에서 골라 연결할 수
            있어요.
          </p>
        </div>
        <Link
          href={`/org/${orgId}/trails`}
          className="rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#4A7C59] px-3 py-2 text-xs font-bold text-white hover:opacity-90"
        >
          🗺 우리 숲길 전체
        </Link>
      </header>

      {/* 난이도 필터 + 검색 */}
      <div className="rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {DIFFICULTY_FILTERS.map((tab) => {
            const isActive = tab.key === diffFilter;
            const count =
              tab.key === "ALL"
                ? inEvent.length
                : inEvent.filter((t) => t.difficulty === tab.key).length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setDiffFilter(tab.key)}
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
            placeholder="🔍 숲길 이름/설명 검색"
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

      {/* 카드 그리드 */}
      {filteredInEvent.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            {inEvent.length === 0 ? "🌲" : "🔍"}
          </div>
          <p className="mt-3 text-sm font-bold text-[#2D5A3D]">
            {inEvent.length === 0
              ? "이 행사에 연결된 숲길이 없어요"
              : "조건에 맞는 숲길이 없어요"}
          </p>
          <p className="mt-1 max-w-sm text-xs text-[#6B6560]">
            {inEvent.length === 0
              ? "아래에서 기관에 배포된 숲길을 골라 연결하세요."
              : "다른 난이도나 검색어로 시도해 보세요."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredInEvent.map((t) => {
            const meta = DIFFICULTY_CHIP[t.difficulty];
            const isRemoving = removingId === t.id;
            return (
              <article
                key={t.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Cover */}
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#E8F0E4]">
                  {t.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.cover_image_url}
                      alt={t.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl">
                      🌲
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}
                    >
                      {meta.icon} {meta.label}
                    </span>
                    {t.estimated_minutes != null && (
                      <span className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                        ⏱ {t.estimated_minutes}분
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                      📍 {t.total_slots}지점
                    </span>
                  </div>

                  <h3 className="line-clamp-2 text-sm font-bold text-[#2C2C2C]">
                    {t.name}
                  </h3>
                  {t.description && (
                    <p className="line-clamp-2 text-xs text-[#6B6560]">
                      {t.description}
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                    <Link
                      href={`/org/${orgId}/trails/${t.id}/qr`}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#4A7C59]"
                    >
                      🎫 QR
                    </Link>
                    {t.slug && (
                      <Link
                        href={`/trail/${t.slug}`}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
                      >
                        🔗 공유
                      </Link>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveFromEvent(t.id, t.name)}
                    disabled={isRemoving}
                    title="이 행사에서만 제외 (숲길 자체는 보존)"
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isRemoving ? "⏳" : "🚫"} 행사제외
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 하단 접이식 */}
      {notInEvent.length > 0 && (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
          <details className="group" open={false}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-[#FAE7D0] via-white to-[#E8F0E4] p-4">
              <div className="flex items-center gap-2 text-[#2D5A3D]">
                <span aria-hidden className="text-xl">
                  ➕
                </span>
                <div>
                  <p className="text-sm font-bold">기관 다른 숲길 추가</p>
                  <p className="text-[11px] text-[#6B6560]">
                    이 행사에 아직 연결되지 않은 숲길 {notInEvent.length}개를
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
                {DIFFICULTY_FILTERS.map((tab) => {
                  const isActive = tab.key === bulkDiff;
                  const count =
                    tab.key === "ALL"
                      ? notInEvent.length
                      : notInEvent.filter((t) => t.difficulty === tab.key)
                          .length;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setBulkDiff(tab.key)}
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
                <ul className="grid max-h-[28rem] gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                  {filteredNotInEvent.map((t) => {
                    const meta = DIFFICULTY_CHIP[t.difficulty];
                    const isChecked = bulkSelected.has(t.id);
                    return (
                      <li key={t.id}>
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
                            onChange={() => toggleBulk(t.id)}
                            className="mt-0.5 h-4 w-4 rounded border-[#D4E4BC] text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1">
                              <span
                                className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${meta.color}`}
                              >
                                {meta.icon} {meta.label}
                              </span>
                              <span className="rounded-full bg-[#F5F1E8] px-1.5 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                                📍 {t.total_slots}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs font-bold text-[#2D5A3D]">
                              🗺 {t.name || "(이름 없음)"}
                            </p>
                            {t.estimated_minutes != null && (
                              <p className="mt-0.5 text-[10px] text-[#6B6560]">
                                ⏱ {t.estimated_minutes}분
                              </p>
                            )}
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
