import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  loadLiveFmSessionForOrg,
  loadRadioQueueItemWithSubmission,
} from "@/lib/missions/queries";
import { LiveFmRefresher } from "@/app/(user)/tori-fm/LiveFmRefresher";
import { ScreenTimer } from "./ScreenTimer";
import { ForestBackdrop } from "./ForestBackdrop";
import { ListenerPresence } from "@/components/tori-fm/ListenerPresence";
import { ScreenEffectsLayer } from "./vfx/ScreenEffectsLayer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadOrgName(orgId: string): Promise<string | null> {
  if (!orgId) return null;
  const supabase = await createClient();
  const resp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { id: string; org_name: string } | null;
          }>;
        };
      };
    }
  )
    .select("id, org_name")
    .eq("id", orgId)
    .maybeSingle()) as { data: { id: string; org_name: string } | null };
  return resp.data?.org_name ?? null;
}

export default async function ToriFmScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams?: Promise<{ demo?: string }>;
}) {
  const { orgId } = await params;
  const sp = (await searchParams) ?? {};
  const showDemo = sp.demo === "1";

  const orgName = await loadOrgName(orgId);
  if (!orgName) notFound();

  const liveSession = await loadLiveFmSessionForOrg(orgId);
  const nowPlaying = liveSession?.current_queue_id
    ? await loadRadioQueueItemWithSubmission(liveSession.current_queue_id)
    : null;

  const song =
    typeof nowPlaying?.submission.payload_json.song_title === "string"
      ? (nowPlaying.submission.payload_json.song_title as string)
      : "";
  const artist =
    typeof nowPlaying?.submission.payload_json.artist === "string"
      ? (nowPlaying.submission.payload_json.artist as string)
      : "";
  const story =
    typeof nowPlaying?.submission.payload_json.story_text === "string"
      ? (nowPlaying.submission.payload_json.story_text as string)
      : "";
  const childName =
    typeof nowPlaying?.submission.payload_json.child_name === "string"
      ? (nowPlaying.submission.payload_json.child_name as string)
      : "";

  const isOnAir = Boolean(liveSession && nowPlaying);
  const sessionLive = Boolean(liveSession?.is_live);

  return (
    <div
      className="relative min-h-dvh overflow-hidden bg-black text-[#C4956A]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top, #1a1410 0%, #000 70%)",
      }}
    >
      {/* Realtime 구독 — 라이브 전환/곡 교체 즉시 반영 */}
      <LiveFmRefresher orgId={orgId} pollMs={30_000} />

      {/* 스튜디오 배경 */}
      <ForestBackdrop />

      {/* VFX 오버레이 — 떠오르는 하트·채팅 버블 */}
      <ScreenEffectsLayer
        sessionId={liveSession?.id ?? null}
        showDemoControls={showDemo}
      />

      {/* 상단 HUD: 시각 + 청취 인원 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-6 md:p-8">
        <ScreenTimer startedAt={liveSession?.started_at ?? null} />
        <div className="pointer-events-auto">
          <ListenerPresence orgId={orgId} variant="dark" />
        </div>
      </div>

      <main className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col items-center justify-center px-6 py-24 text-center md:py-32">
        {/* 로고 영역 */}
        <div className="mb-10 md:mb-14">
          <p className="text-6xl md:text-7xl" aria-hidden>
            🎙
          </p>
          <h1 className="mt-4 text-5xl font-extrabold tracking-wide text-[#C4956A] md:text-7xl lg:text-8xl">
            토리<span className="text-[#E5B88A]">FM</span>
          </h1>
          <p className="mt-3 text-base font-semibold text-[#8A8A8A] md:text-xl">
            {orgName}
          </p>
        </div>

        {/* ON AIR 메가 배지 */}
        {sessionLive && (
          <div className="mb-8 inline-flex items-center gap-3 rounded-full border-2 border-rose-500 bg-rose-500/10 px-6 py-2.5 backdrop-blur md:px-8 md:py-3">
            <span className="relative inline-flex h-3 w-3 md:h-4 md:w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-full w-full rounded-full bg-rose-500" />
            </span>
            <span className="text-sm font-bold tracking-[0.3em] text-rose-400 md:text-base">
              ON AIR
            </span>
          </div>
        )}

        {/* 방송 본문 */}
        {isOnAir ? (
          <section className="w-full max-w-4xl rounded-3xl border border-[#3a2f27] bg-[#0f0a07]/85 p-8 shadow-2xl backdrop-blur md:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#8A8A8A] md:text-sm">
              ♪ Now Playing
            </p>
            <h2 className="mt-4 break-words text-4xl font-extrabold text-[#E5B88A] md:text-6xl lg:text-7xl">
              {song || "(제목 미입력)"}
            </h2>
            {artist && (
              <p className="mt-2 text-xl font-semibold text-[#C4956A] md:text-3xl">
                — {artist}
              </p>
            )}

            {story && (
              <blockquote className="mt-8 rounded-2xl border border-[#3a2f27] bg-black/50 p-6 text-left md:p-8">
                <p className="whitespace-pre-wrap text-base leading-relaxed text-[#C4956A] md:text-xl lg:text-2xl lg:leading-[1.6]">
                  “{story}”
                </p>
              </blockquote>
            )}

            {childName && (
              <p className="mt-6 text-base font-semibold text-[#8A8A8A] md:text-xl">
                사연을 보내준 친구 — {childName}
              </p>
            )}
          </section>
        ) : sessionLive ? (
          <section className="w-full max-w-2xl rounded-3xl border border-[#3a2f27] bg-[#0f0a07]/85 p-10 text-[#8A8A8A] shadow-xl backdrop-blur md:p-14">
            <p className="text-6xl md:text-7xl" aria-hidden>
              🌲
            </p>
            <p className="mt-5 text-2xl font-semibold text-[#C4956A] md:text-3xl">
              다음 사연을 준비하고 있어요
            </p>
            <p className="mt-3 text-base md:text-lg">잠시만 기다려 주세요</p>
          </section>
        ) : (
          <section className="w-full max-w-2xl rounded-3xl border border-[#3a2f27] bg-[#0f0a07]/85 p-10 text-[#8A8A8A] shadow-xl backdrop-blur md:p-14">
            <p className="text-6xl md:text-7xl" aria-hidden>
              🌲
            </p>
            <p className="mt-5 text-2xl font-semibold text-[#C4956A] md:text-3xl">
              점심시간을 기다리고 있어요
            </p>
            <p className="mt-3 text-base md:text-lg">
              곧 토리FM이 방송을 시작해요
            </p>
          </section>
        )}
      </main>

      {/* 푸터 */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between p-6 md:p-8">
        <p className="text-[11px] tracking-widest text-[#4A3F38] md:text-xs">
          toriFM · 자연과 가까운 작은 라디오
        </p>
        <p className="font-mono text-[11px] text-[#4A3F38] md:text-xs">
          🌲 FOREST STUDIO
        </p>
      </footer>
    </div>
  );
}
