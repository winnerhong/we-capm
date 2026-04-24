import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getParticipant, getParticipantDb } from "@/lib/participant-session";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab: "individual" | "team" = tab === "team" ? "team" : "individual";

  const supabase = await createClient();

  // redirect removed(`/login?next=/event/${id}/leaderboard`);

  const { data: event } = await supabase
    .from("events")
    .select("id, name, show_leaderboard, participation_type")
    .eq("id", id)
    .single();
  if (!event) notFound();

  if (!event.show_leaderboard) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p className="text-sm text-neutral-500">이 숲길은 명예의 전당이 비공개예요</p>
      </main>
    );
  }

  const { data: participants } = await supabase
    .from("participants")
    .select("id, user_id, total_score, team_id, phone")
    .eq("event_id", id)
    .order("total_score", { ascending: false });

  const userIds = (participants ?? []).map((p) => p.user_id).filter((id): id is string => id !== null);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, name").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, total_score")
    .eq("event_id", id)
    .order("total_score", { ascending: false });

  const session = await getParticipant(id); const myParticipant = participants?.find((p) => p.phone === session?.phone);

  return (
    <main className="min-h-dvh bg-neutral-50 pb-24">
      <RealtimeRefresh table="participants" />
      <div className="bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] px-4 pt-4 pb-6 text-white shadow-lg">
        <Link href={`/event/${id}`} className="text-xs opacity-80 hover:underline">
          ← {event.name}
        </Link>
        <h1 className="mt-1 text-xl font-bold">🏞️ 함께 걷는 숲</h1>
        <p className="mt-1 text-xs opacity-90">숲에서 만난 친구들의 도토리 <AcornIcon /></p>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        {event.participation_type === "BOTH" && (
          <div className="flex gap-1 rounded-xl bg-[#E8F0E4] p-1 text-sm">
            <Link
              href={`/event/${id}/leaderboard?tab=individual`}
              className={`flex-1 rounded-lg py-2 text-center ${
                activeTab === "individual" ? "bg-white font-semibold text-[#2D5A3D] shadow-sm" : "text-[#6B6560]"
              }`}
            >
              🐿️ 개인
            </Link>
            <Link
              href={`/event/${id}/leaderboard?tab=team`}
              className={`flex-1 rounded-lg py-2 text-center ${
                activeTab === "team" ? "bg-white font-semibold text-[#2D5A3D] shadow-sm" : "text-[#6B6560]"
              }`}
            >
              🌲 팀
            </Link>
          </div>
        )}

        {activeTab === "individual" ? (
          <ul className="space-y-2">
            {(participants ?? []).map((p, idx) => {
              const profile = p.user_id ? profileMap.get(p.user_id) : null;
              const isMe = p.phone === session?.phone;
              const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
              return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between rounded-2xl border bg-white p-4 ${
                    isMe ? "border-violet-500 bg-[#E8F0E4]" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center text-lg">{medal ?? `${idx + 1}`}</span>
                    <span className="font-medium">{profile?.name ?? "?"}</span>
                    {isMe && <span className="text-xs font-semibold text-violet-600">(나)</span>}
                  </div>
                  <span className="font-bold text-[#2D5A3D]"><AcornIcon /> {p.total_score}</span>
                </li>
              );
            })}
            {(!participants || participants.length === 0) && (
              <div className="rounded-2xl border bg-white p-12 text-center text-sm text-[#6B6560]">
                아직 함께 걷는 친구가 없어요 🌱
              </div>
            )}
          </ul>
        ) : (
          <ul className="space-y-2">
            {(teams ?? []).map((t, idx) => {
              const isMyTeam = myParticipant?.team_id === t.id;
              const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
              return (
                <li
                  key={t.id}
                  className={`flex items-center justify-between rounded-2xl border bg-white p-4 ${
                    isMyTeam ? "border-violet-500 bg-[#E8F0E4]" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center text-lg">{medal ?? `${idx + 1}`}</span>
                    <span className="font-medium">{t.name}</span>
                    {isMyTeam && <span className="text-xs font-semibold text-violet-600">(우리 숲)</span>}
                  </div>
                  <span className="font-bold text-[#2D5A3D]"><AcornIcon /> {t.total_score}</span>
                </li>
              );
            })}
            {(!teams || teams.length === 0) && (
              <div className="rounded-2xl border bg-white p-12 text-center text-sm text-[#6B6560]">
                아직 이루어진 숲이 없어요 🌲
              </div>
            )}
          </ul>
        )}
      </div>
    </main>
  );
}
