import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/event/${id}/leaderboard`);

  const { data: event } = await supabase
    .from("events")
    .select("id, name, show_leaderboard, participation_type")
    .eq("id", id)
    .single();
  if (!event) notFound();

  if (!event.show_leaderboard) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p className="text-sm text-neutral-500">이 행사는 리더보드가 비공개입니다</p>
      </main>
    );
  }

  const { data: participants } = await supabase
    .from("participants")
    .select("id, user_id, total_score, team_id")
    .eq("event_id", id)
    .order("total_score", { ascending: false });

  const userIds = (participants ?? []).map((p) => p.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, name").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, total_score")
    .eq("event_id", id)
    .order("total_score", { ascending: false });

  const myParticipant = participants?.find((p) => p.user_id === user.id);

  return (
    <main className="min-h-dvh bg-neutral-50 p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <header className="flex items-center justify-between">
          <Link href={`/event/${id}`} className="text-sm text-neutral-500 hover:underline">
            ← {event.name}
          </Link>
          <h1 className="text-xl font-bold">순위</h1>
        </header>

        {event.participation_type === "BOTH" && (
          <div className="flex gap-1 rounded-lg bg-neutral-200 p-1 text-sm">
            <Link
              href={`/event/${id}/leaderboard?tab=individual`}
              className={`flex-1 rounded-md py-2 text-center ${
                activeTab === "individual" ? "bg-white font-semibold" : "text-neutral-600"
              }`}
            >
              개인
            </Link>
            <Link
              href={`/event/${id}/leaderboard?tab=team`}
              className={`flex-1 rounded-md py-2 text-center ${
                activeTab === "team" ? "bg-white font-semibold" : "text-neutral-600"
              }`}
            >
              팀
            </Link>
          </div>
        )}

        {activeTab === "individual" ? (
          <ul className="space-y-2">
            {(participants ?? []).map((p, idx) => {
              const profile = profileMap.get(p.user_id);
              const isMe = p.user_id === user.id;
              const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
              return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between rounded-lg border bg-white p-4 ${
                    isMe ? "border-violet-500 bg-violet-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center text-lg">{medal ?? `${idx + 1}`}</span>
                    <span className="font-medium">{profile?.name ?? "?"}</span>
                    {isMe && <span className="text-xs text-violet-600">(나)</span>}
                  </div>
                  <span className="font-bold">{p.total_score}점</span>
                </li>
              );
            })}
            {(!participants || participants.length === 0) && (
              <div className="rounded-lg border bg-white p-12 text-center text-sm text-neutral-500">
                참가자가 없습니다
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
                  className={`flex items-center justify-between rounded-lg border bg-white p-4 ${
                    isMyTeam ? "border-violet-500 bg-violet-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center text-lg">{medal ?? `${idx + 1}`}</span>
                    <span className="font-medium">{t.name}</span>
                    {isMyTeam && <span className="text-xs text-violet-600">(우리팀)</span>}
                  </div>
                  <span className="font-bold">{t.total_score}점</span>
                </li>
              );
            })}
            {(!teams || teams.length === 0) && (
              <div className="rounded-lg border bg-white p-12 text-center text-sm text-neutral-500">
                팀이 없습니다
              </div>
            )}
          </ul>
        )}
      </div>
    </main>
  );
}
