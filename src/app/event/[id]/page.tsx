import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface EventHome {
  event: {
    id: string; name: string; status: string; location: string;
    start_at: string; end_at: string; participation_type: string; show_leaderboard: boolean;
  } | null;
  participant: { id: string; total_score: number; team_id: string | null } | null;
  missionCount: number;
}

export default async function EventHomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/event/${id}`);

  const { data } = await supabase.rpc("get_event_home", { p_event_id: id });
  const d = (data as unknown as EventHome) ?? {} as EventHome;
  const { event, participant, missionCount } = d;
  if (!event) notFound();

  return (
    <main className="min-h-dvh bg-neutral-50 p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <Link href="/" className="text-sm hover:underline">
          ← 내 행사
        </Link>

        <header className="rounded-lg bg-violet-600 p-6 text-white">
          <p className="text-xs opacity-80">{event.status}</p>
          <h1 className="text-xl font-bold">{event.name}</h1>
          <p className="mt-1 text-sm opacity-90">📍 {event.location}</p>
          <p className="text-sm opacity-90">🗓 {new Date(event.start_at).toLocaleString("ko-KR")}</p>
          {participant && (
            <div className="mt-4 rounded-lg bg-white/20 p-3">
              <div className="text-xs opacity-80">내 점수</div>
              <div className="text-2xl font-bold">{participant.total_score}점</div>
            </div>
          )}
        </header>

        {(event.status === "ENDED" || event.status === "CONFIRMED") && (
          <Link
            href={`/event/${id}/result`}
            className="block rounded-lg bg-gradient-to-r from-violet-600 to-purple-700 p-5 text-center text-white"
          >
            <div className="text-sm opacity-80">🏆 행사가 종료되었어요</div>
            <div className="mt-1 font-bold">최종 결과 보기 →</div>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/event/${id}/missions`}
            className="rounded-lg border bg-white p-4 text-center hover:border-violet-500"
          >
            <div className="text-3xl">🎯</div>
            <div className="mt-1 font-semibold">미션</div>
            <div className="text-xs">{missionCount ?? 0}개 진행 가능</div>
          </Link>

          {event.show_leaderboard && (
            <Link
              href={`/event/${id}/leaderboard`}
              className="rounded-lg border bg-white p-4 text-center hover:border-violet-500"
            >
              <div className="text-3xl">🏆</div>
              <div className="mt-1 font-semibold">순위</div>
              <div className="text-xs">리더보드</div>
            </Link>
          )}

          {event.participation_type !== "INDIVIDUAL" && (
            <Link
              href={`/event/${id}/team`}
              className="rounded-lg border bg-white p-4 text-center hover:border-violet-500"
            >
              <div className="text-3xl">🤝</div>
              <div className="mt-1 font-semibold">팀</div>
              <div className="text-xs">
                {participant?.team_id ? "우리팀 보기" : "팀 만들기/합류"}
              </div>
            </Link>
          )}

          <Link
            href={`/event/${id}/rewards`}
            className="rounded-lg border bg-white p-4 text-center hover:border-violet-500"
          >
            <div className="text-3xl">🎁</div>
            <div className="mt-1 font-semibold">보상함</div>
            <div className="text-xs">획득한 보상</div>
          </Link>
        </div>
      </div>
    </main>
  );
}
