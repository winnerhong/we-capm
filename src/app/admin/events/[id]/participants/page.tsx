import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  const { data: participants } = await supabase
    .from("participants")
    .select("id, user_id, team_id, total_score, participation_type, joined_at")
    .eq("event_id", id)
    .order("total_score", { ascending: false });

  const userIds = (participants ?? []).map((p) => p.user_id);
  const teamIds = Array.from(
    new Set((participants ?? []).map((p) => p.team_id).filter(Boolean) as string[])
  );

  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, name").in("id", userIds)
    : { data: [] };
  const { data: teams } = teamIds.length
    ? await supabase.from("teams").select("id, name").in("id", teamIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/admin/events/${id}`} className="text-sm text-neutral-500 hover:underline">
          ← {event.name}
        </Link>
        <h1 className="text-2xl font-bold">참가자 ({participants?.length ?? 0}명)</h1>
      </div>

      {participants && participants.length > 0 ? (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">이름</th>
                <th className="px-4 py-2">참가 단위</th>
                <th className="px-4 py-2">팀</th>
                <th className="px-4 py-2 text-right">점수</th>
                <th className="px-4 py-2">가입일</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {participants.map((p, i) => {
                const profile = profileMap.get(p.user_id);
                const team = p.team_id ? teamMap.get(p.team_id) : null;
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-2 text-neutral-400">{i + 1}</td>
                    <td className="px-4 py-2 font-medium">{profile?.name ?? "?"}</td>
                    <td className="px-4 py-2 text-neutral-600">
                      {p.participation_type === "TEAM" ? "팀" : "개인"}
                    </td>
                    <td className="px-4 py-2 text-neutral-600">{team?.name ?? "-"}</td>
                    <td className="px-4 py-2 text-right font-semibold">{p.total_score}</td>
                    <td className="px-4 py-2 text-xs text-neutral-500">
                      {new Date(p.joined_at).toLocaleString("ko-KR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-12 text-center text-neutral-500">
          아직 참가자가 없습니다
        </div>
      )}
    </div>
  );
}
