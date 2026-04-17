import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage() {
  const supabase = await createClient();

  const [{ count: totalEvents }, { count: activeEvents }, { count: totalParticipants }, { count: totalSubmissions }] =
    await Promise.all([
      supabase.from("events").select("*", { count: "exact", head: true }),
      supabase.from("events").select("*", { count: "exact", head: true }).eq("status", "ACTIVE"),
      supabase.from("participants").select("*", { count: "exact", head: true }),
      supabase.from("submissions").select("*", { count: "exact", head: true }),
    ]);

  const { data: recentEvents } = await supabase
    .from("events")
    .select("id, name, status, start_at, location")
    .order("created_at", { ascending: false })
    .limit(5);

  const stats = [
    { label: "전체 행사", value: totalEvents ?? 0, icon: "📋" },
    { label: "진행 중", value: activeEvents ?? 0, icon: "🟢" },
    { label: "총 참가자", value: totalParticipants ?? 0, icon: "👥" },
    { label: "총 제출", value: totalSubmissions ?? 0, icon: "📝" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📊 전체 통계</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-white p-5 text-center">
            <div className="text-2xl">{s.icon}</div>
            <div className="mt-2 text-3xl font-bold">{s.value}</div>
            <div className="mt-1 text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-semibold">최근 행사</h2>
        <ul className="divide-y">
          {(recentEvents ?? []).map((e) => (
            <li key={e.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{e.name}</div>
                <div className="text-xs">📍 {e.location} · {new Date(e.start_at).toLocaleDateString("ko-KR")}</div>
              </div>
              <span className="text-xs">{e.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
