import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { checkAndEndEvent } from "@/lib/event-lifecycle";
import { RealtimeRefresh } from "@/components/realtime-refresh";

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
