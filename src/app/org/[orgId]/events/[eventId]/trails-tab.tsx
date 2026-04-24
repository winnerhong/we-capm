"use client";

// 기관 행사 > 숲길 탭 — M:N 전체교체 패턴.
// 지사가 배포한 숲길만 보임. 빈 상태에서는 CTA 없음 (orgs 내부 생성 불가).

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { setEventTrailsAction } from "@/lib/org-events/actions";

type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type TrailOption = {
  id: string;
  name: string;
  description: string | null;
  difficulty: Difficulty;
  estimated_minutes: number | null;
  total_slots: number;
  cover_image_url: string | null;
};

type Props = {
  eventId: string;
  orgId: string;
  allTrails: TrailOption[];
  initialSelectedIds: string[];
};

type DifficultyFilter = "ALL" | Difficulty;

const DIFFICULTY_FILTERS: {
  key: DifficultyFilter;
  label: string;
  icon: string;
}[] = [
  { key: "ALL", label: "전체", icon: "🗺" },
  { key: "EASY", label: "쉬움", icon: "🌱" },
  { key: "MEDIUM", label: "보통", icon: "🌿" },
  { key: "HARD", label: "어려움", icon: "🌲" },
];

const DIFFICULTY_CHIP: Record<
  Difficulty,
  { label: string; icon: string; color: string }
> = {
  EASY: {
    label: "쉬움",
    icon: "🌱",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
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

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export function TrailsTab({
  eventId,
  allTrails,
  initialSelectedIds,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelectedIds)
  );
  const [initialSet] = useState<Set<string>>(
    () => new Set(initialSelectedIds)
  );
  const [filter, setFilter] = useState<DifficultyFilter>("ALL");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (savedAt == null) return;
    const t = setTimeout(() => setSavedAt(null), 2000);
    return () => clearTimeout(t);
  }, [savedAt]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTrails.filter((t) => {
      if (filter !== "ALL" && t.difficulty !== filter) return false;
      if (q && !(t.name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allTrails, filter, query]);

  const isDirty = !setsEqual(selected, initialSet);

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onCancel(): void {
    setSelected(new Set(initialSet));
    setError(null);
  }

  function onSave(): void {
    if (!isDirty || isPending) return;
    setError(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      try {
        await setEventTrailsAction(eventId, ids);
        setSavedAt(Date.now());
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "저장에 실패했어요";
        setError(msg);
      }
    });
  }

  if (allTrails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
        <div className="text-5xl" aria-hidden>
          🗺
        </div>
        <p className="mt-3 text-base font-bold text-[#2D5A3D]">
          배포된 숲길이 없어요
        </p>
        <p className="mt-1 max-w-sm text-xs text-[#6B6560]">
          지사(파트너) 에서 숲길을 배포해 주면 여기에서 행사에 연결할 수 있어요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 요약 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D4E4BC] bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6560]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2.5 py-1 font-semibold text-[#2D5A3D]">
            🗺 총 {allTrails.length.toLocaleString("ko-KR")}개
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 font-bold text-violet-800">
            ✅ 선택 {selected.size.toLocaleString("ko-KR")}개
          </span>
        </div>
        {isDirty && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
            ● 저장되지 않은 변경사항
          </span>
        )}
      </div>

      {/* 필터 / 검색 */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
        <div
          role="tablist"
          aria-label="난이도 필터"
          className="flex flex-wrap gap-1.5"
        >
          {DIFFICULTY_FILTERS.map((f) => {
            const active = f.key === filter;
            const count =
              f.key === "ALL"
                ? allTrails.length
                : allTrails.filter((t) => t.difficulty === f.key).length;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                    : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D] hover:text-[#2D5A3D]"
                }`}
              >
                <span aria-hidden>{f.icon}</span>
                <span>{f.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    active ? "bg-white/20" : "bg-[#F5F1E8]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <label className="ml-auto min-w-[200px] flex-1">
          <span className="sr-only">숲길 이름 검색</span>
          <input
            type="search"
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setQuery(e.target.value)
            }
            placeholder="🔍 이름으로 검색"
            inputMode="search"
            autoComplete="off"
            className="w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
          />
        </label>
      </div>

      {/* 에러 / 성공 배너 */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
        >
          ⚠️ {error}
        </div>
      )}
      {savedAt != null && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          ✅ 저장됐어요
        </div>
      )}

      {/* 카드 그리드 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            🔍
          </div>
          <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
            조건에 맞는 숲길이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            다른 난이도나 검색어로 시도해 보세요.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TrailCard
              key={t.id}
              trail={t}
              checked={selected.has(t.id)}
              onToggle={() => toggle(t.id)}
            />
          ))}
        </ul>
      )}

      {/* 하단 sticky 액션 바 */}
      <div className="sticky bottom-3 z-10">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D4E4BC] bg-white/95 p-3 shadow-lg backdrop-blur">
          <p className="text-xs font-semibold text-[#2D5A3D]">
            {isDirty
              ? `선택된 ${selected.size}개를 저장할까요?`
              : "변경사항이 없어요"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={!isDirty || isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-3.5 py-2 text-xs font-bold text-[#6B6560] hover:bg-[#F5F1E8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden>↩️</span>
              <span>취소</span>
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!isDirty || isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2 text-xs font-bold text-white shadow-sm hover:from-[#234a30] hover:to-[#2D5A3D] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden>{isPending ? "⏳" : "💾"}</span>
              <span>{isPending ? "저장 중..." : "저장"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrailCard({
  trail,
  checked,
  onToggle,
}: {
  trail: TrailOption;
  checked: boolean;
  onToggle: () => void;
}) {
  const diffChip = DIFFICULTY_CHIP[trail.difficulty];
  return (
    <li
      className={`relative overflow-hidden rounded-2xl border shadow-sm transition ${
        checked
          ? "border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-300/40"
          : "border-[#D4E4BC] bg-white hover:border-[#2D5A3D]/50"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={checked}
        aria-label={`${trail.name} ${checked ? "선택 해제" : "선택"}`}
        className="block w-full text-left"
      >
        {/* 체크박스 오버레이 */}
        <span
          aria-hidden
          className={`absolute left-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-lg border-2 text-xs font-extrabold shadow-sm ${
            checked
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-[#D4E4BC] bg-white text-transparent"
          }`}
        >
          ✓
        </span>

        {trail.cover_image_url ? (
          <div
            className="h-24 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${trail.cover_image_url})` }}
            role="img"
            aria-label={`${trail.name} 커버`}
          />
        ) : (
          <div
            className="flex h-24 w-full items-center justify-center bg-gradient-to-br from-[#E8F0E4] to-[#D4E4BC] text-4xl"
            aria-hidden
          >
            🗺
          </div>
        )}

        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${diffChip.color}`}
            >
              <span aria-hidden>{diffChip.icon}</span>
              <span>{diffChip.label}</span>
            </span>
            {trail.estimated_minutes != null && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                <span aria-hidden>⏱</span>
                <span>
                  {trail.estimated_minutes >= 60
                    ? `${Math.round((trail.estimated_minutes / 60) * 10) / 10}시간`
                    : `${trail.estimated_minutes}분`}
                </span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
              <span aria-hidden>📍</span>
              <span>지점 {trail.total_slots}</span>
            </span>
          </div>
          <h3 className="truncate text-sm font-bold text-[#2C2C2C]">
            {trail.name || "(이름 없음)"}
          </h3>
          {trail.description && (
            <p className="line-clamp-2 text-[11px] text-[#6B6560]">
              {trail.description}
            </p>
          )}
        </div>
      </button>
    </li>
  );
}
