// 서버 컴포넌트 — 홈 화면의 토리FM 카드.
//
// 핵심 동선: "방송 듣기" 버튼이 카드 중앙 메인 위치. 한 번 탭으로 라이브 합류.
//
// 3가지 상태:
//   🔴 LIVE  — 다크 네이비 + rose 글로우, 거대 amber 듣기 버튼 (메인)
//   ⚫ OFF   — 차분한 회색 톤, 비활성 버튼 자리 유지, "방송이 없어요" 명확 표기
//   (옵션)   — OFF 안에서 다음 방송 예정이 있으면 한 줄 안내

import Link from "next/link";
import {
  loadLiveFmSessionForOrg,
  loadFmSessionsByOrg,
  loadRadioQueueItemWithSubmission,
} from "@/lib/missions/queries";
import { loadLiveFmSessionForEvent } from "@/lib/org-events/queries";
import { loadOrgFmBrandName } from "@/lib/tori-fm/branding";
import { loadPlayingRequest } from "@/lib/tori-fm/queries";
import type {
  RadioSubmissionPayload,
  ToriFmSessionRow,
} from "@/lib/missions/types";
import { fmtDateTimeKst } from "@/lib/datetime/kst";

interface Props {
  orgId: string;
  /**
   * Phase 4 — 전달 시 해당 행사의 LIVE FM 세션만 표시.
   * 미전달 시 기존 기관 전체 fallback.
   */
  eventId?: string | null;
}

function fmtSchedule(iso: string | null): string {
  if (!iso) return "";
  try {
    return fmtDateTimeKst(iso);
  } catch {
    return "";
  }
}

function findUpcoming(
  sessions: ToriFmSessionRow[]
): ToriFmSessionRow | null {
  const now = Date.now();
  const upcoming = sessions
    .filter((s) => !s.is_live && new Date(s.scheduled_start).getTime() > now)
    .sort(
      (a, b) =>
        new Date(a.scheduled_start).getTime() -
        new Date(b.scheduled_start).getTime()
    );
  return upcoming[0] ?? null;
}

export async function ToriFmCard({ orgId, eventId }: Props) {
  // 1) 행사 컨텍스트가 있으면 그 행사 LIVE 세션 우선.
  // 2) 행사 매칭 실패 → 기관 전체 LIVE 세션으로 폴백 (운영자가 quickStart
  //    로 켰을 때 session.event_id=null 인 케이스 포함).
  const [eventSession, brandName] = await Promise.all([
    eventId ? loadLiveFmSessionForEvent(eventId) : Promise.resolve(null),
    loadOrgFmBrandName(orgId),
  ]);
  const session = eventSession ?? (await loadLiveFmSessionForOrg(orgId));

  /* -------------------------------------------------------------- */
  /* OFF — 라이브 아님                                                */
  /* -------------------------------------------------------------- */
  if (!session || !session.is_live) {
    const allSessions = await loadFmSessionsByOrg(orgId);
    const upcoming = findUpcoming(allSessions);

    return (
      <Link
        href="/tori-fm"
        aria-label={`${brandName} — 방송 대기 (신청곡 보내기로 이동)`}
        className="group block overflow-hidden rounded-3xl border border-zinc-700/40 bg-gradient-to-br from-[#1A1A1F] via-[#22221F] to-[#1A1A1F] p-5 shadow-sm transition hover:shadow-md active:scale-[0.995]"
      >
        {/* 헤더 — OFF dot + 브랜드 */}
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full bg-zinc-500"
            aria-hidden
          />
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            OFF AIR
          </p>
          <span className="ml-auto max-w-[60%] truncate rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 backdrop-blur-sm">
            📻 {brandName}
          </span>
        </div>

        {/* 메인 헤드라인 */}
        <div className="mt-4 text-center">
          <p className="text-3xl" aria-hidden>
            🌙
          </p>
          <h2 className="mt-1.5 text-lg font-bold text-zinc-200">
            지금은 방송이 없어요
          </h2>
          <p className="mt-1 text-[12px] text-zinc-400">
            방송이 시작되면 여기에서 바로 들을 수 있어요
          </p>
        </div>

        {/* 비활성 버튼 자리 — LIVE 전환 시 같은 위치에 활성화 */}
        <div
          aria-disabled
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700/60 bg-zinc-800/40 px-5 py-3.5 text-sm font-bold text-zinc-500"
        >
          <span aria-hidden>⏸</span>
          방송 시작 전이에요
        </div>

        {/* 다음 방송 (있으면) */}
        {upcoming && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
            <span className="text-[11px]" aria-hidden>⏰</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-zinc-300">
                {upcoming.name}
              </p>
              <p className="text-[10px] text-zinc-500">
                {fmtSchedule(upcoming.scheduled_start)}
              </p>
            </div>
          </div>
        )}

      </Link>
    );
  }

  /* -------------------------------------------------------------- */
  /* LIVE — 방송 중                                                  */
  /* -------------------------------------------------------------- */
  let currentSong: string | null = null;
  let currentArtist: string | null = null;
  let currentStory: string | null = null;
  let currentIsStoryMode = false;
  // PLAYING request 우선 — 신규 큐 시스템.
  const playingReq = await loadPlayingRequest(session.id);
  if (playingReq) {
    currentSong = playingReq.song_title?.trim() || null;
    currentArtist = playingReq.artist;
    currentStory = playingReq.story;
    currentIsStoryMode =
      playingReq.kind === "story_only" ||
      (!playingReq.song_title?.trim() && !!playingReq.story?.trim());
  } else if (session.current_queue_id) {
    const item = await loadRadioQueueItemWithSubmission(
      session.current_queue_id
    );
    if (item) {
      const p = item.submission.payload_json as Partial<RadioSubmissionPayload>;
      currentSong = typeof p.song_title === "string" ? p.song_title : null;
      currentArtist = typeof p.artist === "string" ? p.artist : null;
      currentStory = typeof p.story_text === "string" ? p.story_text : null;
    }
  }

  return (
    <Link
      href="/tori-fm"
      aria-label={`${brandName} 방송 듣기 — 라이브 참여`}
      className="group relative block overflow-hidden rounded-3xl border border-rose-500/40 bg-gradient-to-br from-[#0B1538] via-[#102046] to-[#0B1538] p-5 shadow-2xl shadow-rose-500/10 transition hover:shadow-rose-500/20 active:scale-[0.995]"
    >
      {/* rose 글로우 — 카드 외곽에서 미세하게 빛남 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 -z-10 rounded-[inherit] bg-rose-500/10 blur-2xl"
      />

      {/* 헤더 — LIVE 펄스 + 브랜드 */}
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/95 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-md shadow-rose-500/40"
          aria-label="LIVE 방송 중"
        >
          <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          LIVE
        </span>
        <span className="ml-auto max-w-[60%] truncate rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200 backdrop-blur-sm">
          📻 {brandName}
        </span>
      </div>

      {/* 메인 헤드라인 — 시각 폭발 */}
      <div className="mt-4 text-center">
        <p className="text-2xl font-extrabold tracking-tight text-amber-100 md:text-[22px]">
          ✨ 지금 라이브 방송 중! ✨
        </p>
        <p className="mt-1 line-clamp-1 text-[13px] font-semibold text-amber-200/80">
          {session.name}
        </p>
      </div>

      {/* 메인 CTA — amber 버튼 (카드 중앙, 폭 50%) */}
      <div className="mt-4 flex justify-center">
        <div className="inline-flex min-w-[220px] items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl bg-gradient-to-r from-amber-400 to-amber-300 px-5 py-2.5 text-sm font-extrabold text-[#0B1538] shadow-lg shadow-amber-400/40 transition group-hover:from-amber-300 group-hover:to-amber-200 group-hover:shadow-amber-400/60 group-active:scale-[0.98]">
          <span className="text-base" aria-hidden>
            ▶
          </span>
          <span>라이브 방송 바로가기</span>
        </div>
      </div>

      {/* 부가 — 지금 흘러나오는 사연/곡 (있으면).
          story_only 모드면 "사연 읽는 중" 라벨 + 사연 본문 1~2줄 미리보기. */}
      {currentIsStoryMode && currentStory ? (
        <div className="mt-3 rounded-xl border border-violet-300/20 bg-gradient-to-br from-violet-900/30 to-amber-900/20 px-3 py-2 backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/80">
            💌 사연 읽는 중
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-amber-100/90">
            “{currentStory}”
          </p>
        </div>
      ) : currentSong ? (
        <div className="mt-3 rounded-xl bg-white/[0.06] px-3 py-2 backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/70">
            ♪ 지금 재생 중
          </p>
          <p className="mt-0.5 line-clamp-1 text-[12px] font-bold text-white">
            {currentSong}
            {currentArtist && (
              <span className="ml-1 text-[11px] font-normal text-white/70">
                — {currentArtist}
              </span>
            )}
          </p>
          {currentStory && (
            <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-white/60">
              “{currentStory}”
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-white/[0.06] px-3 py-2 text-center text-[11px] text-white/60 backdrop-blur-sm">
          🎙 잠시 후 다음 사연이 흘러나와요
        </p>
      )}
    </Link>
  );
}
