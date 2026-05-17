"use client";

// 관제실 인라인 검수 모달
//  - PendingTile 행 클릭 시 열림 (initialSubmissionId 부터 표시)
//  - 마운트 시 loadPendingReviewsForControlRoomAction 으로 큐 전체 로드
//  - 큰 사진 + 메타 + ✅승인 / ❌반려 버튼
//  - 승인/반려 처리 → 큐에서 제거 + 자동으로 다음 건. 큐 비면 자동 닫힘.
//  - ←/→ 이전/다음 네비게이션, ESC 닫기

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  approveSubmissionAction,
  rejectSubmissionAction,
} from "@/lib/missions/review-actions";
import { loadPendingReviewsForControlRoomAction } from "../actions";
import { useLightbox, type LightboxItem } from "@/components/photo-lightbox";
import type { ReviewSubmissionItem } from "@/lib/missions/review-queries";

type Props = {
  initialSubmissionId: string;
  onClose: () => void;
};

/* -------------------------------------------------------------------------- */
/* payload 미리보기 유틸 — ReviewItemCard 와 동일 규칙                          */
/* -------------------------------------------------------------------------- */

function pickString(
  obj: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickFirstImageUrl(
  payload: Record<string, unknown>
): string | null {
  for (const key of ["photo_urls", "photos", "image_urls"]) {
    const v = payload[key];
    if (Array.isArray(v)) {
      for (const entry of v) {
        if (typeof entry === "string" && entry.trim()) return entry.trim();
        if (entry && typeof entry === "object") {
          const url = (entry as Record<string, unknown>).url;
          if (typeof url === "string" && url.trim()) return url.trim();
        }
      }
    }
  }
  return pickString(payload, ["image_url", "photo_url", "shared_photo_url"]);
}

function fmtAgo(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                       */
/* -------------------------------------------------------------------------- */

export function InlineReviewModal({
  initialSubmissionId,
  onClose,
}: Props) {
  const router = useRouter();
  const [queue, setQueue] = useState<ReviewSubmissionItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isPending, startTransition] = useTransition();

  // 마운트 시 큐 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loadPendingReviewsForControlRoomAction();
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.error);
        setIsLoading(false);
        return;
      }
      setQueue(result.items);
      // initialSubmissionId 인덱스 찾기 (없으면 0)
      const idx = result.items.findIndex((it) => it.id === initialSubmissionId);
      setCurrentIdx(idx >= 0 ? idx : 0);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialSubmissionId]);

  const current = queue[currentIdx] ?? null;

  // 큐가 빈 상태면 모달 자동 닫기 — 단, 로딩 중일 때는 닫지 않음
  useEffect(() => {
    if (!isLoading && queue.length === 0 && !loadError) {
      onClose();
    }
  }, [isLoading, queue.length, loadError, onClose]);

  // ESC / ←→ 키 — actionMsg 갱신은 useTransition 으로 묶여 있어 input 입력 중에도 동작.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (rejectOpen) {
          setRejectOpen(false);
          setRejectReason("");
        } else {
          onClose();
        }
        return;
      }
      // 입력 중에는 화살표 무시
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) {
        return;
      }
      if (e.key === "ArrowLeft") {
        setCurrentIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentIdx((i) => Math.min(queue.length - 1, i + 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queue.length, rejectOpen, onClose]);

  // 현재 사진 lightbox
  const lightboxItems: LightboxItem[] = useMemo(() => {
    if (!current) return [];
    const url = pickFirstImageUrl(current.payload ?? {});
    if (!url) return [];
    return [
      {
        url,
        caption: `${current.missionIcon ?? "📷"} ${current.missionTitle}`,
        subCaption: `${current.submitterDisplayName}${
          current.childName ? ` · ${current.childName}` : ""
        }`,
      },
    ];
  }, [current]);
  const { openAt, lightbox } = useLightbox(lightboxItems);

  const removeCurrentAndAdvance = useCallback(() => {
    setQueue((prev) => {
      const copy = prev.slice();
      copy.splice(currentIdx, 1);
      return copy;
    });
    // 인덱스 보정 — 마지막 행 처리하면 뒤로 한 칸
    setCurrentIdx((i) =>
      i >= queue.length - 1 ? Math.max(0, queue.length - 2) : i
    );
    setActionMsg(null);
    setRejectOpen(false);
    setRejectReason("");
  }, [currentIdx, queue.length]);

  const handleApprove = useCallback(() => {
    if (!current || isPending) return;
    setActionMsg(null);
    startTransition(async () => {
      const result = await approveSubmissionAction(current.id);
      if (result.ok) {
        removeCurrentAndAdvance();
        router.refresh();
      } else {
        setActionMsg(result.error);
      }
    });
  }, [current, isPending, removeCurrentAndAdvance, router]);

  const handleReject = useCallback(() => {
    if (!current || isPending) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setActionMsg("반려 사유를 입력해 주세요");
      return;
    }
    setActionMsg(null);
    startTransition(async () => {
      const result = await rejectSubmissionAction(current.id, reason);
      if (result.ok) {
        removeCurrentAndAdvance();
        router.refresh();
      } else {
        setActionMsg(result.error);
      }
    });
  }, [current, isPending, rejectReason, removeCurrentAndAdvance, router]);

  const now = Date.now();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="검수 모달"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between gap-2 border-b border-[#D4E4BC] bg-[#F5F1E8] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>📥</span>
            <span>검수</span>
            {queue.length > 0 && (
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-mono text-[#6B6560]">
                {currentIdx + 1} / {queue.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={isPending || currentIdx <= 0}
              aria-label="이전 검수"
              className="rounded-lg px-2 py-1 text-sm text-[#2D5A3D] transition hover:bg-white disabled:opacity-30"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrentIdx((i) => Math.min(queue.length - 1, i + 1))
              }
              disabled={isPending || currentIdx >= queue.length - 1}
              aria-label="다음 검수"
              className="rounded-lg px-2 py-1 text-sm text-[#2D5A3D] transition hover:bg-white disabled:opacity-30"
            >
              ›
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              aria-label="닫기"
              className="ml-1 rounded-lg px-2 py-1 text-sm text-[#6B6560] transition hover:bg-white disabled:opacity-40"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-[#6B6560]">
              큐 불러오는 중...
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              ⚠ {loadError}
            </div>
          ) : !current ? (
            <div className="py-12 text-center text-sm text-[#6B6560]">
              🎉 검수 대기 큐가 비었어요
            </div>
          ) : (
            <div className="space-y-3">
              {/* 미션 정보 */}
              <div className="flex items-start gap-3">
                <span className="text-3xl leading-none" aria-hidden>
                  {current.missionIcon ?? "📋"}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-[#2D5A3D] md:text-lg">
                    {current.missionTitle}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {current.missionKind && (
                      <span className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                        {current.missionKind}
                      </span>
                    )}
                    {current.packName && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                        📚 {current.packName}
                      </span>
                    )}
                    <span className="text-[11px] text-[#8B7F75]">
                      🌰 기본 {current.defaultAcorns}
                    </span>
                  </div>
                </div>
              </div>

              {/* 제출자 + 대기 시간 */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#F5F1E8] px-3 py-2 text-xs text-[#3D3A36]">
                <span>
                  🧑 <span className="font-bold">{current.submitterDisplayName}</span>
                  {current.childName && (
                    <span className="text-[#8B7F75]"> ({current.childName})</span>
                  )}
                </span>
                <span className="text-[#8B7F75]">
                  ⏳ 대기 {fmtAgo(current.submittedAt, now)}
                </span>
              </div>

              {/* 사진 — 크게 보여줌, 클릭 시 라이트박스로 확대 */}
              {lightboxItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => openAt(0)}
                  aria-label="사진 확대"
                  className="block w-full overflow-hidden rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] transition hover:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={lightboxItems[0].url}
                    alt="제출 이미지"
                    className="max-h-[55vh] w-full cursor-zoom-in object-contain"
                  />
                </button>
              )}

              {/* payload 캡션/답변 */}
              {(() => {
                const caption = pickString(current.payload ?? {}, [
                  "caption",
                  "answer",
                  "text",
                  "note",
                ]);
                if (!caption) return null;
                return (
                  <p className="rounded-xl bg-[#F5F1E8] p-3 text-xs text-[#2C2C2C]">
                    &ldquo;{caption}&rdquo;
                  </p>
                );
              })()}

              {/* fallback — 사진/캡션 둘 다 없으면 payload 원본 */}
              {lightboxItems.length === 0 &&
                !pickString(current.payload ?? {}, ["caption", "answer", "text", "note"]) &&
                Object.keys(current.payload ?? {}).length > 0 && (
                  <pre className="max-h-32 overflow-auto rounded-xl bg-[#F5F1E8] p-2 font-mono text-[10px] text-[#6B6560]">
                    {JSON.stringify(current.payload, null, 2).slice(0, 500)}
                  </pre>
                )}

              {/* 액션 영역 */}
              <div className="space-y-2 border-t border-[#D4E4BC] pt-3">
                {!rejectOpen ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isPending}
                      className="flex-1 rounded-xl bg-[#2D5A3D] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#3A7A52] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPending ? "처리 중..." : "✅ 승인"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionMsg(null);
                        setRejectOpen(true);
                      }}
                      disabled={isPending}
                      className="flex-1 rounded-xl border border-rose-300 bg-white px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ❌ 반려
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                    <label
                      htmlFor={`inline-reject-${current.id}`}
                      className="block text-[11px] font-semibold text-rose-900"
                    >
                      반려 사유를 적어 주세요
                    </label>
                    <textarea
                      id={`inline-reject-${current.id}`}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      disabled={isPending}
                      autoFocus
                      placeholder="예: 사진이 흐려요 · 미션과 달라요 · 다시 시도해 주세요"
                      className="mt-2 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs text-[#2C2C2C] focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30 disabled:opacity-50"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectOpen(false);
                          setRejectReason("");
                          setActionMsg(null);
                        }}
                        disabled={isPending}
                        className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] disabled:opacity-50"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={isPending || !rejectReason.trim()}
                        className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPending ? "처리 중..." : "반려 확정"}
                      </button>
                    </div>
                  </div>
                )}

                {actionMsg && (
                  <p
                    role="alert"
                    className="text-[11px] font-semibold text-rose-700"
                  >
                    ⚠ {actionMsg}
                  </p>
                )}
                <p className="text-[10px] text-[#8B7F75]">
                  💡 ← / → 키로 이동 · ESC 로 닫기
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      {lightbox}
    </div>
  );
}
