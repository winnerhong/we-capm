"use client";

// 기관 행사 > 프로그램 탭 — M:N 전체교체 패턴 (QuestPacksTab 과 동일).
// org_programs 중에서 이 행사에 연결할 것을 체크박스로 골라 저장.

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { setEventProgramsAction } from "@/lib/org-events/actions";

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

const STATUS_FILTERS: { key: StatusFilter; label: string; icon: string }[] = [
  { key: "ALL", label: "전체", icon: "🗂" },
  { key: "ACTIVATED", label: "활성화", icon: "✨" },
  { key: "CUSTOMIZED", label: "수정중", icon: "✏️" },
  { key: "PUBLISHED", label: "공개중", icon: "📢" },
  { key: "PAUSED", label: "일시정지", icon: "⏸️" },
];

const STATUS_CHIP: Record<ProgramStatus, { label: string; color: string }> = {
  ACTIVATED: {
    label: "활성화",
    color: "bg-sky-50 text-sky-800 border-sky-200",
  },
  CUSTOMIZED: {
    label: "수정중",
    color: "bg-amber-50 text-amber-800 border-amber-200",
  },
  PUBLISHED: {
    label: "공개중",
    color: "bg-emerald-500 text-white border-emerald-500",
  },
  PAUSED: {
    label: "일시정지",
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

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export function ProgramsTab({
  eventId,
  orgId,
  allPrograms,
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
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (savedAt == null) return;
    const t = setTimeout(() => setSavedAt(null), 2000);
    return () => clearTimeout(t);
  }, [savedAt]);

  const publishedCount = useMemo(
    () => allPrograms.filter((p) => p.status === "PUBLISHED").length,
    [allPrograms]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allPrograms.filter((p) => {
      if (filter !== "ALL" && p.status !== filter) return false;
      if (q && !(p.title ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allPrograms, filter, query]);

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
        await setEventProgramsAction(eventId, ids);
        setSavedAt(Date.now());
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "저장에 실패했어요";
        setError(msg);
      }
    });
  }

  if (allPrograms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
        <div className="text-5xl" aria-hidden>
          🗂
        </div>
        <p className="mt-3 text-base font-bold text-[#2D5A3D]">
          활성화된 프로그램이 없어요
        </p>
        <p className="mt-1 max-w-sm text-xs text-[#6B6560]">
          템플릿에서 프로그램을 활성화해 주세요. 이후 이 행사에 연결할 수 있어요.
        </p>
        <Link
          href={`/org/${orgId}/templates`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#234a30]"
        >
          <span aria-hidden>📋</span>
          <span>템플릿 둘러보기</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 요약 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D4E4BC] bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6560]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2.5 py-1 font-semibold text-[#2D5A3D]">
            🗂 총 {allPrograms.length.toLocaleString("ko-KR")}개
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
            📢 공개중 {publishedCount.toLocaleString("ko-KR")}개
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
          aria-label="상태 필터"
          className="flex flex-wrap gap-1.5"
        >
          {STATUS_FILTERS.map((f) => {
            const active = f.key === filter;
            const count =
              f.key === "ALL"
                ? allPrograms.length
                : allPrograms.filter((p) => p.status === f.key).length;
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
          <span className="sr-only">프로그램 제목 검색</span>
          <input
            type="search"
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setQuery(e.target.value)
            }
            placeholder="🔍 제목으로 검색"
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
            조건에 맞는 프로그램이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            다른 상태나 검색어로 시도해 보세요.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProgramCard
              key={p.id}
              program={p}
              checked={selected.has(p.id)}
              onToggle={() => toggle(p.id)}
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

function ProgramCard({
  program,
  checked,
  onToggle,
}: {
  program: ProgramOption;
  checked: boolean;
  onToggle: () => void;
}) {
  const isPublished = program.status === "PUBLISHED";
  const chip = STATUS_CHIP[program.status];
  const cat = CATEGORY_LABEL[program.category] ?? {
    label: program.category || "기타",
    icon: "🗂",
  };
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
        aria-label={`${program.title} ${checked ? "선택 해제" : "선택"}`}
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

        {/* PUBLISHED 강조 리본 */}
        {isPublished && (
          <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md ring-2 ring-white">
            <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            <span>공개중</span>
          </span>
        )}

        {program.image_url ? (
          <div
            className="h-24 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${program.image_url})` }}
            role="img"
            aria-label={`${program.title} 커버`}
          />
        ) : (
          <div
            className={`flex h-24 w-full items-center justify-center text-4xl ${
              isPublished
                ? "bg-gradient-to-br from-emerald-100 via-[#D4E4BC] to-emerald-200"
                : "bg-gradient-to-br from-[#E8F0E4] to-[#D4E4BC]"
            }`}
            aria-hidden
          >
            {cat.icon}
          </div>
        )}

        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chip.color}`}
            >
              {chip.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
              <span aria-hidden>{cat.icon}</span>
              <span>{cat.label}</span>
            </span>
          </div>
          <h3 className="truncate text-sm font-bold text-[#2C2C2C]">
            {program.title || "(제목 없음)"}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              💰 {formatWon(program.price_per_person)}
            </span>
            {program.duration_hours != null && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                ⏱ {program.duration_hours}시간
              </span>
            )}
          </div>
          {program.description && (
            <p className="line-clamp-2 text-[11px] text-[#6B6560]">
              {program.description}
            </p>
          )}
        </div>
      </button>
    </li>
  );
}
