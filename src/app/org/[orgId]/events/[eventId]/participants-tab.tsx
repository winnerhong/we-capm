"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { setEventParticipantsAction } from "@/lib/org-events/actions";

type UserStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

export type ParticipantOption = {
  id: string;
  parent_name: string;
  phone: string;
  status: UserStatus;
  children_count: number;
};

type Props = {
  eventId: string;
  orgId: string;
  allParticipants: ParticipantOption[];
  initialSelectedIds: string[];
};

const STATUS_META: Record<UserStatus, { label: string; chip: string }> = {
  ACTIVE: {
    label: "활성",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  SUSPENDED: {
    label: "정지",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
  },
  CLOSED: {
    label: "해지",
    chip: "bg-zinc-100 text-zinc-600 border-zinc-200",
  },
};

function maskPhone(digitsOrFormatted: string): string {
  const digits = (digitsOrFormatted ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(6)}`;
  }
  return digitsOrFormatted;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export function ParticipantsTab({
  eventId,
  orgId,
  allParticipants,
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
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (savedAt == null) return;
    const t = setTimeout(() => setSavedAt(null), 2000);
    return () => clearTimeout(t);
  }, [savedAt]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allParticipants.filter((r) => {
      if (activeOnly && r.status !== "ACTIVE") return false;
      if (!q) return true;
      const hay = `${r.parent_name} ${r.phone}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allParticipants, query, activeOnly]);

  // 선택 가능한 (CLOSED 제외) 필터 목록
  const selectableInView = useMemo(
    () => filtered.filter((r) => r.status !== "CLOSED"),
    [filtered]
  );

  const allInViewSelected =
    selectableInView.length > 0 &&
    selectableInView.every((r) => selected.has(r.id));

  const isDirty = !setsEqual(selected, initialSet);

  function toggle(id: string, status: UserStatus): void {
    if (status === "CLOSED") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInView(): void {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of selectableInView) next.add(r.id);
      return next;
    });
  }

  function clearAllInView(): void {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of selectableInView) next.delete(r.id);
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
        await setEventParticipantsAction(eventId, ids);
        setSavedAt(Date.now());
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "저장에 실패했어요";
        setError(msg);
      }
    });
  }

  if (allParticipants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
        <div className="text-5xl" aria-hidden>
          🌱
        </div>
        <p className="mt-3 text-base font-bold text-[#2D5A3D]">
          기관에 참가자가 없어요
        </p>
        <p className="mt-1 max-w-sm text-xs text-[#6B6560]">
          먼저 참가자(보호자)를 등록한 뒤 이 행사에 연결할 수 있어요.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href={`/org/${orgId}/users/new`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a30]"
          >
            <span aria-hidden>👤</span>
            <span>한 명 추가</span>
          </Link>
          <Link
            href={`/org/${orgId}/users/bulk-import`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
          >
            <span aria-hidden>📥</span>
            <span>엑셀 일괄 등록</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 요약 + 툴바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D4E4BC] bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6560]">
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 font-bold text-violet-800">
            ✅ 선택 {selected.size.toLocaleString("ko-KR")}명
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2.5 py-1 font-semibold text-[#2D5A3D]">
            🙋 전체 {allParticipants.length.toLocaleString("ko-KR")}명
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
            🔎 보이는 {filtered.length.toLocaleString("ko-KR")}명
          </span>
        </div>
        {isDirty && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
            ● 저장되지 않은 변경사항
          </span>
        )}
      </div>

      {/* 검색 / 필터 / 전체 선택 */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
        <label className="flex-1 min-w-[200px]">
          <span className="sr-only">보호자명 / 핸드폰 검색</span>
          <input
            type="search"
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setQuery(e.target.value)
            }
            placeholder="🔍 보호자명 / 핸드폰 검색"
            inputMode="search"
            autoComplete="off"
            className="w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
          />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="h-4 w-4 rounded border-[#D4E4BC] text-emerald-600 focus:ring-emerald-500"
          />
          <span>활성만 보기</span>
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={selectAllInView}
            disabled={selectableInView.length === 0 || allInViewSelected}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden>☑️</span>
            <span>보이는 항목 전체 선택</span>
          </button>
          <button
            type="button"
            onClick={clearAllInView}
            disabled={selectableInView.length === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-xs font-bold text-[#6B4423] hover:bg-[#FFF8F0] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden>☐</span>
            <span>전체 해제</span>
          </button>
        </div>
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

      {/* 빈 상태 */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            🔍
          </div>
          <p className="mt-3 text-sm font-semibold text-[#2D5A3D]">
            조건에 맞는 참가자가 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            다른 검색어나 필터로 시도해 보세요.
          </p>
        </div>
      ) : (
        <>
          {/* 데스크탑 테이블 */}
          <div className="hidden overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="bg-[#F4EFE8] text-[#6B4423]">
                  <tr>
                    <th className="w-10 px-3 py-2.5 text-center text-[11px] font-bold">
                      선택
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold">
                      🙋 보호자명
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold">
                      📞 핸드폰
                    </th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-bold">
                      🧒 자녀
                    </th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-bold">
                      상태
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const meta = STATUS_META[r.status];
                    const isClosed = r.status === "CLOSED";
                    const isChecked = selected.has(r.id);
                    return (
                      <tr
                        key={r.id}
                        className={`border-t border-[#F4EFE8] ${
                          isClosed
                            ? "bg-zinc-50/70 text-zinc-400"
                            : isChecked
                              ? "bg-emerald-50/40 hover:bg-emerald-50/60"
                              : "hover:bg-[#FFF8F0]"
                        }`}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isClosed}
                            onChange={() => toggle(r.id, r.status)}
                            title={
                              isClosed
                                ? "해지된 참가자는 선택할 수 없어요"
                                : undefined
                            }
                            aria-label={`${r.parent_name} 선택`}
                            className="h-4 w-4 rounded border-[#D4E4BC] text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-[#2D5A3D]">
                          {r.parent_name}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-[#6B6560]">
                          {maskPhone(r.phone)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FAE7D0] px-2 py-0.5 text-[11px] font-bold text-[#6B4423]">
                            <span aria-hidden>🧒</span>
                            {r.children_count}명
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.chip}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 모바일 카드 */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((r) => {
              const meta = STATUS_META[r.status];
              const isClosed = r.status === "CLOSED";
              const isChecked = selected.has(r.id);
              return (
                <li
                  key={r.id}
                  className={`rounded-2xl border p-4 shadow-sm transition ${
                    isClosed
                      ? "border-zinc-200 bg-zinc-50 opacity-70"
                      : isChecked
                        ? "border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-300/30"
                        : "border-[#D4E4BC] bg-white"
                  }`}
                >
                  <label
                    className={`flex items-start gap-3 ${
                      isClosed ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isClosed}
                      onChange={() => toggle(r.id, r.status)}
                      title={
                        isClosed
                          ? "해지된 참가자는 선택할 수 없어요"
                          : undefined
                      }
                      aria-label={`${r.parent_name} 선택`}
                      className="mt-1 h-5 w-5 rounded border-[#D4E4BC] text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-base font-bold text-[#2D5A3D]">
                            🙋 {r.parent_name}
                          </div>
                          <div className="mt-0.5 font-mono text-xs text-[#6B6560]">
                            📞 {maskPhone(r.phone)}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.chip}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-2 inline-flex items-center gap-0.5 rounded-full bg-[#FAE7D0] px-2 py-0.5 text-[11px] font-bold text-[#6B4423]">
                        <span aria-hidden>🧒</span> 자녀 {r.children_count}명
                      </div>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* 하단 sticky 액션 바 */}
      <div className="sticky bottom-3 z-10">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D4E4BC] bg-white/95 p-3 shadow-lg backdrop-blur">
          <p className="text-xs font-semibold text-[#2D5A3D]">
            {isDirty
              ? `선택된 ${selected.size}명을 저장할까요?`
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
