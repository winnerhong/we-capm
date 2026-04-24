import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getParticipant, getParticipantDb } from "@/lib/participant-session";
import { createClient } from "@/lib/supabase/server";
import { createTeamAction, joinTeamAction, leaveTeamAction } from "./actions";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // redirect removed(`/login?next=/event/${id}/team`);

  const [eventRes, participantRes] = await Promise.all([
    supabase.from("events").select("id, name, participation_type, max_team_size").eq("id", id).single(),
    supabase.from("participants").select("id, team_id").eq("event_id", id).eq("phone", (await getParticipant(id))?.phone ?? "").maybeSingle(),
  ]);

  const event = eventRes.data;
  const participant = participantRes.data;
  if (!event) notFound();

  if (event.participation_type === "INDIVIDUAL") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-neutral-50 p-6">
        <div className="text-center space-y-2">
          <div className="text-4xl">🐿️</div>
          <p className="text-sm text-[#6B6560]">이 숲은 혼자 걸어요</p>
        </div>
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

    const userIds = (members ?? []).map((m) => m.user_id).filter((id): id is string => id !== null);
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, name").in("id", userIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const isLeader = false;

    return (
      <main className="min-h-dvh bg-neutral-50 p-4 pb-24">
        <div className="mx-auto max-w-lg space-y-4">
          <Link href={`/event/${id}`} className="text-sm text-[#6B6560] hover:underline">
            ← {event.name}
          </Link>

          <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-lg">
            <p className="text-xs opacity-90">🌲 우리 숲</p>
            <h1 className="text-xl font-bold">{team?.name}</h1>
            <div className="mt-3 flex items-baseline justify-between">
              <div>
                <div className="text-xs opacity-90">초대 코드</div>
                <div className="font-mono text-lg">{team?.team_code}</div>
              </div>
              <div className="text-right">
                <div className="text-xs opacity-90">모은 도토리</div>
                <div className="text-2xl font-bold inline-flex items-center gap-1"><AcornIcon size={20} /> {team?.total_score}</div>
              </div>
            </div>
          </div>

          <section className="rounded-2xl border bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-[#2D5A3D]">
              🐿️ 숲친구 {members?.length ?? 0}/{event.max_team_size}
            </h2>
            <ul className="divide-y divide-[#D4E4BC]">
              {(members ?? []).map((m) => {
                const p = m.user_id ? profileMap.get(m.user_id) : null;
                return (
                  <li key={m.id} className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2">
                      {p?.name ?? "?"}
                      {m.user_id === team?.leader_id && (
                        <span className="rounded-full bg-[#F5D9B5] px-2 py-0.5 text-xs text-[#8B6F47]">
                          <AcornIcon className="text-[#8B6F47]" /> 숲지기
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-[#4A7C59]"><AcornIcon /> {m.total_score}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {!isLeader && (
            <form action={leaveTeamAction.bind(null, id)}>
              <button
                type="submit"
                className="w-full rounded-2xl border border-red-300 bg-white py-3 text-sm text-red-600 hover:bg-red-50"
              >
                숲에서 떠나기
              </button>
            </form>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-neutral-50 p-4 pb-24">
      <div className="mx-auto max-w-lg space-y-4">
        <Link href={`/event/${id}`} className="text-sm text-[#6B6560] hover:underline">
          ← {event.name}
        </Link>

        <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold">🌲 우리 숲 만들기</h1>
          <p className="mt-1 text-sm opacity-90">함께 걸을 숲친구를 찾아보세요</p>
        </div>

        <form
          action={createTeamAction.bind(null, id)}
          className="space-y-3 rounded-2xl border bg-white p-6"
        >
          <h2 className="font-semibold text-[#2D5A3D]">🌱 새 숲 만들기</h2>
          <input
            name="name"
            type="text"
            required
            placeholder="우리 가족"
            className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 focus:ring-2 focus:ring-violet-500 outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-violet-600 py-2.5 font-semibold text-white hover:bg-violet-700"
          >
            숲 만들기
          </button>
        </form>

        <div className="text-center text-sm text-[#6B6560]">또는</div>

        <form
          action={joinTeamAction.bind(null, id)}
          className="space-y-3 rounded-2xl border bg-white p-6"
        >
          <h2 className="font-semibold text-[#2D5A3D]">🌿 숲에 합류하기</h2>
          <input
            name="team_code"
            type="text"
            required
            placeholder="FIRE-3829"
            className="w-full rounded-xl border border-[#D4E4BC] px-3 py-2 uppercase focus:ring-2 focus:ring-violet-500 outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-xl border-2 border-[#D4E4BC] bg-white py-2.5 font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            합류하기
          </button>
        </form>
      </div>
    </main>
  );
}
