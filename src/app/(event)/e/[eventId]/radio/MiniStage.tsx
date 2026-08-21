"use client";

// 참가자 토리FM 페이지의 미니 전광판 — "보고 느끼는 무대".
//
// 역할:
//   - 전광판(/screen/tori-fm/[orgId])과 동일한 라이브 신호를 받아 사용자에게 보여줌
//   - sub-second NOW PLAYING 갱신 (router.refresh 의존 X)
//   - VFX 4종(FloatingHearts · DriftUpChat · TopBanner · EmojiRain)을 카드 내부에
//     가두어 인터랙션 영역(아래 ChatPanel/리액션 등)을 가리지 않음
//   - StorySpotlight 만 풀스크린(풀화면 의도적 takeover)
//   - 청취자 카운트 + 경과 타이머로 "다 같이 듣는다" 분위기
//
// 컨테이너 트릭:
//   stage 카드를 `position: relative overflow-hidden` 으로 잡아두면 ScreenEffectsLayer
//   안의 VFX 4종(absolute inset-0) 이 자동으로 카드 영역에 갇힘. StorySpotlight 는
//   `position: fixed` 라 풀스크린 그대로 발사됨.
//
// 데이터 흐름은 ScreenLive 와 동일 — 두 화면이 같은 채널을 구독하므로 DJ 가 보내는
// 신호 한 번이 전광판·참가자 양쪽에 동시 반영.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ToriFmSessionRow } from "@/lib/missions/types";
import { ListenerPresence } from "@/components/tori-fm/ListenerPresence";
import { fmtShortDateKst } from "@/lib/datetime/kst";
import { ScreenEffectsLayer } from "@/app/screen/tori-fm/[orgId]/vfx/ScreenEffectsLayer";
import {
  anonLabelFromUserId,
  type FmChatMessageRow,
  type FmRequestRow,
} from "@/lib/tori-fm/types";
import { ReactionBar } from "./ReactionBar";
import { LiveChatComposer } from "./LiveChatComposer";
import { LiveChatStream } from "./LiveChatStream";
import { PlayerRpsModal } from "@/lib/rps/PlayerRpsModal";
import {
  cheerNowPlayingAction,
  getCheerCountAction,
  getMyCheerSentCountAction,
} from "@/lib/tori-fm/actions";
import { AcornIcon } from "@/components/acorn-icon";

/** 같은 곡 묶음 사연 1건 (작성자 라벨은 서버에서 결정해 넘김). */
export interface MiniStagePlayingItem {
  id: string;
  story: string | null;
  authorLabel: string;
  createdAt: string;
}

export interface MiniStageNowPlaying {
  /** PLAYING 신청의 request id — 응원 하트(cheer) 트리거에 사용. */
  requestId?: string;
  /** PLAYING 신청자의 user id — 본인 곡 응원 차단 판정. */
  ownerUserId?: string;
  song: string;
  artist: string;
  story: string;
  childName: string;
  /** 신청 종류 — 'story_only' 면 사연 리더 모드(워름톤) 카드. */
  kind?: "song_request" | "story_only" | null;
  /** 작성자가 익명 옵션을 선택했는지. */
  isAnonymous?: boolean;
  /**
   * 같은 곡(song_normalized) 묶음 사연 N건 — 비어있거나 1건이면 단일 모드(기존 호환).
   * 2건 이상이면 곡명 한 번 + 사연 리스트(시간순) 렌더.
   */
  storyItems?: MiniStagePlayingItem[];
}

interface QueueItemRow {
  id: string;
  fm_session_id: string | null;
  submission_id: string;
}

interface SubmissionRow {
  id: string;
  payload_json: {
    song_title?: string;
    artist?: string;
    story_text?: string;
    child_name?: string;
  };
}

interface Props {
  orgId: string;
  brandName: string;
  initialSession: ToriFmSessionRow | null;
  initialNowPlaying: MiniStageNowPlaying | null;
  /** 초기 채팅 메시지 — LiveChatStream SSR 에서 사용. */
  initialChatMessages?: FmChatMessageRow[];
  /** 현재 로그인 유저 — 카톡 스타일에서 본인 메시지 우측 배치. */
  currentUserId?: string | null;
  /** SSR 에서 prefetch 한 현재 PLAYING 곡의 받은/보낸 응원 카운트 초기값. */
  initialCheerCount?: number;
  /**
   * NOW PLAYING 카드 아래, 채팅 위에 추가로 렌더할 노드.
   * 보통 BroadcastQueueViewer (방송 대기 큐) 가 들어옴.
   */
  middleSlot?: React.ReactNode;
}

// Realtime 채널이 정상이면 거의 즉시 NOW PLAYING 이 바뀌지만, 일시적으로 끊겼을
// 때 폴링 fallback 으로 보완. 5초 → 2초로 축소 — 호스트가 [▶ 다음 곡] 누른
// 직후 참가자 화면이 더 빠르게 새 곡으로 전환.
const POLL_FALLBACK_MS = 2_000;

function fmtElapsed(startedAt: string | null, nowMs: number): string {
  if (!startedAt) return "";
  const t = new Date(startedAt).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** "5분 전" / "방금 전" — created_at 기준 한국어 상대 시간. */
function fmtRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 30) return "방금 전";
  if (diffSec < 60) return `${diffSec}초 전`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return fmtShortDateKst(iso);
}

function fmtTimeRange(start: string, end: string): string {
  try {
    // KST 강제 — 브라우저 timezone 무관
    const fmt = (iso: string) =>
      new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(iso));
    return `${fmt(start)} ~ ${fmt(end)}`;
  } catch {
    return "";
  }
}

export function MiniStage({
  orgId,
  brandName,
  initialSession,
  initialNowPlaying,
  initialChatMessages = [],
  currentUserId = null,
  initialCheerCount = 0,
  middleSlot,
}: Props) {
  const [session, setSession] = useState<ToriFmSessionRow | null>(initialSession);
  const [nowPlaying, setNowPlaying] = useState<MiniStageNowPlaying | null>(
    initialNowPlaying
  );
  // refetch 안에서 최신 nowPlaying 을 참조해야 하지만, useCallback 의존성에 nowPlaying
  // 을 넣으면 nowPlaying 갱신 시마다 refetch 재생성 → realtime 채널 재구독 발생 (heavy).
  // ref 로 미러링해서 의존성 X 로 안정화.
  const nowPlayingRef = useRef<MiniStageNowPlaying | null>(initialNowPlaying);
  useEffect(() => {
    nowPlayingRef.current = nowPlaying;
  }, [nowPlaying]);

  // NOW PLAYING 응원 하트 — 누른 사람 -1 도토리, 신청자 +1 도토리.
  // cheerCount 는 현재 PLAYING 곡이 받은 누적 응원 (UI 표시용, 로컬 optimistic).
  // initialCheerCount 로 SSR prefetch 값 받아 첫 paint 부터 정확한 값 표시.
  const cheerRouter = useRouter();
  const [cheerCount, setCheerCount] = useState(initialCheerCount);
  const [cheerPending, setCheerPending] = useState(false);
  const [cheerError, setCheerError] = useState<string | null>(null);
  // 곡 바뀌면 에러만 클리어. 카운트는 0 리셋하지 않음 — 0 으로 잠시 보이고
  // polling fetch 완료 후 갱신되면 "사라졌다 다시 뜬다" 처럼 보이므로.
  // polling fetch 가 곧 정확한 값으로 덮어쓰기 때문에 stale 위험 없음.
  useEffect(() => {
    setCheerError(null);
  }, [nowPlaying?.requestId]);

  // 카운터 polling — 곡 마다 분기:
  //  - 본인 신청 곡: 받은 응원 (FM_CHEER_RECEIVE) — RLS 로 신청자만 정확
  //  - 다른 시청자: 본인이 보낸 응원 (FM_CHEER_SEND) — 자기 transaction, 재방문 시 복원
  useEffect(() => {
    const reqId = nowPlaying?.requestId;
    const ownerId = nowPlaying?.ownerUserId;
    if (!reqId || !currentUserId) return;
    const isOwner = ownerId === currentUserId;
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const n = isOwner
          ? await getCheerCountAction(reqId)
          : await getMyCheerSentCountAction(reqId);
        if (!cancelled) setCheerCount(n);
      } catch {
        /* 폴링 실패는 조용히 무시 */
      }
    };
    fetchCount();
    // 본인 곡은 다른 사람 응원 빠르게 반영 위해 3초, 다른 시청자는 본인만 카운트 → 10초로 가볍게
    const interval = isOwner ? 3_000 : 10_000;
    const t = setInterval(fetchCount, interval);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [nowPlaying?.requestId, nowPlaying?.ownerUserId, currentUserId]);

  async function handleCheer() {
    if (cheerPending || !nowPlaying?.requestId) return;
    if (nowPlaying.ownerUserId && nowPlaying.ownerUserId === currentUserId) {
      setCheerError("본인 곡에는 응원할 수 없어요");
      setTimeout(() => setCheerError(null), 2000);
      return;
    }
    setCheerPending(true);
    setCheerError(null);
    // optimistic +1
    setCheerCount((c) => c + 1);
    const result = await cheerNowPlayingAction(nowPlaying.requestId);
    setCheerPending(false);
    if (!result.ok) {
      // rollback
      setCheerCount((c) => Math.max(0, c - 1));
      setCheerError(result.error);
      setTimeout(() => setCheerError(null), 2000);
      return;
    }
    // 서버의 cheeredTotal 은 RLS 때문에 응원자 자신은 0 반환 →
    // optimistic +1 이 0 으로 rollback 되어 "살짝 떴다 사라짐" 발생.
    // 본인 곡이면 polling(3초)이 정확한 값으로 동기화하니 여기서 덮어쓰지 않음.
    // 다른 시청자는 본인 클릭 누적 (optimistic) 만 표시.
    // 상단 layout 의 도토리 잔액(server props) 즉시 갱신.
    cheerRouter.refresh();
  }
  // SSR/CSR 간 시각 불일치로 hydration mismatch 가 발생하지 않도록
  // 초기값은 null. 마운트 후 useEffect 에서 Date.now() 로 채우고 1초 간격 갱신.
  const [now, setNow] = useState<number | null>(null);
  const lastQueueIdRef = useRef<string | null>(
    initialSession?.current_queue_id ?? null
  );

  // ── 풀스크린 토글 상태 ──────────────────────────────────────────
  const stageRef = useRef<HTMLElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // 브라우저 Fullscreen API 종료 감지 (ESC / 시스템 종료) — CSS 폴백 모드도 같이 동기화
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (fullscreen) {
      // 종료 — Fullscreen API 사용 중이면 exit, 아니면 CSS 폴백 해제
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          /* ignore */
        }
      }
      setFullscreen(false);
      return;
    }
    // 진입 — Fullscreen API 시도, 실패해도 CSS 폴백으로 진입
    const el = stageRef.current;
    if (el && typeof el.requestFullscreen === "function") {
      try {
        await el.requestFullscreen();
        setFullscreen(true);
        // 화면 회전 잠금 해제 — 디바이스 방향에 자연스럽게 따라가도록.
        // 일부 모바일 브라우저는 풀스크린 진입 시 landscape 로 강제하는 잔재 lock 이
        // 남아있을 수 있어 명시적 unlock 호출.
        const so = (
          screen as unknown as {
            orientation?: { unlock?: () => void };
          }
        ).orientation;
        if (so && typeof so.unlock === "function") {
          try {
            so.unlock();
          } catch {
            /* 미지원 브라우저는 무시 */
          }
        }
        return;
      } catch {
        /* iOS Safari 등 미지원 — CSS 폴백 */
      }
    }
    setFullscreen(true);
  }, [fullscreen]);

  /* ------------------------------------------------------------------------ */
  /* Refetch (ScreenLive 동일 패턴)                                            */
  /* ------------------------------------------------------------------------ */

  const refetch = useCallback(async () => {
    const supa = createClient();

    const sessionResp = (await (
      supa.from("tori_fm_sessions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: boolean) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (n: number) => {
                  maybeSingle: () => Promise<{
                    data: ToriFmSessionRow | null;
                  }>;
                };
              };
            };
          };
        };
      }
    )
      .select(
        "id, org_id, event_id, name, scheduled_start, scheduled_end, is_live, started_at, ended_at, current_queue_id, notes, created_at"
      )
      .eq("org_id", orgId)
      .eq("is_live", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: ToriFmSessionRow | null };

    const newSession = sessionResp.data;
    setSession(newSession);

    const newSessionId = newSession?.id ?? null;
    const queueId = newSession?.current_queue_id ?? null;

    // 1) tori_fm_requests PLAYING 우선 — 신규 큐 시스템(kind/is_anonymous 포함).
    //    같은 song_normalized 의 PLAYING row 가 여러 건일 수 있어 묶음으로 조회.
    if (newSessionId) {
      const playingGroupResp = (await (
        supa.from("tori_fm_requests" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => {
                order: (
                  c: string,
                  o: { ascending: boolean }
                ) => Promise<{ data: FmRequestRow[] | null }>;
              };
            };
          };
        }
      )
        .select("*")
        .eq("session_id", newSessionId)
        .eq("status", "PLAYING")
        .order("created_at", { ascending: true })) as {
        data: FmRequestRow[] | null;
      };

      const group = playingGroupResp.data ?? [];
      const head = group[0] ?? null;
      if (head) {
        lastQueueIdRef.current = queueId;
        const storyItems = group.map((r) => ({
          id: r.id,
          story: r.story,
          authorLabel: r.is_anonymous
            ? anonLabelFromUserId(r.user_id)
            : (r.child_name?.trim() ?? ""),
          createdAt: r.created_at,
        }));
        setNowPlaying({
          requestId: head.id,
          ownerUserId: head.user_id,
          song: head.song_title?.trim() || "(사연만)",
          artist: head.artist ?? "",
          story: head.story ?? "",
          childName: head.is_anonymous
            ? anonLabelFromUserId(head.user_id)
            : (head.child_name ?? ""),
          kind: head.kind,
          isAnonymous: head.is_anonymous,
          storyItems,
        });
        return;
      }
    }

    // PLAYING row 가 없는 경우(곡 전환 race 또는 정지 후) — nowPlaying 을 null 로
    // 즉시 비워서 stale 표시 방지. queueId 비교 skip 제거.
    if (!queueId) {
      lastQueueIdRef.current = null;
      setNowPlaying(null);
      return;
    }

    // 2) 레거시 mission_radio_queue 경로 (kind 없음) — fallback.
    const queueResp = (await (
      supa.from("mission_radio_queue" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: QueueItemRow | null }>;
          };
        };
      }
    )
      .select("id, fm_session_id, submission_id")
      .eq("id", queueId)
      .maybeSingle()) as { data: QueueItemRow | null };

    const queueRow = queueResp.data;
    if (!queueRow) {
      lastQueueIdRef.current = queueId;
      setNowPlaying(null);
      return;
    }

    const submissionResp = (await (
      supa.from("mission_submissions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: SubmissionRow | null }>;
          };
        };
      }
    )
      .select("id, payload_json")
      .eq("id", queueRow.submission_id)
      .maybeSingle()) as { data: SubmissionRow | null };

    const submission = submissionResp.data;
    const p = submission?.payload_json ?? {};

    lastQueueIdRef.current = queueId;
    setNowPlaying({
      song: typeof p.song_title === "string" ? p.song_title : "",
      artist: typeof p.artist === "string" ? p.artist : "",
      story: typeof p.story_text === "string" ? p.story_text : "",
      childName: typeof p.child_name === "string" ? p.child_name : "",
      kind: "song_request",
      isAnonymous: false,
      storyItems: [],
    });
  }, [orgId]);

  /* ------------------------------------------------------------------------ */
  /* Realtime + 폴링 fallback                                                  */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!orgId) return;
    const supa = createClient();
    let cancelled = false;

    const handle = () => {
      if (cancelled) return;
      void refetch();
    };

    const channel = supa
      .channel(`fm-mini-stage-${orgId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "tori_fm_sessions",
          filter: `org_id=eq.${orgId}`,
        } as never,
        handle as never
      )
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "mission_radio_queue",
          filter: `org_id=eq.${orgId}`,
        } as never,
        handle as never
      )
      // tori_fm_requests UPDATE 가 status='PLAYING' 으로 바뀌면 즉시 반영.
      // (org_id 기준으로 필터 불가 — 세션 ID 가 안정 후 별도 구독은 비용 큼.
      // 폴링과 함께 다른 두 구독이 거의 항상 잡아주지만, * UPDATE 도 hook
      // 으로 받아 빠른 반영 보장. RLS 가 있어 비싸진 않음.)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "tori_fm_requests",
        } as never,
        handle as never
      )
      .subscribe();

    const poll = setInterval(handle, POLL_FALLBACK_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
      void supa.removeChannel(channel);
    };
  }, [orgId, refetch]);

  /* ------------------------------------------------------------------------ */
  /* 1초 clock — 경과 타이머용                                                 */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!session?.is_live || !session.started_at) return;
    setNow(Date.now()); // 마운트 즉시 한 번 — null 상태로 머무는 깜빡임 최소화
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session?.is_live, session?.started_at]);

  /* ------------------------------------------------------------------------ */
  /* 파생                                                                      */
  /* ------------------------------------------------------------------------ */

  const sessionLive = !!session?.is_live;
  const sessionId = session?.id ?? null;
  const elapsed = useMemo(
    () => (now == null ? "" : fmtElapsed(session?.started_at ?? null, now)),
    [session?.started_at, now]
  );
  const timeRange = useMemo(
    () =>
      session
        ? fmtTimeRange(session.scheduled_start, session.scheduled_end)
        : "",
    [session]
  );

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */

  return (
    <section
      ref={stageRef}
      className={`relative isolate flex flex-col overflow-hidden text-white shadow-xl ${
        fullscreen
          ? "fixed inset-0 z-50 rounded-none"
          : "min-h-[85vh] rounded-3xl"
      }`}
      aria-label="토리FM 보이는 라디오"
    >
      {/* ① 풀블리드 배경 — 깊은 네이비 그라디언트 (기본값). 위는 거의 검정,
          아래로 내려올수록 짙은 파랑으로 부드럽게 변화 — 사연/채팅 가독성 ↑. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-[#070C1F] via-[#0B1538] to-[#0F1F4A]"
      />

      {/* ② VFX 오버레이 — 하트/이모지/스토리.
          DriftUpChat 은 LiveChatStream 인라인 채팅과 중복 노출되므로 OFF. */}
      <ScreenEffectsLayer sessionId={sessionId} disableDriftChat />

      {/* ③ 상단 HUD — 좌(브랜드 + LIVE) / 우(청취자 + 채우기) — 글래스 온 네이비 */}
      <div className="relative z-20 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          {/* 브랜드 알약 */}
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 backdrop-blur-md">
            <span className="text-base" aria-hidden>
              📻
            </span>
            <span className="truncate text-sm font-extrabold tracking-wide text-white">
              {brandName}
            </span>
            {sessionLive ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-md shadow-rose-500/30"
                aria-label="ON AIR"
              >
                <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                LIVE
              </span>
            ) : (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white/70 ring-1 ring-white/15">
                OFF AIR
              </span>
            )}
          </div>
          {/* 시간대 / 경과 — 한 줄 유지 (좁아져도 줄바꿈 X) */}
          <div className="flex items-center gap-1.5">
            {sessionLive && elapsed && (
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] tabular-nums text-amber-200 backdrop-blur-md">
                <span aria-hidden>⏱</span>
                {elapsed}
              </span>
            )}
            {timeRange && (
              <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-white/70 backdrop-blur-md">
                {timeRange}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 backdrop-blur-md">
            <ListenerPresence orgId={orgId} variant="light" />
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "원래 크기로" : "화면 채우기"}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-md transition hover:bg-white/15"
          >
            <span aria-hidden>{fullscreen ? "✕" : "⛶"}</span>
            <span className="hidden whitespace-nowrap sm:inline">
              {fullscreen ? "닫기" : "채우기"}
            </span>
          </button>
        </div>
      </div>

      {/* ④ 본문 — Now Playing 핀 카드 (가운데 비주얼 영역, 글래스 톤).
          kind === 'story_only' 또는 (song 비고 story 있음) 이면 사연 리더 모드 카드. */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-3 py-6 sm:px-6">
        {sessionLive ? (
          nowPlaying ? (
            (() => {
              const isStoryMode =
                nowPlaying.kind === "story_only" ||
                (!nowPlaying.song.trim() && !!nowPlaying.story.trim()) ||
                nowPlaying.song.trim() === "(사연만)";

              if (isStoryMode) {
                return (
                  <div className="w-full max-w-md rounded-3xl border border-amber-300/30 bg-gradient-to-br from-violet-900/40 via-purple-900/30 to-amber-900/40 p-5 shadow-2xl shadow-amber-500/20 backdrop-blur-md md:p-6">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200/90">
                        💌 사연 읽는 중
                      </p>
                      <span
                        aria-label="받은 응원"
                        className="inline-flex items-center gap-1 rounded-full bg-rose-500/30 px-2 py-0.5 text-[11px] font-bold text-rose-100 ring-1 ring-rose-400/50"
                      >
                        <span aria-hidden className={cheerCount > 0 ? "animate-pulse" : ""}>❤</span>
                        {cheerCount}
                      </span>
                    </div>
                    {nowPlaying.story ? (
                      <blockquote className="mt-3 border-l-4 border-amber-300/50 pl-4 text-xl font-semibold leading-relaxed text-amber-100 md:text-2xl">
                        <span aria-hidden className="mr-1 text-amber-300/70">
                          ❝
                        </span>
                        {nowPlaying.story}
                      </blockquote>
                    ) : (
                      <p className="mt-3 text-amber-200/70">사연 준비 중…</p>
                    )}
                    {nowPlaying.childName && (
                      <p className="mt-4 text-right text-sm text-amber-200/80">
                        — {nowPlaying.childName}
                      </p>
                    )}
                    <CheerButton
                      onClick={handleCheer}
                      pending={cheerPending}
                      count={cheerCount}
                      error={cheerError}
                      tone="story"
                    />
                  </div>
                );
              }

              const filledItems = (nowPlaying.storyItems ?? []).filter(
                (it) => (it.story ?? "").trim().length > 0
              );
              const isBundle = filledItems.length >= 2;

              return (
                <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/40 backdrop-blur-md">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300/90">
                      ♪ Now Playing
                      {isBundle && (
                        <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-amber-200 ring-1 ring-amber-300/40">
                          사연 {filledItems.length}건
                        </span>
                      )}
                    </p>
                    {cheerCount > 0 && (
                      <span
                        aria-label="받은 응원"
                        className="inline-flex items-center gap-1 rounded-full bg-rose-500/30 px-2 py-0.5 text-[11px] font-bold text-rose-100 ring-1 ring-rose-400/50"
                      >
                        <span aria-hidden className="animate-pulse">❤</span>
                        {cheerCount}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 break-words text-2xl font-extrabold tracking-tight text-amber-100 md:text-3xl">
                    {nowPlaying.song || "(제목 미입력)"}
                  </h2>
                  {nowPlaying.artist && (
                    <p className="mt-0.5 text-sm font-semibold text-amber-200/80">
                      — {nowPlaying.artist}
                    </p>
                  )}
                  {isBundle ? (
                    <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1
                      [&::-webkit-scrollbar]:w-1.5
                      [&::-webkit-scrollbar-track]:bg-transparent
                      [&::-webkit-scrollbar-thumb]:rounded-full
                      [&::-webkit-scrollbar-thumb]:bg-white/15">
                      {filledItems.map((it) => (
                        <li
                          key={it.id}
                          className="border-l-2 border-amber-300/40 pl-3"
                        >
                          <p className="text-sm leading-relaxed text-white/95">
                            <span aria-hidden className="mr-0.5 text-amber-300/70">
                              ❝
                            </span>
                            {it.story}
                            <span aria-hidden className="ml-0.5 text-amber-300/70">
                              ❞
                            </span>
                          </p>
                          <p className="mt-1 text-[11px] text-amber-200/70">
                            — {it.authorLabel || "익명의 청취자"}
                            <span className="ml-1.5 text-amber-200/50">
                              · {fmtRelative(it.createdAt)}
                            </span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <>
                      {nowPlaying.story && (
                        <blockquote className="mt-3 border-l-2 border-amber-300/50 pl-3 text-[13px] leading-relaxed text-white/95">
                          &ldquo;{nowPlaying.story}&rdquo;
                        </blockquote>
                      )}
                      {nowPlaying.childName && (
                        <p className="mt-2 text-right text-[11px] font-semibold text-amber-200/75">
                          — {nowPlaying.childName}
                        </p>
                      )}
                    </>
                  )}
                  <CheerButton
                    onClick={handleCheer}
                    pending={cheerPending}
                    count={cheerCount}
                    error={cheerError}
                    tone="song"
                  />
                </div>
              );
            })()
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-5 text-center backdrop-blur-md">
              <p className="text-3xl" aria-hidden>
                🌲
              </p>
              <p className="mt-2 text-sm font-semibold text-amber-200">
                다음 사연을 준비하고 있어요
              </p>
              <p className="mt-1 text-[11px] text-white/55">
                잠시만 기다려 주세요
              </p>
            </div>
          )
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-5 text-center backdrop-blur-md">
            <p className="text-3xl" aria-hidden>
              🌲
            </p>
            <p className="mt-2 text-sm font-semibold text-white/85">
              아직 방송 시작 전이에요
            </p>
            <p className="mt-1 text-[11px] text-white/55">
              정규 방송 시간에 다시 찾아와 주세요
            </p>
          </div>
        )}
      </div>

      {/* ④.5 NOW PLAYING 과 채팅 사이 슬롯 — BroadcastQueueViewer 등 */}
      {middleSlot && (
        <div className="relative z-20 px-3 sm:px-4">{middleSlot}</div>
      )}

      {/* ⑤ 하단 액션 — 채팅 스트림(머무름) + 리액션 + 입력바 (항상 노출) */}
      <div className="relative z-20 mt-auto flex flex-col gap-2.5 p-3 pb-3.5 sm:p-4 sm:pb-4">
        {sessionId && (
          <LiveChatStream
            sessionId={sessionId}
            initialMessages={initialChatMessages}
            currentUserId={currentUserId}
          />
        )}
        {sessionId && (
          <ReactionBar
            sessionId={sessionId}
            isLive={sessionLive}
            variant="embedded"
          />
        )}
        {sessionId && (
          <LiveChatComposer sessionId={sessionId} isLive={sessionLive} />
        )}
      </div>

      {/* 단체 가위바위보 서바이벌 — 활성 RPS 방이 있으면 자동 모달로 등장 */}
      {sessionId && (
        <PlayerRpsModal
          fmSessionId={sessionId}
          isLive={sessionLive}
          currentUserId={currentUserId}
        />
      )}
    </section>
  );
}

/** NOW PLAYING 응원 하트 버튼 — 큰 amber 카드 안에 임베드. */
function CheerButton({
  onClick,
  pending,
  count,
  error,
  tone,
}: {
  onClick: () => void;
  pending: boolean;
  count: number;
  error: string | null;
  tone: "story" | "song";
}) {
  const bgCls =
    tone === "story"
      ? "from-rose-500 to-amber-500 shadow-rose-500/40"
      : "from-rose-500 to-orange-500 shadow-rose-500/30";
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`flex w-full items-center justify-between rounded-2xl bg-gradient-to-r px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60 ${bgCls}`}
      >
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={pending ? "animate-pulse" : ""}>
            ❤
          </span>
          응원하기
          <span className="inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">
            <AcornIcon size={9} />
            -1
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-normal opacity-90">
          <span aria-hidden>❤</span>
          {count} 받음
        </span>
      </button>
      {error && (
        <p
          role="alert"
          className="mt-1 rounded-lg bg-rose-500/20 px-2 py-1 text-center text-[11px] font-semibold text-rose-100"
        >
          {error}
        </p>
      )}
    </div>
  );
}
