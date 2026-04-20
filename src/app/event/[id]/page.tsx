import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { checkAndEndEvent } from "@/lib/event-lifecycle";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { TreeGrowthCard } from "@/components/tree-growth-card";
import { ChallengeCard } from "@/components/challenge-card";
import { CouponCard } from "@/components/coupon-card";

export const dynamic = "force-dynamic";

export default async function EventHomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getParticipant(id);
  if (!p) redirect("/join");

  const supabase = await createClient();
  await checkAndEndEvent(supabase, id);

  const [eventRes, missionRes, participantRes] = await Promise.all([
    supabase.from("events").select("id, name, status, location, start_at, end_at, show_leaderboard, participation_type").eq("id", id).single(),
    supabase.from("missions").select("id, title, template_type, points, order").eq("event_id", id).eq("is_active", true).order("order", { ascending: true }),
    supabase.from("participants").select("id, total_score").eq("event_id", id).eq("phone", p.phone).maybeSingle(),
  ]);

  const event = eventRes.data;
  if (!event) notFound();
  const missions = missionRes.data ?? [];
  const participant = participantRes.data;

  // 제출 상태 확인
  let completedIds = new Set<string>();
  if (participant) {
    const { data: subs } = await supabase.from("submissions").select("mission_id, status")
      .eq("participant_id", participant.id).in("status", ["APPROVED", "AUTO_APPROVED", "PENDING"]);
    completedIds = new Set((subs ?? []).map((s) => s.mission_id));
  }

  const nextMission = missions.find((m) => !completedIds.has(m.id));
  const completedCount = missions.filter((m) => completedIds.has(m.id)).length;

  // 참가자 수 + 순위
  const { data: allParticipants } = await supabase.from("participants").select("id, total_score")
    .eq("event_id", id).order("total_score", { ascending: false });
  const totalParticipants = allParticipants?.length ?? 0;
  const myRank = participant ? (allParticipants ?? []).findIndex((pp) => pp.id === participant.id) + 1 : 0;

  const isEnded = event.status === "ENDED" || event.status === "CONFIRMED";

  return (
    <main className="min-h-dvh bg-neutral-50 p-4 pb-24">
      <RealtimeRefresh table="submissions" />
      <RealtimeRefresh table="participants" />
      <RealtimeRefresh table="reward_claims" />
      <div className="mx-auto max-w-lg space-y-4">

        {/* 헤더 — 토리로 포레스트 그라데이션 */}
        <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-lg">
          <h1 className="text-xl font-bold">🌲 {event.name}</h1>
          <p className="mt-1 text-sm opacity-90">🏞️ {event.location}</p>
          <div className="mt-3 flex gap-3">
            <div className="flex-1 rounded-xl bg-white/20 p-3 text-center">
              <div className="text-2xl font-bold">{participant?.total_score ?? 0}<span className="ml-0.5 text-xs">🌰</span></div>
              <div className="text-xs opacity-80">내 도토리</div>
            </div>
            <div className="flex-1 rounded-xl bg-white/20 p-3 text-center">
              <div className="text-2xl font-bold">{myRank || "-"}<span className="text-xs">/{totalParticipants}</span></div>
              <div className="text-xs opacity-80">내 순위</div>
            </div>
            <div className="flex-1 rounded-xl bg-white/20 p-3 text-center">
              <div className="text-2xl font-bold">{completedCount}<span className="text-xs">/{missions.length}</span></div>
              <div className="text-xs opacity-80">숲길</div>
            </div>
          </div>
        </div>

        {/* 종료 시 결과 */}
        {isEnded && (
          <Link href={`/event/${id}/result`}
            className="block rounded-2xl bg-gradient-to-r from-[#C4956A] to-[#8B6F47] p-5 text-center text-white hover:shadow-lg">
            <div className="text-sm opacity-90">🏞️ 숲에서의 하루가 마무리됐어요</div>
            <div className="mt-1 text-lg font-bold">오늘의 걸음 돌아보기 →</div>
          </Link>
        )}

        {/* 나무 성장 카드 */}
        <TreeGrowthCard acorns={participant?.total_score ?? 0} />

        {/* 이번주 챌린지 */}
        <ChallengeCard completedMissions={completedCount} />

        {/* AI 숲길 추천 (준비 중) */}
        <div
          aria-disabled="true"
          className="rounded-2xl border border-dashed border-[#A8C686]/60 bg-white/70 p-5 opacity-80"
        >
          <div className="flex items-center gap-3">
            <div className="text-3xl">🤖</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[#2D5A3D]">토리가 추천하는 숲길</h3>
                <span className="rounded-full bg-[#D4E4BC] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                  준비 중
                </span>
              </div>
              <p className="mt-1 text-xs text-[#6B6560]">당신에게 딱 맞는 숲길을 찾는 중...</p>
            </div>
          </div>
        </div>

        {/* 다음 미션 (가장 큰 카드) */}
        {nextMission && !isEnded && (
          <Link href={`/event/${id}/missions/${nextMission.id}`}
            className="block rounded-2xl border-2 border-[#A8C686] bg-white p-6 hover:shadow-lg">
            <div className="text-xs font-semibold text-violet-600">🌿 다음 숲길</div>
            <h2 className="mt-2 text-xl font-bold">{nextMission.title}</h2>
            <div className="mt-1 text-sm text-[#6B6560]">🌰 {nextMission.points}개</div>
            <div className="mt-4 rounded-xl bg-violet-600 py-3 text-center font-bold text-white hover:bg-violet-700">지금 걸어볼까요 🐾</div>
          </Link>
        )}

        {!nextMission && !isEnded && (
          <div className="rounded-2xl border bg-white p-6 text-center">
            <div className="text-3xl">🏞️</div>
            <div className="mt-2 font-bold">모든 숲길을 걸었어요!</div>
            <p className="mt-1 text-sm text-[#6B6560]">결과 발표를 기다려주세요</p>
          </div>
        )}

        {/* 명예의 전당 바로가기 */}
        {event.show_leaderboard !== false && (
          <Link
            href={`/event/${id}/leaderboard`}
            className="block rounded-2xl border bg-white p-4 hover:shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl">🏆</div>
              <div className="flex-1">
                <h3 className="font-bold text-[#2D5A3D]">숲지기 명예의 전당</h3>
                <p className="mt-0.5 text-xs text-[#6B6560]">
                  내 순위 {myRank || "-"}등 · 전체 {totalParticipants}명
                </p>
              </div>
              <div className="text-[#6B6560]">→</div>
            </div>
          </Link>
        )}

        {/* 오늘의 선물 (쿠폰) */}
        <CouponCard eventId={id} />

        {/* 완료 미션 */}
        {completedCount > 0 && (
          <div className="rounded-2xl border bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold">🐾 걸어온 숲길</h3>
            <div className="flex flex-wrap gap-2">
              {missions.filter((m) => completedIds.has(m.id)).map((m) => (
                <span key={m.id} className="rounded-full bg-[#D4E4BC] px-3 py-1 text-xs text-[#2D5A3D]">🌿 {m.title}</span>
              ))}
            </div>
          </div>
        )}

        {/* 하단 탭바에서 접근 가능하므로 중복 메뉴 제거 */}
      </div>
    </main>
  );
}
