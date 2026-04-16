import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createTeamAction, joinTeamAction, leaveTeamAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/event/${id}/team`);

  const [eventRes, participantRes] = await Promise.all([
    supabase.from("events").select("id, name, participation_type, max_team_size").eq("id", id).single(),
    supabase.from("participants").select("id, team_id").eq("event_id", id).eq("user_id", user.id).maybeSingle(),
  ]);

  const event = eventRes.data;
  const participant = participantRes.data;
  if (!event) notFound();

  if (event.participation_type === "INDIVIDUAL") {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p className="text-sm text-neutral-500">이 행사는 개인 전용입니다</p>
      </main>
    );
  }

  if (!participant) redirect(`/event/${id}`);

  if (participant.team_id) {
    const [teamRes, membersRes] = await Promise.all([
      supabase.from("teams").select("id, name, team_code, leader_id, total_score").eq("id", participant.team_id).single(),
      supabase.from("participants").select("id, user_id, total_score").eq("team_id", participant.team_id),
    ]);
    const team = teamRes.data;
    const members = membersRes.data;

    const userIds = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, name").in("id", userIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const isLeader = team?.leader_id === user.id;

    return (
      <main className="min-h-dvh bg-neutral-50 p-4">
        <div className="mx-auto max-w-lg space-y-4">
          <Link href={`/event/${id}`} className="text-sm text-neutral-500 hover:underline">
            ← {event.name}
          </Link>

          <div className="rounded-lg bg-violet-600 p-6 text-white">
            <p className="text-xs opacity-80">우리팀</p>
            <h1 className="text-xl font-bold">{team?.name}</h1>
            <div className="mt-3 flex items-baseline justify-between">
              <div>
                <div className="text-xs opacity-80">팀 코드</div>
                <div className="font-mono text-lg">{team?.team_code}</div>
              </div>
              <div className="text-right">
                <div className="text-xs opacity-80">팀 점수</div>
                <div className="text-2xl font-bold">{team?.total_score}점</div>
              </div>
            </div>
          </div>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold">
              팀원 {members?.length ?? 0}/{event.max_team_size}
            </h2>
            <ul className="divide-y">
              {(members ?? []).map((m) => {
                const p = profileMap.get(m.user_id);
                return (
                  <li key={m.id} className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2">
                      {p?.name ?? "?"}
                      {m.user_id === team?.leader_id && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                          팀장
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-neutral-500">{m.total_score}점</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {!isLeader && (
            <form action={leaveTeamAction.bind(null, id)}>
              <button
                type="submit"
                className="w-full rounded-lg border border-red-300 py-3 text-sm text-red-600 hover:bg-red-50"
              >
                팀 탈퇴
              </button>
            </form>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-neutral-50 p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <Link href={`/event/${id}`} className="text-sm text-neutral-500 hover:underline">
          ← {event.name}
        </Link>

        <h1 className="text-2xl font-bold">팀</h1>

        <form
          action={createTeamAction.bind(null, id)}
          className="space-y-3 rounded-lg border bg-white p-6"
        >
          <h2 className="font-semibold">팀 만들기</h2>
          <input
            name="name"
            type="text"
            required
            placeholder="우리 가족"
            className="w-full rounded-lg border px-3 py-2"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-600 py-2.5 font-semibold text-white hover:bg-violet-700"
          >
            만들기
          </button>
        </form>

        <div className="text-center text-sm text-neutral-400">또는</div>

        <form
          action={joinTeamAction.bind(null, id)}
          className="space-y-3 rounded-lg border bg-white p-6"
        >
          <h2 className="font-semibold">팀 합류</h2>
          <input
            name="team_code"
            type="text"
            required
            placeholder="FIRE-3829"
            className="w-full rounded-lg border px-3 py-2 uppercase"
          />
          <button
            type="submit"
            className="w-full rounded-lg border bg-white py-2.5 font-semibold hover:bg-neutral-50"
          >
            합류
          </button>
        </form>
      </div>
    </main>
  );
}
