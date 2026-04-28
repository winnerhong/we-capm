"use client";

// 행사 스탬프북 탭 — /org/[orgId]/quest-packs standalone 페이지와 동일한 카드 그리드 UI를
// 행사 단위로 재사용. 이 행사에 연결된 스탬프북만 표시. 행사제외 / 영구삭제 / 새로 만들기 + 일괄 추가 지원.

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
  setEventQuestPacksAction,
  removeQuestPackFromEventAction,
} from "@/lib/org-events/actions";
import { DeletePackButton } from "@/app/org/[orgId]/quest-packs/delete-pack-button";

export type QuestPackOption = {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "LIVE" | "ENDED" | "ARCHIVED";
  starts_at: string | null;
  ends_at: string | null;
  cover_image_url: string | null;
  missionCount: number;
};

type Props = {
  eventId: string;
  orgId: string;
  allPacks: QuestPackOption[];
  initialSelectedIds: string[];
};

type StatusFilter = "ALL" | "LIVE" | "DRAFT" | "ENDED" | "ARCHIVED";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "LIVE", label: "진행중" },
  { key: "DRAFT", label: "초안" },
  { key: "ENDED", label: "종료" },
  { key: "ARCHIVED", label: "보관됨" },
];

const STATUS_CHIP: Record<
  QuestPackOption["status"],
  { label: string; color: string }
> = {
  DRAFT: {
    label: "초안",
    color: "bg-zinc-100 text-zinc-700 border-zinc-300",
  },
  LIVE: {
    label: "진행중",
    color: "bg-emerald-500 text-white border-emerald-500",
  },
  ENDED: {
    label: "종료",
    color: "bg-sky-50 text-sky-800 border-sky-200",
  },
  ARCHIVED: {
    label: "보관됨",
    color: "bg-zinc-50 text-zinc-500 border-zinc-200",
  },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function QuestPacksTab({
  eventId,
  orgId,
  allPacks,
  initialSelectedIds,
}: Props) {
  const router = useRouter();

  const eventPackIds = useMemo(
    () => new Set(initialSelectedIds),
    [initialSelectedIds]
  );

  const inEvent = useMemo(
    () => allPacks.filter((p) => eventPackIds.has(p.id)),
    [allPacks, eventPackIds]
  );
  const notInEvent = useMemo(
    () => allPacks.filter((p) => !eventPackIds.has(p.id)),
    [allPacks, eventPackIds]
  );

  // 상태 필터 + 검색
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const filteredInEvent = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inEvent.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${p.name ?? ""} ${p.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [inEvent, statusFilter, query]);

  // 행사제외 (단일)
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [, startRemoveTransition] = useTransition();

  function onRemoveFromEvent(packId: string, packName: string): void {
    if (removingId) return;
    const ok = window.confirm(
      `[${packName || "(이름 없음)"}] 스탬프북을 이 행사에서 제외할까요?\n\n` +
        `이 행사에서만 빠지고, 스탬프북 자체와 다른 행사 연결은 유지돼요.`
    );
    if (!ok) return;
    setRemoveError(null);
    setRemovingId(packId);
    startRemoveTransition(async () => {
      try {
        await removeQuestPackFromEventAction(eventId, packId);
        router.refresh();
      } catch (err) {
        setRemoveError(err instanceof Error ? err.message : "행사제외 실패");
      } finally {
        setRemovingId(null);
      }
    });
  }

  // 하단 접이식: 다른 스탬프북 일괄 추가
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
      const hay = `${p.name ?? ""} ${p.description ?? ""}`.toLowerCase();
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
        await setEventQuestPacksAction(eventId, nextIds);
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
      {/* ────── 헤더 / 새 스탬프북 ────── */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#2D5A3D] p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4E4BC]">
              Event · Quest Packs
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-bold md:text-xl">
              <span aria-hidden>🌲</span>
              <span>이 행사 스탬프북</span>
              <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {inEvent.length}
              </span>
            </h2>
            <p className="mt-1 text-xs text-[#E8F0E4]">
              이 행사에 연결된 스탬프북이에요. 새로 만들거나 기존 스탬프북을
              연결할 수 있어요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/org/${orgId}/quest-packs/from-preset`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700"
            >
              <span aria-hidden>✨</span>
              <span>프리셋 시작</span>
            </Link>
            <Link
              href={`/org/${orgId}/quest-packs/new`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8]"
            >
              <span aria-hidden>➕</span>
              <span>새 스탬프북</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ────── 상태 필터 + 검색 ────── */}
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
            placeholder="🔍 스탬프북 이름/설명 검색"
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

      {/* ────── 카드 그리드 ────── */}
      {filteredInEvent.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden>
            {inEvent.length === 0 ? "🌱" : "🔍"}
          </div>
          <p className="mt-3 text-sm font-bold text-[#2D5A3D]">
            {inEvent.length === 0
              ? "이 행사에 연결된 스탬프북이 없어요"
              : "조건에 맞는 스탬프북이 없어요"}
          </p>
          <p className="mt-1 max-w-sm text-xs text-[#6B6560]">
            {inEvent.length === 0
              ? "위의 [✨ 프리셋 시작] 또는 [➕ 새 스탬프북]으로 만들거나, 아래에서 기관에 있는 스탬프북을 골라 연결하세요."
              : "다른 상태나 검색어로 시도해 보세요."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredInEvent.map((p) => {
            const isLive = p.status === "LIVE";
            const meta = STATUS_CHIP[p.status];
            const isRemoving = removingId === p.id;
            return (
              <li
                key={p.id}
                className={`relative overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md ${
                  isLive
                    ? "border-2 border-emerald-500 shadow-emerald-100 ring-2 ring-emerald-300/40 hover:border-emerald-600"
                    : "border border-[#D4E4BC] hover:border-[#2D5A3D]"
                }`}
              >
                {isLive && (
                  <div className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-md ring-2 ring-white">
                    <span className="relative inline-flex h-2 w-2" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                    <span>📡 공개중</span>
                  </div>
                )}
                {p.cover_image_url ? (
                  <div
                    className="h-28 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${p.cover_image_url})` }}
                    role="img"
                    aria-label={`${p.name} 커버 이미지`}
                  />
                ) : (
                  <div
                    className={`flex h-28 w-full items-center justify-center text-5xl ${
                      isLive
                        ? "bg-gradient-to-br from-emerald-100 via-[#D4E4BC] to-emerald-200"
                        : "bg-gradient-to-br from-[#E8F0E4] to-[#D4E4BC]"
                    }`}
                    aria-hidden
                  >
                    🌲
                  </div>
                )}
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        isLive
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : meta.color
                      }`}
                    >
                      {isLive ? "🟢 진행중" : meta.label}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                      <span aria-hidden>🎯</span>
                      <span>{p.missionCount}개 미션</span>
                    </span>
                  </div>
                  <h3
                    className={`truncate text-base font-bold ${
                      isLive ? "text-emerald-900" : "text-[#2C2C2C]"
                    }`}
                  >
                    {p.name || "(이름 없음)"}
                  </h3>
                  <p className="text-[11px] text-[#6B6560]">
                    📅 {fmtDate(p.starts_at)} ~ {fmtDate(p.ends_at)}
                  </p>
                  {p.description && (
                    <p className="line-clamp-2 text-xs text-[#6B6560]">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-2 pt-2">
                    <Link
                      href={`/org/${orgId}/quest-packs/${p.id}/edit`}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#234a30]"
                    >
                      <span aria-hidden>✏️</span>
                      <span>편집</span>
                    </Link>
                    <Link
                      href={`/org/${orgId}/quest-packs/${p.id}/preview`}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
                    >
                      <span aria-hidden>👀</span>
                      <span>미리보기</span>
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onRemoveFromEvent(p.id, p.name)}
                      disabled={isRemoving}
                      title="이 행사에서만 제외 (스탬프북 자체는 보존)"
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span aria-hidden>{isRemoving ? "⏳" : "🚫"}</span>
                      <span>행사제외</span>
                    </button>
                    <DeletePackButton
                      packId={p.id}
                      packName={p.name}
                      disabled={isLive}
                      disabledReason={
                        isLive
                          ? "공개중인 스탬프북은 바로 삭제할 수 없어요. 먼저 '종료' 또는 '보관'을 눌러 주세요."
                          : undefined
                      }
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ────── 하단 접이식: 기관 다른 스탬프북 추가 ────── */}
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
                    기관에 있는 다른 스탬프북 추가
                  </p>
                  <p className="text-[11px] text-[#6B6560]">
                    이 행사에 아직 연결되지 않은 스탬프북{" "}
                    {notInEvent.length}개를 한꺼번에 골라 연결할 수 있어요.
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
                                {meta.label}
                              </span>
                              <span className="rounded-full bg-[#F5F1E8] px-1.5 py-0.5 text-[10px] font-semibold text-[#6B4423]">
                                🎯 {p.missionCount}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs font-bold text-[#2D5A3D]">
                              🌲 {p.name || "(이름 없음)"}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[#6B6560]">
                              📅 {fmtDate(p.starts_at)} ~{" "}
                              {fmtDate(p.ends_at)}
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
