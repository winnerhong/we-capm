"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import { fmtClockKstAlways } from "@/lib/datetime/kst";
import { useLightbox, type LightboxItem } from "@/components/photo-lightbox";
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

  // 필터링: 미션 선택 시 그 미션 사진만, 아니면 전체.
  // 미션이 deselect 됐는데 filterMissionId 가 사진월에 더이상 없으면 자동 리셋.
  const filteredItems = useMemo(() => {
    if (!filterMissionId) return items;
    const exists = items.some((p) => p.missionId === filterMissionId);
    if (!exists) return items;
    return items.filter((p) => p.missionId === filterMissionId);
  }, [items, filterMissionId]);

  // 전부 노출 — 그리드 영역 자체에 max-h + overflow-y-auto 적용해서
  // 위젯이 너무 길어지는 것 방지.
  const list = filteredItems;

  const lightboxItems: LightboxItem[] = useMemo(
    () =>
      list.map((p) => ({
        url: p.url,
        caption: `${p.missionIcon ?? "📷"} ${p.missionTitle}`,
        subCaption: `${p.userDisplayName} · ${fmtClockKstAlways(p.submittedAt)}`,
      })),
    [list]
  );
  const { openAt, lightbox } = useLightbox(lightboxItems);

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

  return (
    <div className={`${styles.surface} flex flex-col p-4`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          📸
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#a8b8d0]">
          사진 월
        </h2>
        <span className="ml-auto font-mono text-xs text-[#a8b8d0]">
          {filterMissionId
            ? `${filteredItems.length} / ${items.length}`
            : items.length}
        </span>
      </div>

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
            onClick={() => setFilterMissionId(null)}
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
                onClick={() => setFilterMissionId(active ? null : m.id)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                  active
                    ? "bg-amber-400 text-[#0B1538] shadow-md shadow-amber-500/30"
                    : "border border-[#1a2a52] bg-[#0a1839] text-[#a8b8d0] hover:bg-[#0e1f4d] hover:text-[#f4ecd8]"
                }`}
                title={`${m.title} — ${m.count}장`}
              >
                <span aria-hidden className="mr-1">{m.icon ?? "📷"}</span>
                <span className="max-w-[120px] truncate align-middle">
                  {m.title}
                </span>
                <span className={`ml-1 font-mono ${active ? "" : "text-[#7a89a8]"}`}>
                  {m.count}
                </span>
              </button>
            );
          })}
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
        <ul
          className={`grid gap-1.5 overflow-y-auto pr-1
            [&::-webkit-scrollbar]:w-1.5
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb]:bg-white/15
            ${
              isTvMode
                ? "max-h-[1400px] grid-cols-6"
                : "max-h-[640px] grid-cols-3 md:grid-cols-4"
            }`}
        >
          {list.map((p, i) => (
            <li
              key={p.submissionId}
              className="group relative aspect-square overflow-hidden rounded-md border border-[#1a2a52] bg-[#0a1839]"
              title={`${p.userDisplayName} · ${p.missionTitle} · ${fmtClockKstAlways(p.submittedAt)}`}
            >
              <button
                type="button"
                onClick={() => openAt(i)}
                aria-label="사진 확대 보기"
                className="block h-full w-full cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.missionTitle}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
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
              {/* 상태 뱃지 — 검수/반려/방금 승인됨 */}
              {justApprovedId === p.submissionId ? (
                <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-emerald-500/95 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-md">
                  ✅ 승인됨
                </span>
              ) : p.status === "PENDING_REVIEW" || p.status === "SUBMITTED" ? (
                <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white">
                  검수
                </span>
              ) : p.status === "REJECTED" ? (
                <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white">
                  반려
                </span>
              ) : null}

              {/* 검수 액션 — 일반 모드일 때만, 호버/탭 시 노출.
                  - PENDING_REVIEW/SUBMITTED: ✅승인 + ❌반려(InlineReviewModal)
                  - APPROVED/AUTO_APPROVED:   ❌되돌리기(자체 모달, 도토리 자동 회수)
                    잘못 승인했을 때 사용. confirm + 사유 입력. */}
              {!isTvMode && justApprovedId !== p.submissionId && (() => {
                const isPending =
                  p.status === "PENDING_REVIEW" || p.status === "SUBMITTED";
                const isApproved =
                  p.status === "APPROVED" || p.status === "AUTO_APPROVED";
                if (!isPending && !isApproved) return null;

                return (
                  <div className="absolute inset-x-1 top-7 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isPending) {
                          setReviewingSubmissionId(p.submissionId);
                        } else {
                          setRevertingPhoto(p);
                        }
                      }}
                      disabled={
                        approvingId === p.submissionId ||
                        deletingId === p.submissionId
                      }
                      aria-label={isApproved ? "되돌리기 (반려)" : "반려"}
                      title={
                        isApproved
                          ? "잘못 승인됨 → 반려로 되돌리기 (도토리 회수)"
                          : "반려 (사유 입력)"
                      }
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-600/95 text-xs font-bold text-white shadow-md transition hover:bg-rose-500 disabled:opacity-50"
                    >
                      ❌
                    </button>
                    {isPending && (
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
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600/95 text-xs font-bold text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {approvingId === p.submissionId ? "⏳" : "✅"}
                      </button>
                    )}
                  </div>
                );
              })()}

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
          ))}
        </ul>
      )}
      {lightbox}

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
