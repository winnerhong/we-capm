import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  const [
    { count: participantCount },
    { count: teamCount },
    { count: missionCount },
    { count: submissionTotal },
    { count: pendingCount },
    { count: approvedCount },
    { count: rejectedCount },
    { count: rewardClaimCount },
  ] = await Promise.all([
    supabase.from("participants").select("*", { count: "exact", head: true }).eq("event_id", id),
    supabase.from("teams").select("*", { count: "exact", head: true }).eq("event_id", id),
    supabase.from("missions").select("*", { count: "exact", head: true }).eq("event_id", id).eq("is_active", true),
    supabase.from("submissions").select("missions!inner(event_id)", { count: "exact", head: true }).eq("missions.event_id", id),
    supabase.from("submissions").select("missions!inner(event_id)", { count: "exact", head: true }).eq("missions.event_id", id).eq("status", "PENDING"),
    supabase.from("submissions").select("missions!inner(event_id)", { count: "exact", head: true }).eq("missions.event_id", id).in("status", ["APPROVED", "AUTO_APPROVED"]),
    supabase.from("submissions").select("missions!inner(event_id)", { count: "exact", head: true }).eq("missions.event_id", id).eq("status", "REJECTED"),
    supabase.from("reward_claims").select("rewards!inner(event_id)", { count: "exact", head: true }).eq("rewards.event_id", id),
  ]);

  const { data: topParticipants } = await supabase
    .from("participants")
    .select("id, user_id, total_score")
    .eq("event_id", id)
    .order("total_score", { ascending: false })
    .limit(5);

  const userIds = (topParticipants ?? []).map((p) => p.user_id).filter((id): id is string => id !== null);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, name").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const stats = [
    { label: "참가자", value: participantCount ?? 0, icon: "👥" },
    { label: "팀", value: teamCount ?? 0, icon: "🤝" },
    { label: "미션", value: missionCount ?? 0, icon: "🎯" },
    { label: "총 제출", value: submissionTotal ?? 0, icon: "📝" },
    { label: "대기 중", value: pendingCount ?? 0, icon: "⏳" },
    { label: "승인", value: approvedCount ?? 0, icon: "✅" },
    { label: "반려", value: rejectedCount ?? 0, icon: "❌" },
    { label: "보상 지급", value: rewardClaimCount ?? 0, icon: "🎁" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/events/${id}`} className="text-sm hover:underline">← {event.name}</Link>
        <h1 className="text-2xl font-bold">행사 통계</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-white p-4 text-center">
            <div className="text-2xl">{s.icon}</div>
            <div className="mt-1 text-2xl font-bold">{s.value}</div>
            <div className="text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold">🏆 상위 5명</h2>
        <ol className="space-y-2">
          {(topParticipants ?? []).map((p, i) => {
            const profile = p.user_id ? profileMap.get(p.user_id) : null;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
            return (
              <li key={p.id} className="flex items-center justify-between py-1">
                <span>{medal} {profile?.name ?? "?"}</span>
                <span className="font-bold">{p.total_score}점</span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex gap-2">
        <a href={`/admin/events/${id}/export`} download
          className="flex-1 rounded-lg bg-violet-600 py-3 text-center font-semibold text-white hover:bg-violet-700">
          📊 결과 CSV 다운로드
        </a>
      </div>
    </div>
  );
}
