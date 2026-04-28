// 토리FM 오늘의 랭킹 요약 — Server Component.
//  - 5개 view (곡/가수/사연/가족/수다왕)를 하나의 카드에 2열 그리드로 배치.
//  - 다크 스튜디오 테마 + amber 악센트 (ChatPanel 톤에 맞춤).
//  - sessionId 가 비어 있으면 placeholder 한 줄만 렌더링.

import {
  loadTopArtists,
  loadTopChatters,
  loadTopFamilies,
  loadTopSongs,
  loadTopStories,
} from "@/lib/tori-fm/queries";
import { loadChildNamesByUserIds } from "@/lib/app-user/queries";
import type {
  FmTopArtistRow,
  FmTopChatterRow,
  FmTopFamilyRow,
  FmTopSongRow,
  FmTopStoryRow,
} from "@/lib/tori-fm/types";

/** "{원생이름} 가족" / "{이름} 외 {N-1}명 가족" / fallback. */
function familyLabel(
  userId: string | null,
  fallback: string | null,
  childMap: Map<string, string[]>
): string {
  if (userId) {
    const names = childMap.get(userId);
    if (names && names.length > 0) {
      if (names.length === 1) return `${names[0]} 가족`;
      return `${names[0]} 외 ${names.length - 1}명 가족`;
    }
  }
  if (fallback?.trim()) return `${fallback.trim()} 가족`;
  return "익명 가족";
}

type Props = {
  sessionId: string | null;
};

const MEDALS = ["🥇", "🥈", "🥉"];

function rankBadge(idx: number): React.ReactNode {
  if (idx < MEDALS.length) {
    return (
      <span className="text-base leading-none" aria-label={`${idx + 1}위`}>
        {MEDALS[idx]}
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/60"
      aria-label={`${idx + 1}위`}
    >
      #{idx + 1}
    </span>
  );
}

function EmptyRow() {
  return (
    <p className="text-center text-[11px] text-white/40 py-4">
      아직 집계 중이에요
    </p>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-[12px] font-bold tracking-wide text-amber-200/90">
      {children}
    </h4>
  );
}

function SongSection({ rows }: { rows: FmTopSongRow[] }) {
  return (
    <div className="rounded-2xl bg-black/25 p-3">
      <SectionHeader>🎵 인기 신청곡 TOP 5</SectionHeader>
      {rows.length === 0 ? (
        <EmptyRow />
      ) : (
        <ol className="space-y-1.5">
          {rows.map((s, i) => (
            <li
              key={`${s.song_title}-${s.artist}-${i}`}
              className="flex items-center gap-2.5"
            >
              <span className="flex w-6 flex-none items-center justify-center">
                {rankBadge(i)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] leading-tight text-white">
                  <span className="font-bold">{s.song_title}</span>
                  {s.artist ? (
                    <span className="ml-1 text-[11px] font-normal text-white/60">
                      — {s.artist}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex-none text-right leading-tight">
                <p className="text-[10px] text-white/70">
                  {s.request_count}회 신청
                </p>
                <p className="text-[10px] text-pink-300">
                  ♥ {s.total_hearts ?? 0}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ArtistSection({ rows }: { rows: FmTopArtistRow[] }) {
  return (
    <div className="rounded-2xl bg-black/25 p-3">
      <SectionHeader>🎤 인기 가수 TOP 5</SectionHeader>
      {rows.length === 0 ? (
        <EmptyRow />
      ) : (
        <ol className="space-y-1.5">
          {rows.map((a, i) => (
            <li
              key={`${a.artist}-${i}`}
              className="flex items-center gap-2.5"
            >
              <span className="flex w-6 flex-none items-center justify-center">
                {rankBadge(i)}
              </span>
              <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-white">
                {a.artist || "가수 미상"}
              </p>
              <p className="flex-none text-[10px] text-white/70">
                {a.request_count}회 ·{" "}
                <span className="text-pink-300">♥{a.total_hearts ?? 0}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function StorySection({ rows }: { rows: FmTopStoryRow[] }) {
  return (
    <div className="rounded-2xl bg-black/25 p-3">
      <SectionHeader>💌 오늘의 사연 TOP 3</SectionHeader>
      {rows.length === 0 ? (
        <EmptyRow />
      ) : (
        <ol className="divide-y divide-white/5">
          {rows.map((s) => (
            <li key={s.request_id} className="py-2 first:pt-0 last:pb-0">
              <p className="text-[11px] font-semibold text-white/90">
                {s.song_title}
                {s.artist ? (
                  <span className="ml-1 text-[11px] font-normal text-white/55">
                    — {s.artist}
                  </span>
                ) : null}
              </p>
              {s.story ? (
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-[11px] leading-snug text-white/75">
                  “{s.story}”
                </p>
              ) : null}
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="truncate text-[10px] text-white/50">
                  — {s.child_name || s.parent_name || "익명 친구"}
                </p>
                <p className="flex-none text-[10px] text-pink-300">
                  ♥ {s.heart_count ?? 0}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function FamilySection({
  rows,
  childMap,
}: {
  rows: FmTopFamilyRow[];
  childMap: Map<string, string[]>;
}) {
  return (
    <div className="rounded-2xl bg-black/25 p-3">
      <SectionHeader>👨‍👩‍👧‍👦 오늘의 사연 가족 TOP 5</SectionHeader>
      {rows.length === 0 ? (
        <EmptyRow />
      ) : (
        <ol className="space-y-1.5">
          {rows.map((f, i) => (
            <li key={f.user_id} className="flex items-center gap-2.5">
              <span className="flex w-6 flex-none items-center justify-center">
                {rankBadge(i)}
              </span>
              <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-white">
                {familyLabel(f.user_id, f.parent_name, childMap)}
              </p>
              <p className="flex-none text-[10px] text-white/70">
                {f.request_count}회 ·{" "}
                <span className="text-pink-300">♥{f.total_hearts ?? 0}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ChatterSection({
  rows,
  childMap,
}: {
  rows: FmTopChatterRow[];
  childMap: Map<string, string[]>;
}) {
  return (
    <div className="rounded-2xl bg-black/25 p-3 md:col-span-2">
      <SectionHeader>💬 오늘의 수다왕 TOP 5</SectionHeader>
      {rows.length === 0 ? (
        <EmptyRow />
      ) : (
        <ul className="flex flex-wrap gap-2">
          {rows.map((c, i) => (
            <li
              key={`${c.user_id ?? "anon"}-${i}`}
              className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/90"
            >
              <span className="font-semibold">
                {familyLabel(c.user_id, c.sender_name, childMap)}
              </span>{" "}
              <span className="text-amber-200/80">
                {c.message_count}↑
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function TodayRankingSummary({ sessionId }: Props) {
  // 세션 없으면 placeholder.
  if (!sessionId) {
    return (
      <section className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-[#1B2B3A] via-[#243548] to-[#1B2B3A] p-5 text-center text-white shadow-lg">
        <h3 className="text-sm font-bold tracking-wide text-amber-200">
          🏆 오늘의 토리FM 랭킹
        </h3>
        <p className="mt-3 text-[12px] text-white/60">
          오늘 방송이 시작되면 여기서 랭킹을 볼 수 있어요
        </p>
      </section>
    );
  }

  // 5개 view 동시 로드.
  const [topSongs, topArtists, topStories, topFamilies, topChatters] =
    await Promise.all([
      loadTopSongs(sessionId, 5),
      loadTopArtists(sessionId, 5),
      loadTopStories(sessionId, 3),
      loadTopFamilies(sessionId, 5),
      loadTopChatters(sessionId, 5),
    ]);

  // 자녀 이름 매핑 — Family + Chatter 행의 user_id 기준 한 번에 조회
  const userIds = Array.from(
    new Set(
      [
        ...topFamilies.map((f) => f.user_id),
        ...topChatters
          .map((c) => c.user_id)
          .filter((u): u is string => typeof u === "string" && u.length > 0),
      ].filter((u): u is string => typeof u === "string" && u.length > 0)
    )
  );
  const childMap = await loadChildNamesByUserIds(userIds);

  return (
    <section className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-[#1B2B3A] via-[#243548] to-[#1B2B3A] p-5 text-white shadow-lg">
      <header>
        <h3 className="text-sm font-bold tracking-wide text-amber-200">
          🏆 오늘의 토리FM 랭킹
        </h3>
        <p className="mt-0.5 text-[11px] text-white/50">
          라이브 방송 중 집계 · 자정에 초기화
        </p>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <SongSection rows={topSongs} />
        <ArtistSection rows={topArtists} />
        <StorySection rows={topStories} />
        <FamilySection rows={topFamilies} childMap={childMap} />
        <ChatterSection rows={topChatters} childMap={childMap} />
      </div>
    </section>
  );
}
