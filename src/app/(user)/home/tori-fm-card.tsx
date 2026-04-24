// 서버 컴포넌트 — 홈 화면의 토리FM 카드.
// LIVE 상태 / 방송 예정 / 대기 상태 3가지 모두 표시.

import Link from "next/link";
import {
  loadLiveFmSessionForOrg,
  loadFmSessionsByOrg,
  loadRadioQueueItemWithSubmission,
} from "@/lib/missions/queries";
import { loadLiveFmSessionForEvent } from "@/lib/org-events/queries";
import type {
  RadioSubmissionPayload,
  ToriFmSessionRow,
} from "@/lib/missions/types";

interface Props {
  orgId: string;
  /**
   * Phase 4 — 전달 시 해당 행사의 LIVE FM 세션만 표시.
   * 미전달 시 기존 기관 전체 fallback.
   */
  eventId?: string | null;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
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
  const session = eventId
    ? await loadLiveFmSessionForEvent(eventId)
    : await loadLiveFmSessionForOrg(orgId);

  // LIVE가 아니면 → 예정된 세션 찾아서 대기 카드 표시
  if (!session || !session.is_live) {
    const allSessions = await loadFmSessionsByOrg(orgId);
    const upcoming = findUpcoming(allSessions);

    return (
      <Link
        href="/tori-fm"
        aria-label="토리FM 방송 정보"
        className="block overflow-hidden rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#2A1F15] via-[#3A2B1E] to-[#2A1F15] p-5 shadow-sm transition hover:shadow-md active:scale-[0.995]"
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-zinc-500" aria-hidden />
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200/60">
            OFF AIR
          </p>
          <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-amber-200/70 backdrop-blur-sm">
            📻 토리FM
          </span>
        </div>

        <h2 className="mt-2 text-base font-bold text-white/90">
          📻 다음 방송을 기다리고 있어요
        </h2>

        {upcoming ? (
          <div className="mt-3 rounded-2xl bg-white/5 p-3 backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/60">
              ⏰ 예정된 방송
            </p>
            <p className="mt-0.5 line-clamp-1 text-sm font-bold text-white">
              {upcoming.name}
            </p>
            <p className="mt-1 text-[11px] text-amber-200/70">
              {fmtTime(upcoming.scheduled_start)} ~{" "}
              {fmtTime(upcoming.scheduled_end).split(" ").slice(-1)[0]}
            </p>
          </div>
        ) : (
          <p className="mt-3 rounded-2xl bg-white/5 px-3 py-2 text-[12px] text-white/60 backdrop-blur-sm">
            아직 예정된 방송이 없어요. 기관에서 방송을 시작하면 바로 알려드릴게요.
          </p>
        )}

        <p className="mt-3 text-right text-xs font-bold text-amber-200/80">
          🎵 신청곡 보내기 →
        </p>
      </Link>
    );
  }

  // 현재 재생 중인 큐 아이템 프리뷰
  let currentSong: string | null = null;
  let currentArtist: string | null = null;
  let currentStory: string | null = null;
  if (session.current_queue_id) {
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
      aria-label="토리FM 방송 듣기"
      className="block overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-[#1B2B3A] via-[#26394C] to-[#1B2B3A] p-5 shadow-lg transition hover:shadow-xl active:scale-[0.995]"
    >
      {/* ON AIR indicator */}
      <div className="flex items-center gap-2">
        <span className="relative inline-flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
        </span>
        <p className="text-[11px] font-bold uppercase tracking-widest text-rose-300">
          ON AIR
        </p>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200 backdrop-blur-sm">
          📻 토리FM
        </span>
      </div>

      {/* Title */}
      <h2 className="mt-2 text-lg font-bold text-white">
        📻 토리FM 방송 중
      </h2>
      <p className="mt-0.5 text-xs text-amber-200/80">{session.name}</p>

      {/* Current song preview */}
      {currentSong ? (
        <div className="mt-3 rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/80">
            ♪ 지금 재생 중
          </p>
          <p className="mt-0.5 line-clamp-1 text-sm font-bold text-white">
            {currentSong}
            {currentArtist && (
              <span className="ml-1 text-xs font-normal text-white/70">
                — {currentArtist}
              </span>
            )}
          </p>
          {currentStory && (
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/70">
              “{currentStory}”
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-2xl bg-white/10 px-3 py-2 text-[12px] text-white/70 backdrop-blur-sm">
          잠시 후 신청곡이 흘러나와요
        </p>
      )}

      {/* CTA */}
      <p className="mt-3 text-right text-xs font-bold text-amber-300">
        📻 방송 듣기 →
      </p>
    </Link>
  );
}
