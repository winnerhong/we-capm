"use client";

// 공개된 사진 그리드 — 미션 화면 하단과 행사 사진 탭이 같이 쓴다.
//
// 서버 컴포넌트로 둘 수도 있지만, 사진을 눌러 크게 보고 넘겨보고 하트를 누르는
// 동작이 필요해 클라이언트로 둔다. 데이터는 부모(서버)가 이미 걸러서 넘겨준다.
//
// 크게 보기는 한 장짜리 팝업이 아니라 **넘겨보는 화면**이다. 한 장 보고 닫고
// 다시 누르게 하면 27장을 보는 데 27번을 눌러야 한다. 폰은 스와이프, PC는 좌우
// 버튼(+키보드 ←/→)으로 넘긴다.
//
// 좋아요는 도토리를 움직인다. 그래서 화면은 낙관적으로 먼저 칠하되 **판정은 늘
// 서버(DB 함수)** 다 — 실패하면 되돌리고 이유를 적는다. 남은 개수는 미션마다
// 따로 센다(행사 사진 탭에는 여러 미션 사진이 섞여 있다).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { FeedPhoto } from "@/lib/missions/photo-feed-queries";
import {
  LIKES_PER_MISSION,
  resolveLikeGate,
} from "@/lib/missions/photo-feed-core";
import { togglePhotoLikeAction } from "@/app/(event)/e/[eventId]/missions/actions";

/** 스와이프로 칠 최소 거리(px). 이보다 짧으면 그냥 누른 것으로 본다. */
const SWIPE_MIN_PX = 45;
/** 새 사진·승인이 들어왔을 때 서버에서 다시 받아오기까지의 디바운스. */
const REFRESH_DEBOUNCE_MS = 3000;

type LikeState = { liked: boolean; count: number };

export function PhotoGrid({
  photos,
  /** 미션 화면에서는 이미 제목을 알고 있어 칩을 숨긴다. */
  showMissionChip = true,
  /** 좋아요를 누르려면 필요하다. 없으면 하트는 숫자만 보여주는 표시가 된다. */
  eventId,
  viewerId,
  /** missionId → 내가 이 미션에서 이미 쓴 좋아요 수. */
  usedByMission = {},
  /** 실시간 구독 채널 이름. 없으면 구독하지 않는다. */
  channelKey,
  /** 행사 사진 탭 — 내 사진 / 미션별 필터 칩을 보여준다. */
  showFilters = false,
}: {
  photos: FeedPhoto[];
  showMissionChip?: boolean;
  eventId?: string;
  viewerId?: string;
  usedByMission?: Record<string, number>;
  channelKey?: string;
  showFilters?: boolean;
}) {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // 서버 값 위에 덧칠하는 낙관적 상태. 새로고침이 오면 같은 값이라 티가 안 난다.
  const [override, setOverride] = useState<Record<string, LikeState>>({});
  const [usedDelta, setUsedDelta] = useState<Record<string, number>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);

  const canInteract = Boolean(eventId && viewerId);

  // 필터 — "all" | "mine" | missionId. 사진이 많아지면 한 그리드는 너무 복잡하다.
  const [filter, setFilter] = useState<"all" | "mine" | string>("all");
  const missionTabs = useMemo(() => {
    if (!showFilters) return [];
    const m = new Map<string, { id: string; title: string; icon: string | null }>();
    for (const p of photos) {
      if (!m.has(p.missionId)) {
        m.set(p.missionId, {
          id: p.missionId,
          title: p.missionTitle,
          icon: p.missionIcon,
        });
      }
    }
    // "1. …" "2. …" 제목이 번호를 품고 있어 numeric 정렬이면 미션 순서가 된다.
    return [...m.values()].sort((a, b) =>
      a.title.localeCompare(b.title, "ko", { numeric: true })
    );
  }, [photos, showFilters]);
  const hasMine = Boolean(
    showFilters && viewerId && photos.some((p) => p.userId === viewerId)
  );
  const visible = useMemo(() => {
    if (!showFilters || filter === "all") return photos;
    if (filter === "mine") return photos.filter((p) => p.userId === viewerId);
    return photos.filter((p) => p.missionId === filter);
  }, [photos, filter, viewerId, showFilters]);
  const pickFilter = (next: "all" | "mine" | string) => {
    setFilter(next);
    setOpenIndex(null); // 크게 보기 인덱스는 필터된 목록 기준이라 같이 비운다.
  };

  // ⬇ 내 사진 전부 저장 — zip 이 아니라 그림 파일 그대로, 한 장씩 이어서 내려받는다.
  // (브라우저가 "여러 파일 다운로드 허용" 을 한 번 물을 수 있다.)
  const [savingAll, setSavingAll] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const saveAllMine = async () => {
    if (savingAll) return;
    const mine = photos.filter((p) => p.userId === viewerId);
    if (mine.length === 0) return;
    setSavingAll({ done: 0, total: mine.length });
    const seqByMission = new Map<string, number>();
    for (let i = 0; i < mine.length; i++) {
      const n = (seqByMission.get(mine[i].missionId) ?? 0) + 1;
      seqByMission.set(mine[i].missionId, n);
      await downloadMyPhoto(mine[i], n);
      setSavingAll({ done: i + 1, total: mine.length });
      // 연속 다운로드가 브라우저에 뭉개지지 않게 살짝 간격.
      await new Promise((r) => setTimeout(r, 400));
    }
    setSavingAll(null);
    setNotice("내 사진을 모두 저장했어요 📸");
  };

  // 끝에서 한 바퀴 돌지 않는다 — 어디가 끝인지 모른 채 계속 넘기게 된다.
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((cur) =>
        cur == null
          ? cur
          : Math.min(visible.length - 1, Math.max(0, cur + delta))
      ),
    [visible.length]
  );

  // 구독 콜백이 최신 목록을 봐야 하는데, 목록이 바뀔 때마다 재구독하면 채널이
  // 계속 끊겼다 붙는다. ref 로 흘려 넣고 구독은 채널 이름에만 매단다.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  /**
   * 실시간 갱신 — 하트 수는 **화면에서만** 고친다.
   *
   * 예전엔 어떤 변경이든 router.refresh() 를 걸었다. 그런데 좋아요 한 번이
   * mission_submissions UPDATE 를 일으키므로, 누군가 하트를 누를 때마다 모두의
   * 화면이 서버에서 통째로 다시 그려졌다 — 사진 60장이 다시 내려오고 그리드가
   * 하얗게 비는 그 증상이다. 하트 수는 payload 에 이미 들어 있으니 그 숫자만
   * 갈아끼우면 되고, 서버를 다시 부르는 건 **새 사진·승인처럼 목록 자체가
   * 달라지는 변경**뿐이다.
   */
  useEffect(() => {
    if (!channelKey) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let missed = false;

    const refreshSoon = () => {
      if (document.visibilityState !== "visible") {
        missed = true;
        return;
      }
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && missed) {
        missed = false;
        router.refresh();
      }
    };

    const channel = supabase
      .channel(`photo-feed:${channelKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mission_submissions" },
        (payload) => {
          const rec = payload.new as
            | { id?: string; like_count?: number }
            | undefined;
          const id = rec?.id;
          const known =
            !!id && photosRef.current.some((p) => p.submissionId === id);

          // 이미 보고 있는 사진의 UPDATE = 대개 하트. 숫자만 바꾸고 끝낸다.
          if (
            payload.eventType === "UPDATE" &&
            known &&
            typeof rec?.like_count === "number"
          ) {
            const nextCount = rec.like_count;
            setOverride((m) => {
              const photo = photosRef.current.find(
                (p) => p.submissionId === id
              );
              const cur = m[id!] ?? {
                liked: photo?.likedByMe ?? false,
                count: photo?.likeCount ?? 0,
              };
              if (cur.count === nextCount) return m; // 내가 방금 누른 그 값
              return { ...m, [id!]: { liked: cur.liked, count: nextCount } };
            });
            return;
          }

          refreshSoon();
        }
      )
      .subscribe();

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [channelKey, router]);

  const likeStateOf = useCallback(
    (p: FeedPhoto): LikeState =>
      override[p.submissionId] ?? { liked: p.likedByMe, count: p.likeCount },
    [override]
  );

  const usedIn = useCallback(
    (missionId: string) =>
      (usedByMission[missionId] ?? 0) + (usedDelta[missionId] ?? 0),
    [usedByMission, usedDelta]
  );

  const toggleLike = useCallback(
    async (p: FeedPhoto) => {
      if (!eventId || !viewerId || pendingId) return;
      const before = likeStateOf(p);
      const gate = resolveLikeGate({
        feedEnabled: true,
        // 피드에 오른 사진은 이미 확인이 끝난 것만이다.
        status: "AUTO_APPROVED",
        isMine: p.userId === viewerId,
        alreadyLiked: before.liked,
        usedInMission: usedIn(p.missionId),
      });
      if (!gate.canLike) {
        setNotice(gate.reason);
        return;
      }

      const next: LikeState = {
        liked: !before.liked,
        count: Math.max(0, before.count + (before.liked ? -1 : 1)),
      };
      setOverride((m) => ({ ...m, [p.submissionId]: next }));
      setUsedDelta((m) => ({
        ...m,
        [p.missionId]: (m[p.missionId] ?? 0) + (before.liked ? -1 : 1),
      }));
      setPendingId(p.submissionId);
      setNotice(null);

      const res = await togglePhotoLikeAction(p.submissionId, eventId);
      setPendingId(null);

      if (!res.ok) {
        // 되돌린다 — 서버가 거절했는데 하트만 채워져 있으면 다음에 또 누른다.
        setOverride((m) => ({ ...m, [p.submissionId]: before }));
        setUsedDelta((m) => ({
          ...m,
          [p.missionId]: (m[p.missionId] ?? 0) + (before.liked ? 1 : -1),
        }));
        setNotice(res.error);
        return;
      }

      // 서버가 센 값으로 맞춘다(동시에 누른 사람이 있으면 내 추정과 다르다).
      setOverride((m) => ({
        ...m,
        [p.submissionId]: { liked: res.liked, count: res.likeCount },
      }));
      setUsedDelta((m) => ({
        ...m,
        [p.missionId]: res.usedInMission - (usedByMission[p.missionId] ?? 0),
      }));
      setNotice(
        res.liked
          ? res.acornDelta > 0
            ? `하트를 보냈어요 — 이 가족에게 도토리 +${res.acornDelta}`
            : "하트를 보냈어요 (이 사진은 도토리를 다 채웠어요)"
          : "좋아요를 취소했어요"
      );
    },
    [eventId, viewerId, pendingId, likeStateOf, usedIn, usedByMission]
  );

  if (photos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-3 py-6 text-center text-xs leading-relaxed text-[#8B7F75]">
        아직 나눠준 사진이 없어요.
        <br />첫 번째 사진의 주인공이 되어보세요! 📸
      </p>
    );
  }

  return (
    <>
      {/* 필터 — 스탬프북풍 도장 그리드. 가로 스크롤 없이 전부 보인다. */}
      {showFilters && missionTabs.length > 0 && (
        <div className="mb-4 flex flex-wrap justify-center gap-x-1.5 gap-y-2 rounded-2xl bg-[#F5F1E8]/70 px-2 py-3">
          <FilterStamp
            icon="🌈"
            label="전체"
            active={filter === "all"}
            onClick={() => pickFilter("all")}
          />
          {hasMine && (
            <FilterStamp
              icon="⭐"
              label="내 사진"
              active={filter === "mine"}
              onClick={() => pickFilter("mine")}
            />
          )}
          {missionTabs.map((t) => {
            const numMatch = t.title.match(/^\s*(\d+)/);
            return (
              <FilterStamp
                key={t.id}
                icon={t.icon ?? "📷"}
                num={numMatch?.[1]}
                label={t.title.replace(/^\s*\d+\s*[.)]?\s*/, "")}
                active={filter === t.id}
                onClick={() => pickFilter(t.id)}
              />
            );
          })}
        </div>
      )}
      {/* ⬇ 내 사진 전부 저장 — "내 사진" 도장을 골랐을 때만 보인다. */}
      {showFilters && filter === "mine" && visible.length > 0 && (
        <button
          type="button"
          onClick={() => void saveAllMine()}
          disabled={savingAll !== null}
          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52] active:scale-[0.99] disabled:opacity-60"
        >
          {savingAll ? (
            <>저장 중 {savingAll.done}/{savingAll.total}…</>
          ) : (
            <>
              <span aria-hidden>⬇</span> 내 사진 전부 저장 ({visible.length}장)
            </>
          )}
        </button>
      )}
      {visible.length === 0 && (
        <p className="rounded-2xl bg-[#F5F1E8]/70 px-3 py-6 text-center text-xs font-semibold text-[#8B7F75]">
          🌱 이 항목에는 아직 사진이 없어요
        </p>
      )}
      <ul className="grid grid-cols-3 gap-2">
        {visible.map((p, i) => {
          const like = likeStateOf(p);
          return (
            <li key={`${p.submissionId}-${p.url}`}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenIndex(i)}
                  className="group block w-full overflow-hidden rounded-xl border border-[#D4E4BC] bg-[#FFF8F0]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={`${p.userName || "다른"} 가족의 ${p.missionTitle} 사진`}
                    className="aspect-square w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                  />
                </button>
                {p.userId === viewerId && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-[#2D5A3D]/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                    ⭐ 내 사진
                  </span>
                )}
                <HeartButton
                  like={like}
                  disabled={!canInteract || pendingId === p.submissionId}
                  isMine={p.userId === viewerId}
                  onClick={() => void toggleLike(p)}
                  size="sm"
                />
              </div>
              <p className="mt-1 truncate text-[10px] leading-tight text-[#6B6560]">
                {p.meta}
              </p>
              {showMissionChip && (
                <p className="truncate text-[10px] font-semibold leading-tight text-[#2D5A3D]">
                  {p.missionIcon ?? "📷"} {p.missionTitle}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {notice && (
        <p
          role="status"
          className="mt-3 rounded-2xl border border-[#D4E4BC] bg-[#F5F1E8]/70 px-3 py-2 text-center text-[11px] font-semibold text-[#2D5A3D]"
        >
          {notice}
        </p>
      )}

      {openIndex != null && visible[openIndex] && (
        <PhotoLightbox
          photos={visible}
          index={openIndex}
          like={likeStateOf(visible[openIndex])}
          likeDisabled={
            !canInteract || pendingId === visible[openIndex].submissionId
          }
          isMine={visible[openIndex].userId === viewerId}
          remaining={
            LIKES_PER_MISSION - usedIn(visible[openIndex].missionId)
          }
          onToggleLike={() => void toggleLike(visible[openIndex])}
          onClose={close}
          onStep={step}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* 하트                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 내 사진에는 하트를 띄우되 **누를 수 없게** 한다.
 * 감추면 "왜 내 사진만 좋아요가 없지" 가 되고, 받은 수는 주인이 제일 궁금하다.
 */
function HeartButton({
  like,
  disabled,
  isMine,
  onClick,
  size,
}: {
  like: LikeState;
  disabled: boolean;
  isMine: boolean;
  onClick: () => void;
  size: "sm" | "lg";
}) {
  const small = size === "sm";
  const label = isMine
    ? `내 사진이 받은 좋아요 ${like.count}개`
    : like.liked
      ? "좋아요 취소"
      : "좋아요";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (isMine) return;
        onClick();
      }}
      disabled={disabled || isMine}
      aria-label={label}
      aria-pressed={like.liked}
      className={`absolute inline-flex items-center gap-1 rounded-full bg-black/45 font-bold text-white backdrop-blur-sm transition disabled:opacity-70 ${
        small
          ? "bottom-1 right-1 px-1.5 py-0.5 text-[11px]"
          : "bottom-3 right-3 px-3 py-2 text-sm"
      } ${isMine ? "" : "hover:bg-black/60 active:scale-95"}`}
    >
      <span
        aria-hidden
        className={like.liked ? "text-rose-400" : "text-white/90"}
      >
        {like.liked ? "❤️" : "🤍"}
      </span>
      {like.count > 0 && <span>{like.count}</span>}
    </button>
  );
}

/**
 * 스탬프북풍 필터 도장 — 동그란 도장 + 아래 한 줄 라벨.
 * 고른 도장은 초록 잉크로 "찍힌" 모양(기울어짐 + 커짐)이 된다.
 */
function FilterStamp({
  icon,
  num,
  label,
  active,
  onClick,
}: {
  icon: string;
  /** 미션 번호 — 도장 오른쪽 위 작은 배지. */
  num?: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex w-[62px] flex-col items-center gap-1"
    >
      <span
        className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 text-xl transition-all duration-150 ${
          active
            ? "-rotate-6 scale-110 border-[#2D5A3D] bg-[#2D5A3D] text-white shadow-md"
            : "border-dashed border-[#C9BBA4] bg-white hover:border-[#2D5A3D]/50 hover:bg-[#FDFBF7]"
        }`}
      >
        <span aria-hidden className={active ? "" : "opacity-80 grayscale-[25%]"}>
          {icon}
        </span>
        {num && (
          <span
            className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold ${
              active
                ? "bg-amber-400 text-[#2D5A3D] shadow"
                : "bg-[#F5F1E8] text-[#8B7F75] ring-1 ring-[#D4E4BC]"
            }`}
          >
            {num}
          </span>
        )}
      </span>
      <span
        className={`w-full truncate text-center text-[9px] font-bold leading-tight ${
          active ? "text-[#2D5A3D]" : "text-[#8B7F75]"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* 크게 보기                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * 내 사진 저장 — signed URL 을 blob 으로 받아 파일로 내려준다.
 * <a download> 만으로는 cross-origin 이라 브라우저가 무시하고 새 탭을 연다.
 * fetch 실패(만료 등) 시엔 새 탭 fallback — 길게 눌러 저장은 언제나 된다.
 */
async function downloadMyPhoto(photo: FeedPhoto, seq?: number) {
  try {
    const res = await fetch(photo.url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const ext = blob.type.includes("png")
      ? "png"
      : blob.type.includes("webp")
        ? "webp"
        : "jpg";
    const safeTitle = (photo.missionTitle || "사진")
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safeTitle}${seq ? ` ${seq}` : ""}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch {
    window.open(photo.url, "_blank", "noopener");
  }
}

function PhotoLightbox({
  photos,
  index,
  like,
  likeDisabled,
  isMine,
  remaining,
  onToggleLike,
  onClose,
  onStep,
}: {
  photos: FeedPhoto[];
  index: number;
  like: LikeState;
  likeDisabled: boolean;
  isMine: boolean;
  remaining: number;
  onToggleLike: () => void;
  onClose: () => void;
  onStep: (delta: number) => void;
}) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  // 스와이프 판정용 — 터치가 시작된 자리.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // 스와이프 뒤에 딸려오는 click 으로 창이 닫히는 걸 막는다.
  const swiped = useRef(false);

  // 키보드 — PC 에서 버튼까지 마우스를 옮기지 않아도 되게.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onStep(-1);
      else if (e.key === "ArrowRight") onStep(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep]);

  // 뒤 화면이 같이 스크롤되면 옆으로 미는 손짓이 페이지 스크롤로 새어나간다.
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.changedTouches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // 세로로 더 많이 움직였으면 스와이프가 아니다 — 닫으려던 손짓일 수 있다.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy)) return;
    swiped.current = true;
    onStep(dx < 0 ? 1 : -1);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사진 크게 보기"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
      onClick={() => {
        if (swiped.current) {
          swiped.current = false;
          return;
        }
        onClose();
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 닫기 — 배경 아무 곳이나 눌러도 닫히지만, 눈에 보이는 출구도 있어야 한다. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg text-white transition hover:bg-white/25"
      >
        ✕
      </button>

      {/* 좌우 버튼 — PC 전용. 폰에는 스와이프가 있고, 이 크기 버튼은 사진을 가린다. */}
      <NavButton side="left" disabled={!hasPrev} onStep={onStep} />
      <NavButton side="right" disabled={!hasNext} onStep={onStep} />

      <div
        className="max-h-full w-full max-w-md overflow-y-auto"
        // 사진·설명을 눌렀을 때는 닫지 않는다 — 넘겨보다 잘못 닫히면 처음부터다.
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={photo.url}
            src={photo.url}
            alt={`${photo.userName || "다른"} 가족의 ${photo.missionTitle} 사진`}
            className="w-full rounded-2xl object-contain"
            draggable={false}
          />
          <HeartButton
            like={like}
            disabled={likeDisabled}
            isMine={isMine}
            onClick={onToggleLike}
            size="lg"
          />
        </div>
        {/* 누구 가족 사진인지가 첫눈에 — 가족 이름이 제일 크다.
            meta("이름 가족 · 3일 전")에서 이름은 위로 올렸으니 시각만 남긴다. */}
        {photo.userName && (
          <p className="mt-2 text-center text-lg font-extrabold text-white">
            👨‍👩‍👧 {photo.userName} 가족
          </p>
        )}
        <p className={`text-center text-xs font-semibold text-white/85 ${photo.userName ? "mt-0.5" : "mt-2"}`}>
          {photo.missionIcon ?? "📷"} {photo.missionTitle}
          {(() => {
            const when = photo.userName
              ? photo.meta
                  .replace(`${photo.userName} 가족`, "")
                  .replace(/^\s*·\s*/, "")
                  .trim()
              : photo.meta;
            return when ? (
              <span className="font-normal text-white/60"> · {when}</span>
            ) : null;
          })()}
        </p>
        {!isMine && (
          <p className="mt-1 text-center text-[11px] text-white/60">
            {remaining > 0
              ? `이 미션에서 좋아요 ${remaining}개 남았어요 · 하트 1개 = 도토리 1개`
              : "이 미션의 좋아요를 다 썼어요"}
          </p>
        )}
        {isMine && (
          <button
            type="button"
            onClick={() => void downloadMyPhoto(photo)}
            className="mx-auto mt-3 flex items-center justify-center gap-1.5 rounded-2xl bg-white px-6 py-2.5 text-sm font-bold text-[#2D5A3D] shadow-lg transition hover:bg-[#F5F1E8] active:scale-[0.98]"
          >
            <span aria-hidden>⬇</span> 내 사진 저장하기
          </button>
        )}
        <p className="mt-3 text-center text-[11px] text-white/50">
          <span className="font-semibold text-white/70">
            {index + 1} / {photos.length}
          </span>
          <span className="mx-1.5">·</span>
          <span className="sm:hidden">옆으로 밀어 다음 사진</span>
          <span className="hidden sm:inline">← → 키로도 넘겨요</span>
        </p>
      </div>

      {/* 앞뒤 사진 미리 받아두기 — 넘길 때 흰 화면이 스치지 않게. */}
      <div className="hidden">
        {[photos[index - 1], photos[index + 1]].map((p) =>
          p ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.url} src={p.url} alt="" aria-hidden />
          ) : null
        )}
      </div>
    </div>
  );
}

function NavButton({
  side,
  disabled,
  onStep,
}: {
  side: "left" | "right";
  disabled: boolean;
  onStep: (delta: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onStep(side === "left" ? -1 : 1);
      }}
      disabled={disabled}
      aria-label={side === "left" ? "이전 사진" : "다음 사진"}
      className={`absolute ${
        side === "left" ? "left-3" : "right-3"
      } top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl leading-none text-white transition hover:bg-white/25 disabled:cursor-default disabled:opacity-20 sm:flex`}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}
