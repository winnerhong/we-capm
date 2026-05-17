"use client";

// 토리FM 오늘 신청곡 + 익명 사연 — kind 별 섹션 렌더.
//   - 청취자 페이지: filterKind 미지정 → 두 섹션 분리 (베이지 + 인디고 라이트 톤)
//   - 호스트 콘솔: filterKind='song_request' | 'story_only' → 한 섹션만, theme='dark' 다크 군청 글래스
//   - 두 섹션 모두 created_at DESC (최신 우선) — 인기순은 호스트 StoryQueueCard 가 담당.
//   - 하트 토글: 우측, optimistic UI + Realtime(INSERT/UPDATE) 동기화
//   - 호스트 콘솔 / 청취자 페이지 동일 컴포넌트 (정보 카드)

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { toggleRequestHeartAction } from "@/lib/tori-fm/actions";
import {
  anonLabelFromUserId,
  withFamilySuffix,
  type FmRequestRow,
} from "@/lib/tori-fm/types";
import { BoostModal } from "./BoostModal";

type FilterKind = "song_request" | "story_only";
type Theme = "light" | "dark";

type Props = {
  sessionId: string;
  initialRequests: FmRequestRow[];
  heartedIds: string[];
  /** 한 종류만 표시. undefined면 두 섹션 (기존 청취자 페이지 호환). */
  filterKind?: FilterKind;
  /** dark면 호스트 콘솔용 다크 군청 글래스 톤. 기본 light. */
  theme?: Theme;
  /** 외부에서 카드 제목 override (다크 모드용). */
  title?: string;
  /** 청취자 화면에서 boost(끌어올리기) UI 노출. 호스트 콘솔은 false. */
  showBoost?: boolean;
  /** boost 모달용 현재 보유 도토리. SSR 시점 fresh value. */
  acornBalance?: number;
};

/** created_at DESC (최신 우선). */
function sortByCreatedDesc(arr: FmRequestRow[]): FmRequestRow[] {
  return [...arr].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function RequestsWithHearts({
  sessionId,
  initialRequests,
  heartedIds,
  filterKind,
  theme = "light",
  title,
  showBoost = false,
  acornBalance,
}: Props) {
  // 한 페이지에 여러 인스턴스(예: 호스트 콘솔의 song_request / story_only 두 카드)가
  // 마운트될 때 채널명 충돌 방지. useId 로 인스턴스별 고유 ID 부여.
  const instanceId = useId();
  const [requests, setRequests] = useState<FmRequestRow[]>(initialRequests);
  const [hearted, setHearted] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const id of heartedIds) map[id] = true;
    return map;
  });
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  // 호스트 다크 모드: 새 INSERT 발생 시 카드 외곽 글로우 1.5초 (key 토글로 재생).
  const [flashKey, setFlashKey] = useState(0);
  const [, startTransition] = useTransition();

  // boost 모달 상태 — boostingId 가 set 되어 있으면 모달 노출.
  const [boostingId, setBoostingId] = useState<string | null>(null);
  // 잔액은 prop fresh 값으로 시작 → boost 성공 시 result.newBalance 로 갱신.
  const [currentBalance, setCurrentBalance] = useState<number>(
    acornBalance ?? 0
  );
  useEffect(() => {
    if (typeof acornBalance === "number") setCurrentBalance(acornBalance);
  }, [acornBalance]);

  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();

    type RealtimePayload = {
      eventType?: "INSERT" | "UPDATE" | "DELETE";
      new?: FmRequestRow;
      old?: FmRequestRow;
    };

    const handle = (payload: RealtimePayload) => {
      const row = payload.new;
      if (!row || !row.id) return;
      if (row.status === "HIDDEN") {
        setRequests((prev) => prev.filter((r) => r.id !== row.id));
        return;
      }
      // INSERT 일 때만 글로우 트리거 — 기존 row 의 UPDATE 는 무시.
      if (payload.eventType === "INSERT") {
        // 다크 모드에서만 의미있음. light 라도 setState 비용은 무시 가능.
        // filterKind 기준 매칭되는 카드만 반응 — 청취자 페이지(filterKind 미지정)는 둘 다 받음.
        const matchesFilter =
          !filterKind ||
          (filterKind === "song_request" && row.kind !== "story_only") ||
          (filterKind === "story_only" && row.kind === "story_only");
        if (matchesFilter) setFlashKey((k) => k + 1);
      }
      setRequests((prev) => {
        const idx = prev.findIndex((r) => r.id === row.id);
        if (idx === -1) {
          if (payload.eventType === "INSERT") {
            return [row, ...prev];
          }
          return prev;
        }
        const copy = prev.slice();
        copy[idx] = row;
        return copy;
      });
    };

    const channel = supa
      .channel(`tori-fm-requests-${sessionId}-${instanceId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "tori_fm_requests",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        handle as never
      )
      .subscribe();

    return () => {
      supa.removeChannel(channel);
    };
  }, [sessionId, instanceId, filterKind]);

  const handleHeart = useCallback(
    (requestId: string) => {
      if (pendingIds[requestId]) return;

      const wasHearted = !!hearted[requestId];
      // optimistic UI
      setHearted((prev) => ({ ...prev, [requestId]: !wasHearted }));
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                heart_count: Math.max(
                  0,
                  (r.heart_count ?? 0) + (wasHearted ? -1 : 1)
                ),
              }
            : r
        )
      );
      setPendingIds((prev) => ({ ...prev, [requestId]: true }));

      startTransition(async () => {
        try {
          const result = await toggleRequestHeartAction(requestId);
          // 서버값으로 보정
          setHearted((prev) => ({ ...prev, [requestId]: result.hearted }));
        } catch {
          // 롤백
          setHearted((prev) => ({ ...prev, [requestId]: wasHearted }));
          setRequests((prev) =>
            prev.map((r) =>
              r.id === requestId
                ? {
                    ...r,
                    heart_count: Math.max(
                      0,
                      (r.heart_count ?? 0) + (wasHearted ? 1 : -1)
                    ),
                  }
                : r
            )
          );
        } finally {
          setPendingIds((prev) => {
            const copy = { ...prev };
            delete copy[requestId];
            return copy;
          });
        }
      });
    },
    [hearted, pendingIds]
  );

  // 정렬 모드 — 인기순(popularity) 디폴트 또는 최신순(created_at).
  const [sortMode, setSortMode] = useState<"popular" | "recent">("popular");

  // kind 별로 분리 + HIDDEN 제외. PLAYED 는 항상 뒤로, 그 안에서 sortMode 적용.
  const { songRows, storyRows } = useMemo(() => {
    const visible = requests.filter((r) => r.status !== "HIDDEN");
    const songs = visible.filter((r) => r.kind !== "story_only");
    const stories = visible.filter((r) => r.kind === "story_only");
    const popularityOf = (r: FmRequestRow) =>
      (r.heart_count ?? 0) + (r.boost_amount ?? 0);
    const innerSort =
      sortMode === "popular"
        ? (a: FmRequestRow, b: FmRequestRow) => {
            const diff = popularityOf(b) - popularityOf(a);
            if (diff !== 0) return diff;
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );
          }
        : (a: FmRequestRow, b: FmRequestRow) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime();
    // PLAYED 우선 뒤로 (true=1, false=0 → false 가 먼저)
    const sortFn = (a: FmRequestRow, b: FmRequestRow) => {
      const aPlayed = a.status === "PLAYED" ? 1 : 0;
      const bPlayed = b.status === "PLAYED" ? 1 : 0;
      if (aPlayed !== bPlayed) return aPlayed - bPlayed;
      return innerSort(a, b);
    };
    return {
      songRows: [...songs].sort(sortFn),
      storyRows: [...stories].sort(sortFn),
    };
  }, [requests, sortMode]);

  const isDark = theme === "dark";

  /* -------------------------------------------------------------------------- */
  /* 단일 섹션 렌더 (filterKind 지정 시)                                          */
  /* -------------------------------------------------------------------------- */
  const boostRow = boostingId
    ? requests.find((r) => r.id === boostingId) ?? null
    : null;

  // 인기 점수 = heart_count + boost_amount. 보내지 않은 상태(HIDDEN/PLAYED 등) 는 제외.
  const popularityOf = (r: FmRequestRow) =>
    (r.heart_count ?? 0) + (r.boost_amount ?? 0);
  const activeRequests = requests.filter(
    (r) =>
      r.status === "PENDING" ||
      r.status === "APPROVED" ||
      r.status === "QUEUED"
  );
  const sortedByPopularity = [...activeRequests].sort(
    (a, b) => popularityOf(b) - popularityOf(a)
  );
  const topScores = sortedByPopularity.slice(0, 3).map(popularityOf);
  const myScore = boostRow ? popularityOf(boostRow) : 0;
  // 1순위 점프 — 현재 방송 큐 #1 의 boost_amount + 본인이 이미 #1 인지.
  const queuedSorted = requests
    .filter((r) => r.status === "QUEUED")
    .sort(
      (a, b) =>
        (a.queue_position ?? Number.MAX_SAFE_INTEGER) -
        (b.queue_position ?? Number.MAX_SAFE_INTEGER)
    );
  const queueTopBoost = queuedSorted[0]?.boost_amount ?? 0;
  const isMyselfQueueFirst = boostRow
    ? queuedSorted[0]?.id === boostRow.id
    : false;

  const boostModalEl =
    showBoost && boostRow ? (
      <BoostModal
        requestId={boostRow.id}
        myScore={myScore}
        topScores={topScores}
        queueTopBoost={queueTopBoost}
        isMyselfQueueFirst={isMyselfQueueFirst}
        songLabel={
          boostRow.song_title
            ? `🎵 ${boostRow.song_title}${boostRow.artist ? ` — ${boostRow.artist}` : ""}`
            : "💌 사연"
        }
        initialBalance={currentBalance}
        onClose={() => setBoostingId(null)}
        onSuccess={({ newBalance, spent }) => {
          setCurrentBalance(newBalance);
          // 낙관적: boost_amount 즉시 반영. Realtime UPDATE 가 들어오면 sync.
          setRequests((prev) =>
            prev.map((r) =>
              r.id === boostRow.id
                ? {
                    ...r,
                    boost_amount: (r.boost_amount ?? 0) + spent,
                    last_boost_at: new Date().toISOString(),
                  }
                : r
            )
          );
          setBoostingId(null);
        }}
      />
    ) : null;

  if (filterKind === "song_request") {
    const rows = songRows;
    const headerTitle = title ?? `🎵 오늘 들어온 신청곡 (${rows.length})`;
    return (
      <>
        <SongRequestSection
          rows={rows}
          title={headerTitle}
          isDark={isDark}
          hearted={hearted}
          pendingIds={pendingIds}
          handleHeart={handleHeart}
          flashKey={flashKey}
          showBoost={showBoost}
          onBoost={setBoostingId}
          sortMode={sortMode}
          onSortChange={setSortMode}
        />
        {boostModalEl}
      </>
    );
  }

  if (filterKind === "story_only") {
    const rows = storyRows;
    const headerTitle = title ?? `💌 사연 (${rows.length})`;
    return (
      <>
        <StorySection
          rows={rows}
          title={headerTitle}
          isDark={isDark}
          hearted={hearted}
          pendingIds={pendingIds}
          handleHeart={handleHeart}
          flashKey={flashKey}
          showBoost={showBoost}
          onBoost={setBoostingId}
          sortMode={sortMode}
          onSortChange={setSortMode}
        />
        {boostModalEl}
      </>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* 두 섹션 분리 렌더 (기존 청취자 페이지 동작)                                   */
  /* -------------------------------------------------------------------------- */

  // 둘 다 비어있으면 한 줄 안내
  if (songRows.length === 0 && storyRows.length === 0) {
    if (isDark) {
      return (
        <section className="relative isolate rounded-2xl border-l-[5px] border-l-amber-300/50 border-y border-y-white/10 border-r border-r-white/10 bg-[#101935] p-4 text-white shadow-xl">
          <h3 className="text-sm font-bold text-amber-100">
            🎵 오늘 들어온 신청곡 · 사연
          </h3>
          <p className="mt-4 rounded-xl bg-white/5 p-4 text-center text-xs text-white/60">
            아직 사연이 없어요.
          </p>
        </section>
      );
    }
    return (
      <section className="rounded-3xl border border-amber-200/60 bg-[#FFF8F0]/80 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-[#2D5A3D]">
          🎵 오늘 들어온 신청곡 · 사연
        </h3>
        <p className="mt-4 rounded-xl bg-white/60 p-4 text-center text-xs text-[#6B6560]">
          아직 사연이 없어요. 첫 사연을 보내 보세요!
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* 🎵 신청곡 */}
      {songRows.length > 0 && (
        <SongRequestSection
          rows={songRows}
          title={`🎵 오늘 들어온 신청곡 (${songRows.length})`}
          isDark={isDark}
          hearted={hearted}
          pendingIds={pendingIds}
          handleHeart={handleHeart}
          flashKey={flashKey}
          showBoost={showBoost}
          onBoost={setBoostingId}
          sortMode={sortMode}
          onSortChange={setSortMode}
        />
      )}

      {/* 💌 사연 */}
      {storyRows.length > 0 && (
        <StorySection
          rows={storyRows}
          title={`💌 사연 (${storyRows.length})`}
          isDark={isDark}
          hearted={hearted}
          pendingIds={pendingIds}
          handleHeart={handleHeart}
          flashKey={flashKey}
          showBoost={showBoost}
          onBoost={setBoostingId}
          sortMode={sortMode}
          onSortChange={setSortMode}
        />
      )}
      {boostModalEl}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Section 컴포넌트                                                            */
/* -------------------------------------------------------------------------- */

type SectionProps = {
  rows: FmRequestRow[];
  title: string;
  isDark: boolean;
  hearted: Record<string, boolean>;
  pendingIds: Record<string, boolean>;
  handleHeart: (id: string) => void;
  /** INSERT 글로우 키 — 0이면 글로우 없음, > 0 이면 1.5초 외곽 펄스 (key prop 으로 재시작). */
  flashKey?: number;
  /** 청취자 화면에서만 boost UI 노출. */
  showBoost?: boolean;
  /** boost 모달 트리거 — request id 전달. */
  onBoost?: (requestId: string) => void;
  /** 인기순 정렬 시 메달/순위 prefix 노출. */
  sortMode?: "popular" | "recent";
  /** 정렬 토글 핸들러 — 헤더 옆 토글 버튼. 없으면 토글 미노출. */
  onSortChange?: (mode: "popular" | "recent") => void;
};

/**
 * TOP 3 메달 + 4·5등 숫자 prefix. 6위부터는 null.
 * sortMode === "popular" 일 때만 의미 있음.
 */
function rankPrefix(idx: number): { kind: "medal" | "num" | null; label: string } {
  if (idx === 0) return { kind: "medal", label: "🥇" };
  if (idx === 1) return { kind: "medal", label: "🥈" };
  if (idx === 2) return { kind: "medal", label: "🥉" };
  if (idx === 3 || idx === 4) return { kind: "num", label: String(idx + 1) };
  return { kind: null, label: "" };
}

/** 정렬 토글 버튼 — 헤더 옆에 inline. */
function SortToggle({
  mode,
  onChange,
  isDark,
}: {
  mode: "popular" | "recent";
  onChange: (m: "popular" | "recent") => void;
  isDark: boolean;
}) {
  const baseBtn = isDark
    ? "px-2 py-0.5 rounded-full text-[10px] font-bold transition"
    : "px-2 py-0.5 rounded-full text-[10px] font-bold transition";
  const activeCls = isDark
    ? "bg-amber-400 text-[#0B1538]"
    : "bg-violet-600 text-white";
  const inactiveCls = isDark
    ? "bg-white/10 text-white/70 hover:bg-white/15"
    : "bg-[#F5F1E8] text-[#6B6560] hover:bg-violet-100";
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange("popular")}
        className={`${baseBtn} ${mode === "popular" ? activeCls : inactiveCls}`}
      >
        🔥 인기
      </button>
      <button
        type="button"
        onClick={() => onChange("recent")}
        className={`${baseBtn} ${mode === "recent" ? activeCls : inactiveCls}`}
      >
        🆕 최신
      </button>
    </div>
  );
}

/**
 * boost 뱃지 + "끌어올리기" 버튼.
 *  - boost_amount > 0 일 때만 좌측 뱃지 노출
 *  - showBoost=false 면 아무것도 렌더하지 않음 (호스트 콘솔)
 */
function BoostBar({
  request,
  isDark,
  show,
  onBoost,
}: {
  request: FmRequestRow;
  isDark: boolean;
  show: boolean;
  onBoost?: (id: string) => void;
}) {
  if (!show) return null;
  const hasBoost = request.boost_amount > 0;
  // PLAYING/PLAYED/HIDDEN 은 boost 불가 — 액션에서도 거부하지만 UX 도 잠금.
  const lockedStatus =
    request.status === "PLAYING" ||
    request.status === "PLAYED" ||
    request.status === "HIDDEN";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {hasBoost && (
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            isDark
              ? "bg-fuchsia-500/25 text-fuchsia-100 ring-1 ring-fuchsia-300/40"
              : "bg-fuchsia-100 text-fuchsia-700 ring-1 ring-fuchsia-300/60"
          }`}
          title={`경매가 +${request.boost_amount.toLocaleString("ko-KR")} 도토리`}
        >
          💎 +{request.boost_amount.toLocaleString("ko-KR")}
        </span>
      )}
      {!lockedStatus && onBoost && (
        <button
          type="button"
          onClick={() => onBoost(request.id)}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
            isDark
              ? "bg-white/[0.06] text-fuchsia-200 hover:bg-fuchsia-500/20 hover:text-fuchsia-100"
              : "bg-white text-fuchsia-700 ring-1 ring-fuchsia-200 hover:bg-fuchsia-50"
          }`}
        >
          💎 끌어올리기
        </button>
      )}
    </div>
  );
}

function SongRequestSection({
  rows,
  title,
  isDark,
  hearted,
  pendingIds,
  handleHeart,
  flashKey = 0,
  showBoost = false,
  onBoost,
  sortMode = "popular",
  onSortChange,
}: SectionProps) {
  if (isDark) {
    return (
      <section
        className={`relative isolate rounded-2xl border-l-[5px] border-l-amber-300/70 border-y border-y-white/10 border-r border-r-white/10 bg-[#101935] p-4 text-white shadow-md shadow-amber-500/10 ${
          flashKey > 0 ? "flash-glow-amber" : ""
        }`}
      >
        {/* 외곽 글로우 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1 -z-10 rounded-3xl bg-amber-500/[0.06] blur-2xl"
        />
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-amber-100">{title}</h3>
          {onSortChange && (
            <SortToggle mode={sortMode} onChange={onSortChange} isDark={true} />
          )}
        </header>

        {rows.length === 0 ? (
          <p className="mt-4 rounded-xl bg-white/5 p-4 text-center text-xs text-white/60">
            아직 신청곡이 없어요
          </p>
        ) : (
          <ul
            className="scroll-dark mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1"
          >
            {rows.map((r, idx) => {
              const isHearted = !!hearted[r.id];
              const isPending = !!pendingIds[r.id];
              const rank = sortMode === "popular" ? rankPrefix(idx) : { kind: null, label: "" };
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-l-4 border-l-amber-300/50 border-y-white/10 border-r-white/10 bg-[#1B2552] p-3"
                >
                  <div className="flex items-start gap-3">
                    {rank.kind === "medal" && (
                      <span aria-label={`${idx + 1}위`} className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-base">
                        {rank.label}
                      </span>
                    )}
                    {rank.kind === "num" && (
                      <span aria-label={`${idx + 1}위`} className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-[11px] font-bold text-amber-200">
                        {rank.label}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      {/* 상태 뱃지 */}
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        {r.status === "PLAYED" && (
                          <span className="rounded-full bg-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-100 ring-1 ring-emerald-400/50">
                            ✓ 방송된 곡입니다
                          </span>
                        )}
                        {r.status === "APPROVED" && (
                          <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
                            ✓ 승인
                          </span>
                        )}
                        {r.status === "QUEUED" && (
                          <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                            📥 큐
                            {r.queue_position != null
                              ? ` #${r.queue_position}`
                              : ""}
                          </span>
                        )}
                        {r.status === "PLAYING" && (
                          <span className="rounded-full bg-rose-400/30 px-1.5 py-0.5 text-[10px] font-semibold text-rose-100">
                            ▶ 재생 중
                          </span>
                        )}
                      </div>

                      <p className="truncate text-sm font-bold text-white/95">
                        {r.song_title ?? "(사연만)"}
                        {r.artist && (
                          <span className="ml-1 text-xs font-normal text-white/60">
                            — {r.artist}
                          </span>
                        )}
                      </p>
                      {r.story && (
                        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/80">
                          “{r.story}”
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-amber-200/80">
                        {r.is_anonymous
                          ? anonLabelFromUserId(r.user_id)
                          : withFamilySuffix(r.child_name)}
                      </p>
                      <BoostBar
                        request={r}
                        isDark={true}
                        show={showBoost}
                        onBoost={onBoost}
                      />
                    </div>

                    <HeartButton
                      isHearted={isHearted}
                      isPending={isPending}
                      count={(r.heart_count ?? 0) + (r.boost_amount ?? 0)}
                      tone="dark"
                      onClick={() => handleHeart(r.id)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  // light 톤 (기존)
  return (
    <section className="rounded-3xl border border-amber-200/60 bg-[#FFF8F0]/80 p-4 shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#2D5A3D]">
          🎵 오늘 들어온 신청곡
          <span className="ml-1 text-[11px] font-normal text-[#6B6560]">
            ({rows.length})
          </span>
        </h3>
      </header>

      <ul
        className="mt-3 max-h-[420px] divide-y divide-amber-200/40 overflow-y-auto pr-1
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb]:bg-amber-300/40"
      >
        {rows.map((r) => {
          const isHearted = !!hearted[r.id];
          const isPending = !!pendingIds[r.id];
          return (
            <li key={r.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="group rounded-2xl border border-l-4 border-l-amber-400 border-y-amber-100/60 border-r-amber-100/60 bg-white/80 p-3 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {/* 상태 뱃지 */}
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      {r.status === "PLAYED" && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          ✓ 방송된 곡입니다
                        </span>
                      )}
                      {r.status === "APPROVED" && (
                        <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          ✓ 승인
                        </span>
                      )}
                      {r.status === "QUEUED" && (
                        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          📥 큐
                          {r.queue_position != null
                            ? ` #${r.queue_position}`
                            : ""}
                        </span>
                      )}
                      {r.status === "PLAYING" && (
                        <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                          ▶ 재생 중
                        </span>
                      )}
                    </div>

                    <p className="truncate text-sm font-bold text-[#2D5A3D]">
                      {r.song_title ?? "(사연만)"}
                      {r.artist && (
                        <span className="ml-1 text-xs font-normal text-[#6B6560]">
                          — {r.artist}
                        </span>
                      )}
                    </p>
                    {r.story && (
                      <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[#3d3833]">
                        “{r.story}”
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-[#6B6560]">
                      {r.is_anonymous
                        ? anonLabelFromUserId(r.user_id)
                        : withFamilySuffix(r.child_name)}
                    </p>
                    <BoostBar
                      request={r}
                      isDark={false}
                      show={showBoost}
                      onBoost={onBoost}
                    />
                  </div>

                  <HeartButton
                    isHearted={isHearted}
                    isPending={isPending}
                    count={r.heart_count ?? 0}
                    tone="default"
                    onClick={() => handleHeart(r.id)}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StorySection({
  rows,
  title,
  isDark,
  hearted,
  pendingIds,
  handleHeart,
  flashKey = 0,
  showBoost = false,
  onBoost,
  sortMode = "popular",
  onSortChange,
}: SectionProps) {
  if (isDark) {
    return (
      <section
        className={`relative isolate rounded-2xl border-l-[5px] border-l-indigo-300/70 border-y border-y-white/10 border-r border-r-white/10 bg-[#1a1638] p-4 text-white shadow-md shadow-indigo-500/10 ${
          flashKey > 0 ? "flash-glow-indigo" : ""
        }`}
      >
        {/* 외곽 글로우 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1 -z-10 rounded-3xl bg-indigo-500/[0.06] blur-2xl"
        />
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-indigo-100">{title}</h3>
          {onSortChange && (
            <SortToggle mode={sortMode} onChange={onSortChange} isDark={true} />
          )}
        </header>

        {rows.length === 0 ? (
          <p className="mt-4 rounded-xl bg-white/5 p-4 text-center text-xs text-white/60">
            아직 사연이 없어요
          </p>
        ) : (
          <ul
            className="scroll-dark mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1"
          >
            {rows.map((r, idx) => {
              const isHearted = !!hearted[r.id];
              const isPending = !!pendingIds[r.id];
              const rank = sortMode === "popular" ? rankPrefix(idx) : { kind: null, label: "" };
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-l-4 border-l-violet-300/50 border-y-white/10 border-r-white/10 bg-[#251D55] p-3"
                >
                  <div className="flex items-start gap-3">
                    {rank.kind === "medal" && (
                      <span aria-label={`${idx + 1}위`} className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-base">
                        {rank.label}
                      </span>
                    )}
                    {rank.kind === "num" && (
                      <span aria-label={`${idx + 1}위`} className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-violet-400/20 text-[11px] font-bold text-violet-200">
                        {rank.label}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      {/* 상태 뱃지 */}
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        {r.status === "PLAYED" && (
                          <span className="rounded-full bg-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-100 ring-1 ring-emerald-400/50">
                            ✓ 방송된 곡입니다
                          </span>
                        )}
                        {r.status === "APPROVED" && (
                          <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
                            ✓ 승인
                          </span>
                        )}
                        {r.status === "QUEUED" && (
                          <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                            📥 큐
                            {r.queue_position != null
                              ? ` #${r.queue_position}`
                              : ""}
                          </span>
                        )}
                        {r.status === "PLAYING" && (
                          <span className="rounded-full bg-rose-400/30 px-1.5 py-0.5 text-[10px] font-semibold text-rose-100">
                            ▶ 재생 중
                          </span>
                        )}
                      </div>

                      {r.story?.trim() && (
                        <blockquote className="border-l-2 border-violet-300/60 pl-3 text-[13px] leading-relaxed text-white/95">
                          “{r.story.trim()}”
                        </blockquote>
                      )}
                      <p className="mt-1.5 text-[10px] text-amber-200/80">
                        — {r.is_anonymous
                          ? anonLabelFromUserId(r.user_id)
                          : (r.child_name?.trim() || "보호자")}
                      </p>
                      <BoostBar
                        request={r}
                        isDark={true}
                        show={showBoost}
                        onBoost={onBoost}
                      />
                    </div>

                    <HeartButton
                      isHearted={isHearted}
                      isPending={isPending}
                      count={(r.heart_count ?? 0) + (r.boost_amount ?? 0)}
                      tone="dark"
                      onClick={() => handleHeart(r.id)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  // light 톤 (기존 인디고)
  return (
    <section className="rounded-3xl border border-indigo-200/60 bg-indigo-50/50 p-4 shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-indigo-900">
          💌 사연
          <span className="ml-1 text-[11px] font-normal text-indigo-700/70">
            ({rows.length})
          </span>
        </h3>
      </header>

      <ul
        className="mt-3 max-h-[420px] divide-y divide-indigo-200/40 overflow-y-auto pr-1
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb]:bg-indigo-300/40"
      >
        {rows.map((r) => {
          const isHearted = !!hearted[r.id];
          const isPending = !!pendingIds[r.id];
          return (
            <li key={r.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="group rounded-2xl border border-l-4 border-l-indigo-400 border-y-indigo-100/60 border-r-indigo-100/60 bg-indigo-50/40 p-3 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {/* 상태 뱃지 */}
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      {r.status === "PLAYED" && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          ✓ 방송된 곡입니다
                        </span>
                      )}
                      {r.status === "APPROVED" && (
                        <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          ✓ 승인
                        </span>
                      )}
                      {r.status === "QUEUED" && (
                        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          📥 큐
                          {r.queue_position != null
                            ? ` #${r.queue_position}`
                            : ""}
                        </span>
                      )}
                      {r.status === "PLAYING" && (
                        <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                          ▶ 재생 중
                        </span>
                      )}
                    </div>

                    <blockquote className="border-l-2 border-indigo-300 pl-3 text-[13px] leading-relaxed text-[#2a2440]">
                      {r.story?.trim() || "(사연 없음)"}
                    </blockquote>
                    <p className="mt-1.5 text-[10px] text-indigo-700/80">
                      — {r.is_anonymous
                        ? anonLabelFromUserId(r.user_id)
                        : (r.child_name?.trim() || "보호자")}
                    </p>
                    <BoostBar
                      request={r}
                      isDark={false}
                      show={showBoost}
                      onBoost={onBoost}
                    />
                  </div>

                  <HeartButton
                    isHearted={isHearted}
                    isPending={isPending}
                    count={r.heart_count ?? 0}
                    tone="indigo"
                    onClick={() => handleHeart(r.id)}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 공용 하트 버튼                                                              */
/* -------------------------------------------------------------------------- */

function HeartButton({
  isHearted,
  isPending,
  count,
  tone = "default",
  onClick,
}: {
  isHearted: boolean;
  isPending: boolean;
  count: number;
  tone?: "default" | "indigo" | "dark";
  onClick: () => void;
}) {
  const base =
    "flex min-h-[44px] min-w-[56px] flex-none flex-col items-center justify-center rounded-xl border transition active:scale-95 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-pink-300";

  let skin: string;
  if (tone === "dark") {
    skin = isHearted
      ? "border-rose-400/40 bg-rose-500/20 text-rose-400"
      : "border-white/15 bg-white/[0.04] text-white/40 hover:border-rose-300/40 hover:bg-rose-500/10 hover:text-rose-300";
  } else if (isHearted) {
    skin = "border-pink-300 bg-pink-100 text-pink-600";
  } else if (tone === "indigo") {
    skin =
      "border-indigo-200 bg-white text-indigo-500 hover:border-pink-200 hover:bg-pink-50 hover:text-pink-500";
  } else {
    skin =
      "border-amber-200 bg-white text-[#6B6560] hover:border-pink-200 hover:bg-pink-50";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      aria-label={isHearted ? "하트 취소" : "하트 누르기"}
      aria-pressed={isHearted}
      className={`${base} ${skin}`}
    >
      <span className="text-lg leading-none" aria-hidden>
        {isHearted ? "❤" : "♡"}
      </span>
      <span className="mt-0.5 text-[10px] font-bold tabular-nums">{count}</span>
    </button>
  );
}
