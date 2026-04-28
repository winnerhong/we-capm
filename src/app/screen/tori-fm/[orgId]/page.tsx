// 전광판 (보이는 라디오) — 토리FM 공용 디스플레이.
//
// 구조:
//   1) SSR 단계에서 orgName, 브랜드명, 초기 liveSession + nowPlaying 1회 로드
//      → 첫 페인트가 즉시 나오도록.
//   2) 이후 모든 갱신은 ScreenLive (client) 가 담당:
//      - tori_fm_sessions / mission_radio_queue Realtime 구독
//      - 5 초 폴링 fallback
//      - current_queue_id 변경 시 supabase 클라이언트로 직접 fetch → state update
//   3) ScreenEffectsLayer 도 ScreenLive 내부에서 sessionId 바인딩 → 채팅·하트·
//      이모지·배너·투표·스포트라이트 모두 sub-second 반영.
//
// LiveFmRefresher 도 보조 안전망으로 남김 (router.refresh 백업) — 폴링 간격 단축.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  loadLiveFmSessionForOrg,
  loadRadioQueueItemWithSubmission,
} from "@/lib/missions/queries";
import { loadOrgFmBrandName } from "@/lib/tori-fm/branding";
import { LiveFmRefresher } from "@/app/(user)/tori-fm/LiveFmRefresher";
import { ForestBackdrop } from "./ForestBackdrop";
import { ScreenLive, type ScreenNowPlaying } from "./ScreenLive";

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
  searchParams?: Promise<{ demo?: string; tv?: string }>;
}) {
  const { orgId } = await params;
  const sp = (await searchParams) ?? {};
  const showDemo = sp.demo === "1";
  const tvMode = sp.tv === "1";

  const [orgName, brandName, liveSession] = await Promise.all([
    loadOrgName(orgId),
    loadOrgFmBrandName(orgId),
    loadLiveFmSessionForOrg(orgId),
  ]);

  if (!orgName) notFound();

  const nowPlayingItem = liveSession?.current_queue_id
    ? await loadRadioQueueItemWithSubmission(liveSession.current_queue_id)
    : null;

  const initialNowPlaying: ScreenNowPlaying | null = nowPlayingItem
    ? {
        song:
          typeof nowPlayingItem.submission.payload_json.song_title === "string"
            ? (nowPlayingItem.submission.payload_json.song_title as string)
            : "",
        artist:
          typeof nowPlayingItem.submission.payload_json.artist === "string"
            ? (nowPlayingItem.submission.payload_json.artist as string)
            : "",
        story:
          typeof nowPlayingItem.submission.payload_json.story_text === "string"
            ? (nowPlayingItem.submission.payload_json.story_text as string)
            : "",
        childName:
          typeof nowPlayingItem.submission.payload_json.child_name === "string"
            ? (nowPlayingItem.submission.payload_json.child_name as string)
            : "",
      }
    : null;

  return (
    <div
      className="relative min-h-dvh overflow-hidden bg-black text-[#C4956A]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top, #1a1410 0%, #000 70%)",
        // 4K TV 모드: 전체 viewport 기준 폰트 스케일 (clamp 18~36px).
        ...(tvMode ? { fontSize: "clamp(18px, 1.0vw, 36px)" } : {}),
      }}
    >
      {/* 보조 안전망: tori_fm_sessions / mission_radio_queue 변화 시 router.refresh.
          ScreenLive 가 자체 fetch 로 갱신하므로 평소엔 무동작. */}
      <LiveFmRefresher orgId={orgId} pollMs={15_000} />

      {/* 스튜디오 배경 */}
      <ForestBackdrop />

      {/* 클라이언트 주도 라이브 콘텐츠 — VFX + HUD + 메인 패널 */}
      <ScreenLive
        orgId={orgId}
        brandName={brandName}
        initialSession={liveSession}
        initialNowPlaying={initialNowPlaying}
        showDemoControls={showDemo}
      />

      {/* 푸터 */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between p-6 md:p-8">
        <p className="text-[11px] tracking-widest text-[#4A3F38] md:text-xs">
          {brandName} · 자연과 가까운 작은 라디오
        </p>
        <p className="font-mono text-[11px] text-[#4A3F38] md:text-xs">
          🌲 FOREST STUDIO
        </p>
      </footer>
    </div>
  );
}
