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
import { anonLabelFromUserId, type FmRequestRow } from "@/lib/tori-fm/types";

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

  // kind 별로 분리 + HIDDEN 제외
  const { songRows, storyRows } = useMemo(() => {
    const visible = requests.filter((r) => r.status !== "HIDDEN");
    const songs = visible.filter((r) => r.kind !== "story_only");
    const stories = visible.filter((r) => r.kind === "story_only");
    return {
      songRows: sortByCreatedDesc(songs),
      storyRows: sortByCreatedDesc(stories),
    };
  }, [requests]);

  const isDark = theme === "dark";

  /* -------------------------------------------------------------------------- */
  /* 단일 섹션 렌더 (filterKind 지정 시)                                          */
  /* -------------------------------------------------------------------------- */
  if (filterKind === "song_request") {
    const rows = songRows;
    const headerTitle = title ?? `🎵 오늘 들어온 신청곡 (${rows.length})`;
    return (
      <SongRequestSection
        rows={rows}
        title={headerTitle}
        isDark={isDark}
        hearted={hearted}
        pendingIds={pendingIds}
        handleHeart={handleHeart}
        flashKey={flashKey}
      />
    );
  }

  if (filterKind === "story_only") {
    const rows = storyRows;
    const headerTitle = title ?? `💌 사연 (${rows.length})`;
    return (
      <StorySection
        rows={rows}
        title={headerTitle}
        isDark={isDark}
        hearted={hearted}
        pendingIds={pendingIds}
        handleHeart={handleHeart}
        flashKey={flashKey}
      />
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
        />
      )}
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
};

function SongRequestSection({
  rows,
  title,
  isDark,
  hearted,
  pendingIds,
  handleHeart,
  flashKey = 0,
}: SectionProps) {
  if (isDark) {
    return (
      <section
        key={flashKey}
        className={`relative isolate rounded-2xl border-l-[5px] border-l-amber-300/70 border-y border-y-white/10 border-r border-r-white/10 bg-[#101935] p-4 text-white shadow-xl shadow-amber-500/10 transition-shadow duration-200 ease-out hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-amber-500/20 ${
          flashKey > 0 ? "flash-glow-amber" : ""
        }`}
      >
        {/* 외곽 글로우 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1 -z-10 rounded-3xl bg-amber-500/[0.06] blur-2xl"
        />
        <header className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-amber-100">{title}</h3>
        </header>

        {rows.length === 0 ? (
          <p className="mt-4 rounded-xl bg-white/5 p-4 text-center text-xs text-white/60">
            아직 신청곡이 없어요
          </p>
        ) : (
          <ul
            className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1
              [&::-webkit-scrollbar]:w-1.5
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:rounded-full
              [&::-webkit-scrollbar-thumb]:bg-white/20"
          >
            {rows.map((r) => {
              const isHearted = !!hearted[r.id];
              const isPending = !!pendingIds[r.id];
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-l-4 border-l-amber-300/50 border-y-white/10 border-r-white/10 bg-[#1B2552] p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      {/* 상태 뱃지 */}
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        {r.status === "PLAYED" && (
                          <span className="rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
                            방송됨
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
                          : r.child_name
                            ? `${r.child_name} 가족`
                            : ""}
                      </p>
                    </div>

                    <HeartButton
                      isHearted={isHearted}
                      isPending={isPending}
                      count={r.heart_count ?? 0}
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
                          방송됨
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
                        : r.child_name
                          ? `${r.child_name} 가족`
                          : ""}
                    </p>
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
}: SectionProps) {
  if (isDark) {
    return (
      <section
        key={flashKey}
        className={`relative isolate rounded-2xl border-l-[5px] border-l-indigo-300/70 border-y border-y-white/10 border-r border-r-white/10 bg-[#1a1638] p-4 text-white shadow-xl shadow-indigo-500/10 transition-shadow duration-200 ease-out hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-indigo-500/20 ${
          flashKey > 0 ? "flash-glow-indigo" : ""
        }`}
      >
        {/* 외곽 글로우 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1 -z-10 rounded-3xl bg-indigo-500/[0.06] blur-2xl"
        />
        <header className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-indigo-100">{title}</h3>
        </header>

        {rows.length === 0 ? (
          <p className="mt-4 rounded-xl bg-white/5 p-4 text-center text-xs text-white/60">
            아직 사연이 없어요
          </p>
        ) : (
          <ul
            className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1
              [&::-webkit-scrollbar]:w-1.5
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:rounded-full
              [&::-webkit-scrollbar-thumb]:bg-white/20"
          >
            {rows.map((r) => {
              const isHearted = !!hearted[r.id];
              const isPending = !!pendingIds[r.id];
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-l-4 border-l-violet-300/50 border-y-white/10 border-r-white/10 bg-[#251D55] p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      {/* 상태 뱃지 */}
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        {r.status === "PLAYED" && (
                          <span className="rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
                            방송됨
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

                      <blockquote className="border-l-2 border-violet-300/60 pl-3 text-[13px] leading-relaxed text-white/95">
                        {r.story?.trim() || "(사연 없음)"}
                      </blockquote>
                      <p className="mt-1.5 text-[10px] text-amber-200/80">
                        — {r.is_anonymous
                          ? anonLabelFromUserId(r.user_id)
                          : (r.child_name?.trim() || "보호자")}
                      </p>
                    </div>

                    <HeartButton
                      isHearted={isHearted}
                      isPending={isPending}
                      count={r.heart_count ?? 0}
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
                          방송됨
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
