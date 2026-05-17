"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import { fmtClockKstAlways } from "@/lib/datetime/kst";
import {
  approveSubmissionAction,
  rejectSubmissionAction,
} from "@/lib/missions/review-actions";
import { deletePhotoFromWallAction } from "../actions";
import { InlineReviewModal } from "./inline-review-modal";
import styles from "../control-room.module.css";

type PhotoItem = ControlRoomSnapshot["photoWall"][number];

type Props = {
  items: ControlRoomSnapshot["photoWall"];
  isTvMode: boolean;
};

/**
 * 📸 사진 월 — 최근 제출된 사진을 갤러리로 표시.
 * - 행사 진행 중 운영자가 한눈에 "지금 어떤 사진들이 올라오고 있나" 볼 수 있게.
 * - 각 사진 hover/tap 시 미션·가족·시각 메타정보 노출.
 * - 사진 클릭 시 확대 모달.
 * - TV 모드: 더 큰 그리드.
 */
export function PhotoWallTile({ items, isTvMode }: Props) {
  const router = useRouter();
  // 노출 한도 제거 — 사진월 위젯 안에서 스크롤로 전부 보이게.
  // (이전: 일반 12 / TV 18 로 잘려서 19장 중 12장만 보이는 문제)
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  // 빠른 승인 후 "✅ 승인됨" 토스트 한 번 표시할 사진 id.
  // router.refresh 가 끝나기 전에 사용자에게 피드백 주기 위해.
  const [justApprovedId, setJustApprovedId] = useState<string | null>(null);
  // ❌ 반려 클릭 시 InlineReviewModal 을 그 사진의 submissionId 로 오픈.
  //  (PENDING_REVIEW/SUBMITTED 큐 안에 있을 때만 매칭됨)
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<
    string | null
  >(null);
  // APPROVED/AUTO_APPROVED 사진을 되돌릴 때 쓰는 자체 reject prompt 모달.
  const [revertingPhoto, setRevertingPhoto] = useState<PhotoItem | null>(null);
  const [, startTransition] = useTransition();

  // 미션별 필터 — null = 전체. 디폴트는 null (모든 사진).
  const [filterMissionId, setFilterMissionId] = useState<string | null>(null);

  // 미션 칩 — 사진이 있는 미션만, 스템프북 순서(display_order) ASC 로 정렬.
  //  → 좌측부터 스템프 순서가 빠른 미션이 먼저 노출됨.
  const missionChips = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        title: string;
        icon: string | null;
        count: number;
        displayOrder: number;
      }
    >();
    for (const p of items) {
      const cur = map.get(p.missionId);
      if (cur) cur.count += 1;
      else {
        map.set(p.missionId, {
          id: p.missionId,
          title: p.missionTitle,
          icon: p.missionIcon,
          count: 1,
          displayOrder: p.missionDisplayOrder,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      // tiebreaker: id 안정 정렬
      return a.id.localeCompare(b.id);
    });
  }, [items]);

  // 상태 필터 4-way — 전체 / 승인 / 미승인(검수 대기) / 반려.
  const [statusFilter, setStatusFilter] = useState<
    "all" | "approved" | "pending" | "rejected"
  >("all");

  // 분류:
  //   approved = APPROVED + AUTO_APPROVED + SUBMITTED (자동승인 대기 포함)
  //   pending  = PENDING_REVIEW (운영자 액션 필요 = "미승인")
  //   rejected = REJECTED
  function isApproved(status: string) {
    return (
      status === "APPROVED" ||
      status === "AUTO_APPROVED" ||
      status === "SUBMITTED"
    );
  }
  function isPendingReview(status: string) {
    return status === "PENDING_REVIEW";
  }
  function isRejectedStatus(status: string) {
    return status === "REJECTED";
  }

  // 낙관적 status 오버라이드 — 승인/반려 직후 즉시 시각 반영을 위한 클라이언트 캐시.
  //  router.refresh() 가 끝나기 전에 사진이 현재 필터(미승인 등)에서 사라지도록.
  //  새 items 가 props 로 들어오면 useEffect 로 초기화.
  const [statusOverrides, setStatusOverrides] = useState<Map<string, string>>(
    new Map()
  );
  useEffect(() => {
    setStatusOverrides(new Map());
  }, [items]);

  const effectiveItems = useMemo(() => {
    if (statusOverrides.size === 0) return items;
    return items.map((p) => {
      const override = statusOverrides.get(p.submissionId);
      return override ? { ...p, status: override } : p;
    });
  }, [items, statusOverrides]);

  // 미션 필터 적용 (status 필터 전 단계) — 상태 칩 카운트는 미션 필터 후 기준.
  const missionFilteredItems = useMemo(() => {
    if (!filterMissionId) return effectiveItems;
    const exists = effectiveItems.some((p) => p.missionId === filterMissionId);
    if (!exists) return effectiveItems;
    return effectiveItems.filter((p) => p.missionId === filterMissionId);
  }, [effectiveItems, filterMissionId]);

  // 상태 칩 노출 카운트 — 미션 필터 안에서 계산 (4-way)
  const statusCounts = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    for (const p of missionFilteredItems) {
      if (isApproved(p.status)) approved++;
      else if (isPendingReview(p.status)) pending++;
      else if (isRejectedStatus(p.status)) rejected++;
    }
    return {
      all: missionFilteredItems.length,
      approved,
      pending,
      rejected,
    };
  }, [missionFilteredItems]);

  // 최종 필터링: 미션 + 상태
  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return missionFilteredItems;
    if (statusFilter === "approved") {
      return missionFilteredItems.filter((p) => isApproved(p.status));
    }
    if (statusFilter === "pending") {
      return missionFilteredItems.filter((p) => isPendingReview(p.status));
    }
    return missionFilteredItems.filter((p) => isRejectedStatus(p.status));
  }, [missionFilteredItems, statusFilter]);

  // 안전망 — 현재 statusFilter 가 가리키는 카테고리가 0건이면 'all' 로 자동 복귀.
  useEffect(() => {
    if (statusFilter === "approved" && statusCounts.approved === 0) {
      setStatusFilter("all");
    } else if (statusFilter === "pending" && statusCounts.pending === 0) {
      setStatusFilter("all");
    } else if (statusFilter === "rejected" && statusCounts.rejected === 0) {
      setStatusFilter("all");
    }
  }, [statusFilter, statusCounts]);

  // 무한 스크롤 — 처음 12장(4×3), sentinel 이 viewport 진입할 때마다 4장씩 추가.
  const INITIAL_VISIBLE = 12;
  const STEP = 4;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  // 필터/items 변경 시 다시 처음부터.
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [filterMissionId, statusFilter, filteredItems.length]);
  const list = isTvMode ? filteredItems : filteredItems.slice(0, visibleCount);
  const hasMore = !isTvMode && visibleCount < filteredItems.length;

  // IntersectionObserver — grid 끝의 sentinel li 가 viewport 에 들어오면 더 로드.
  const sentinelRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const el = sentinelRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + STEP, filteredItems.length));
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, filteredItems.length, visibleCount]);

  function handleApprove(p: (typeof list)[number]) {
    if (approvingId) return;
    setApprovingId(p.submissionId);
    startTransition(async () => {
      const result = await approveSubmissionAction(p.submissionId);
      setApprovingId(null);
      if (!result.ok) {
        window.alert(`승인 실패: ${result.error}`);
        return;
      }
      // 낙관적 status 오버라이드 — 즉시 "미승인" 필터에서 사라지게.
      setStatusOverrides((prev) => {
        const next = new Map(prev);
        next.set(p.submissionId, "APPROVED");
        return next;
      });
      // 사용자에게 즉시 피드백 — 다음 fetch 까지 "승인됨" 토스트 유지.
      setJustApprovedId(p.submissionId);
      router.refresh();
      // 3초 후 토스트 제거 (refresh 후 status 가 APPROVED 로 바뀌어도 안전망)
      setTimeout(() => {
        setJustApprovedId((curr) =>
          curr === p.submissionId ? null : curr
        );
      }, 3000);
    });
  }

  function handleDelete(p: (typeof list)[number]) {
    if (
      !window.confirm(
        `이 사진을 사진 월에서 삭제할까요?\n\n` +
          `${p.missionTitle}\n${p.userDisplayName} · ${fmtClockKstAlways(p.submittedAt)}\n\n` +
          `삭제하면 관제실·결과 화면에 더 이상 노출되지 않아요. (도토리는 회수되지 않음)`
      )
    ) {
      return;
    }
    setDeletingId(p.submissionId);
    startTransition(async () => {
      const result = await deletePhotoFromWallAction(p.submissionId);
      setDeletingId(null);
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  // 헤더 클릭 → 섹션을 화면 최상단으로 스크롤 (자석 정렬).
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const snapToTop = () => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      ref={sectionRef}
      className={`${styles.surface} scroll-mt-24 flex h-full min-h-0 flex-col p-4`}
    >
      <button
        type="button"
        onClick={snapToTop}
        title="클릭하면 자석처럼 최상단에 붙어요"
        className="mb-3 flex w-full items-center gap-2 rounded text-left transition hover:bg-white/[0.03]"
      >
        <span className="text-base" aria-hidden>
          📸
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#a8b8d0]">
          포토월
        </h2>
        <span aria-hidden className="text-[10px] text-[#7a8aa8]">
          🧲
        </span>
        <span className="ml-auto font-mono text-xs text-[#a8b8d0]">
          {filterMissionId
            ? `${filteredItems.length} / ${items.length}`
            : items.length}
        </span>
      </button>

      {/* 미션별 필터 칩 — 사진이 있는 미션만, 활성 칩이 강조. 미션 1개 이하면 숨김. */}
      {missionChips.length > 1 && (
        <div
          role="tablist"
          aria-label="미션별 사진 필터"
          className="mb-3 flex flex-wrap gap-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filterMissionId === null}
            onClick={() => {
              setFilterMissionId(null);
              setStatusFilter("all");
            }}
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
              filterMissionId === null
                ? "bg-emerald-400 text-[#0B1538] shadow-md shadow-emerald-500/30"
                : "border border-[#1a2a52] bg-[#0a1839] text-[#a8b8d0] hover:bg-[#0e1f4d] hover:text-[#f4ecd8]"
            }`}
          >
            전체 {items.length}
          </button>
          {missionChips.map((m) => {
            const active = filterMissionId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setFilterMissionId(active ? null : m.id);
                  // 미션 바뀌면 상태 필터도 'all' 로 리셋 — 이전 미션의 미승인=0 같은
                  // 상태가 새 미션에 그대로 적용되어 빈 결과 노출되는 문제 방지.
                  setStatusFilter("all");
                  }}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                  active
                    ? "bg-amber-400 text-[#0B1538] shadow-md shadow-amber-500/30"
                    : "border border-[#1a2a52] bg-[#0a1839] text-[#a8b8d0] hover:bg-[#0e1f4d] hover:text-[#f4ecd8]"
                }`}
                title={
                  active
                    ? `${m.title} 필터 해제 (전체로 돌아가기)`
                    : `${m.title} — ${m.count}장`
                }
              >
                <span aria-hidden className="mr-1">
                  {m.icon ?? "📷"}
                </span>
                <span className="max-w-[120px] truncate align-middle">
                  {m.title}
                </span>
                <span
                  className={`ml-1 font-mono ${active ? "" : "text-[#7a89a8]"}`}
                >
                  {m.count}
                </span>
                {active && (
                  <span
                    aria-hidden
                    className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0B1538]/15 text-[10px] font-bold"
                    title="필터 해제"
                  >
                    ✕
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 상태 필터 칩 (클릭 가능) + 페이지네이션 컨트롤.
          TV 모드는 디스플레이 전용이라 컨트롤 숨김. */}
      {missionFilteredItems.length > 0 && !isTvMode && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold">
          <div role="tablist" aria-label="검수 상태 필터" className="flex items-center gap-1.5">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "all"}
              onClick={() => {
                setStatusFilter("all");
              }}
              className={`rounded-full px-2 py-0.5 transition ${
                statusFilter === "all"
                  ? "bg-white/20 text-[#f4ecd8] ring-1 ring-white/40"
                  : "text-[#a8b8d0] ring-1 ring-white/10 hover:bg-white/10"
              }`}
            >
              전체 {statusCounts.all}
            </button>
            {/* 순서: 전체 → 미승인(작업 대상) → 승인 → 반려
                카운트 0 인 칩은 아예 숨김 (자동 승인 미션은 미승인/반려 0 → 칩 숨김). */}
            {statusCounts.pending > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === "pending"}
                onClick={() => {
                  setStatusFilter(
                    statusFilter === "pending" ? "all" : "pending"
                  );
                  }}
                className={`rounded-full px-2 py-0.5 transition ${
                  statusFilter === "pending"
                    ? "bg-amber-500/40 text-amber-50 ring-1 ring-amber-300/60"
                    : "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30 hover:bg-amber-500/25"
                }`}
              >
                ⏳ 미승인 {statusCounts.pending}
              </button>
            )}
            {statusCounts.approved > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === "approved"}
                onClick={() => {
                  setStatusFilter(
                    statusFilter === "approved" ? "all" : "approved"
                  );
                  }}
                className={`rounded-full px-2 py-0.5 transition ${
                  statusFilter === "approved"
                    ? "bg-emerald-500/40 text-emerald-50 ring-1 ring-emerald-300/60"
                    : "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30 hover:bg-emerald-500/25"
                }`}
              >
                ✓ 승인 {statusCounts.approved}
              </button>
            )}
            {statusCounts.rejected > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === "rejected"}
                onClick={() => {
                  setStatusFilter(
                    statusFilter === "rejected" ? "all" : "rejected"
                  );
                  }}
                className={`rounded-full px-2 py-0.5 transition ${
                  statusFilter === "rejected"
                    ? "bg-rose-500/40 text-rose-50 ring-1 ring-rose-300/60"
                    : "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/25"
                }`}
              >
                ✕ 반려 {statusCounts.rejected}
              </button>
            )}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <div className="text-5xl" aria-hidden>
            🌲
          </div>
          <div className="text-sm text-[#a8b8d0]">
            아직 올라온 사진이 없어요
          </div>
        </div>
      ) : (
        <div
          className={
            isTvMode
              ? ""
              : "scroll-dark min-h-0 flex-1 overflow-y-auto pr-1"
          }
        >
        <ul
          className={`grid gap-1.5 ${
            isTvMode ? "grid-cols-6" : "grid-cols-3 md:grid-cols-4"
          }`}
        >
          {list.map((p) => {
            // 위 정의된 isApproved/isPendingReview/isUnapproved 와 동일 정책.
            //  - PENDING_REVIEW 만 "검수" amber 뱃지
            //  - APPROVED / AUTO_APPROVED / SUBMITTED 는 "✓ 승인" emerald
            //  - REJECTED 는 "✕ 반려" rose
            const isPending = isPendingReview(p.status);
            const isApprovedSt = isApproved(p.status);
            const isRejected = p.status === "REJECTED";
            // 검수 진행에 따라 카드 외곽선 색 + 이미지 dim 처리.
            //  - 검수 대기: amber 테두리 + 살짝 amber 글로우 → "주목"
            //  - 승인 완료: emerald 테두리 (얇음) + 이미지 정상 → "처리됨, 평상시"
            //  - 반려:    rose 테두리 + 이미지 grayscale → "거절됨"
            const borderClass = isPending
              ? "border-amber-400/70 ring-1 ring-amber-400/40 shadow-md shadow-amber-500/20"
              : isRejected
                ? "border-rose-400/60 ring-1 ring-rose-400/20"
                : isApprovedSt
                  ? "border-emerald-400/40"
                  : "border-[#1a2a52]";
            const imgClass = isRejected
              ? "h-full w-full object-cover grayscale opacity-60 transition-transform group-hover:scale-105"
              : "h-full w-full object-cover transition-transform group-hover:scale-105";

            return (
            <li
              key={p.submissionId}
              className={`group relative aspect-square overflow-hidden rounded-md border bg-[#0a1839] ${borderClass}`}
              title={`${p.userDisplayName} · ${p.missionTitle} · ${fmtClockKstAlways(p.submittedAt)}`}
            >
              <button
                type="button"
                onClick={() => {
                  // PENDING: 검수 모달, APPROVED: revert 모달, REJECTED: 무동작.
                  if (isPending) {
                    setReviewingSubmissionId(p.submissionId);
                  } else if (isApprovedSt) {
                    setRevertingPhoto(p);
                  }
                }}
                disabled={isRejected || isTvMode}
                aria-label={
                  isPending
                    ? "검수하기"
                    : isApprovedSt
                      ? "되돌리기"
                      : "사진"
                }
                className={`block h-full w-full ${
                  isPending || isApprovedSt
                    ? "cursor-pointer"
                    : "cursor-default"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.missionTitle}
                  className={imgClass}
                  loading="lazy"
                />
              </button>
              {/* hover/tap overlay */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="truncate text-[10px] font-bold text-[#f4ecd8]">
                  {p.missionIcon ?? "📷"} {p.missionTitle}
                </div>
                <div className="truncate text-[9px] text-[#cad3e0]">
                  {p.userDisplayName}
                </div>
                <div className="font-mono text-[9px] text-[#a8b8d0]">
                  {fmtClockKstAlways(p.submittedAt)}
                </div>
              </div>
              {/* 상태 뱃지 — 검수 대기 사진은 ✅/❌ 액션 두 버튼이 항상 노출되어
                  뱃지를 대체. APPROVED/REJECTED 는 뱃지만 (호버 시 ❌ revert). */}
              {justApprovedId === p.submissionId ? (
                <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-emerald-500/95 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-md">
                  ✅ 승인됨
                </span>
              ) : isApprovedSt ? (
                <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white">
                  ✓ 승인
                </span>
              ) : isRejected ? (
                <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white">
                  ✕ 반려
                </span>
              ) : null}

              {/* 검수 액션 — 일반 모드일 때만.
                  - PENDING_REVIEW: ✅승인 + ❌반려 두 아이콘이 우상단에 항상 노출
                    (호버 없이도 즉시 클릭 가능. 모바일/태블릿 친화).
                  - APPROVED/AUTO_APPROVED/SUBMITTED: ❌되돌리기 (호버 시만 노출). */}
              {!isTvMode && justApprovedId !== p.submissionId && isPending && (
                <div className="absolute right-1 top-1 flex gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(p);
                    }}
                    disabled={
                      approvingId === p.submissionId ||
                      deletingId === p.submissionId
                    }
                    aria-label="바로 승인"
                    title="바로 승인"
                    className="inline-flex items-center gap-0.5 rounded-full bg-emerald-600/95 px-2 py-1 text-[10px] font-bold text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {approvingId === p.submissionId ? (
                      <span>⏳</span>
                    ) : (
                      <>
                        <span aria-hidden>✓</span>
                        <span>승인</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReviewingSubmissionId(p.submissionId);
                    }}
                    disabled={
                      approvingId === p.submissionId ||
                      deletingId === p.submissionId
                    }
                    aria-label="반려 (사유 입력)"
                    title="반려 (사유 입력)"
                    className="inline-flex items-center gap-0.5 rounded-full bg-rose-600/95 px-2 py-1 text-[10px] font-bold text-white shadow-md transition hover:bg-rose-500 disabled:opacity-50"
                  >
                    <span aria-hidden>✕</span>
                    <span>반려</span>
                  </button>
                </div>
              )}

              {/* APPROVED/AUTO_APPROVED/SUBMITTED — 호버 시 ❌ revert 모달 트리거.
                  잘못 승인된 사진을 되돌리기 위함 (도토리 자동 회수). */}
              {!isTvMode && justApprovedId !== p.submissionId && isApprovedSt && (
                <div className="absolute inset-x-1 top-7 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRevertingPhoto(p);
                    }}
                    disabled={
                      approvingId === p.submissionId ||
                      deletingId === p.submissionId
                    }
                    aria-label="되돌리기 (반려)"
                    title="잘못 승인됨 → 반려로 되돌리기 (도토리 회수)"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-600/95 text-xs font-bold text-white shadow-md transition hover:bg-rose-500 disabled:opacity-50"
                  >
                    ❌
                  </button>
                </div>
              )}

              {/* 운영자 삭제 버튼 — TV 모드에서는 숨김 */}
              {!isTvMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(p);
                  }}
                  disabled={deletingId === p.submissionId}
                  aria-label="사진 삭제"
                  title="사진을 사진 월에서 삭제 (운영자 전용)"
                  className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-rose-600 group-hover:opacity-100 disabled:opacity-50"
                >
                  {deletingId === p.submissionId ? "⏳" : "🗑"}
                </button>
              )}
            </li>
          );
          })}
          {/* 무한 스크롤 sentinel — viewport 에 들어오면 4장씩 더 로드 */}
          {hasMore && (
            <li
              ref={sentinelRef}
              aria-hidden
              className="col-span-full h-1"
            />
          )}
        </ul>
        </div>
      )}

      {/* 검토 대기 사진 반려 — InlineReviewModal (큐 안에서 다음 건 자동 처리) */}
      {reviewingSubmissionId && (
        <InlineReviewModal
          initialSubmissionId={reviewingSubmissionId}
          onClose={() => {
            setReviewingSubmissionId(null);
            router.refresh();
          }}
        />
      )}

      {/* 이미 승인된 사진 되돌리기 — 단발 reject prompt 모달 */}
      {revertingPhoto && (
        <RevertApprovedPhotoModal
          photo={revertingPhoto}
          onClose={() => setRevertingPhoto(null)}
          onDone={() => {
            // 낙관적 오버라이드 — 즉시 "승인" 필터에서 사라지게.
            const targetId = revertingPhoto.submissionId;
            setStatusOverrides((prev) => {
              const next = new Map(prev);
              next.set(targetId, "REJECTED");
              return next;
            });
            setRevertingPhoto(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* RevertApprovedPhotoModal — 이미 승인된 사진을 반려로 되돌리기                 */
/* -------------------------------------------------------------------------- */

function RevertApprovedPhotoModal({
  photo,
  onClose,
  onDone,
}: {
  photo: PhotoItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("다시 시도해 주세요");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("반려 사유를 입력해 주세요");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await rejectSubmissionAction(photo.submissionId, trimmed);
      if (result.ok) {
        onDone();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="승인된 사진 반려"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="border-b border-[#D4E4BC] bg-[#F5F1E8] px-4 py-3">
          <h2 className="text-sm font-bold text-rose-700">
            ⚠ 승인된 사진 반려로 되돌리기
          </h2>
          <p className="mt-1 text-[11px] text-[#6B6560]">
            {photo.missionIcon ?? "📷"} {photo.missionTitle} · {photo.userDisplayName}
          </p>
        </header>

        <div className="space-y-3 p-4">
          <div className="overflow-hidden rounded-xl border border-[#D4E4BC] bg-[#F5F1E8]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.missionTitle}
              className="max-h-[40vh] w-full object-contain"
            />
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
            ⚠ 반려하면 참가자에게 지급된 도토리가 자동 회수됩니다.
            <br />
            참가자는 이 미션을 다시 제출할 수 있어요.
          </div>

          <div>
            <label
              htmlFor={`revert-reason-${photo.submissionId}`}
              className="block text-[11px] font-bold text-rose-900"
            >
              반려 사유 (참가자에게 그대로 표시)
            </label>
            <textarea
              id={`revert-reason-${photo.submissionId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={pending}
              autoFocus
              placeholder="예: 사진이 흐려요 · 미션과 달라요"
              className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-[#2C2C2C] focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30 disabled:opacity-50"
            />
          </div>

          {error && (
            <p role="alert" className="text-[11px] font-semibold text-rose-700">
              ⚠ {error}
            </p>
          )}
        </div>

        <footer className="flex gap-2 border-t border-[#D4E4BC] p-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm font-bold text-[#3D3A36] transition hover:bg-[#F5F1E8] disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending || !reason.trim()}
            className="flex-[2] rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white shadow-md transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "처리 중..." : "반려로 되돌리기 (도토리 회수)"}
          </button>
        </footer>
      </div>
    </div>
  );
}
