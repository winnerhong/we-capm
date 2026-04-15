import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function EventHomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/event/${id}`);

  const { data: event } = await supabase
    .from("events")
    .select("id, name, status, location, start_at, end_at")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const { data: participant } = await supabase
    .from("participants")
    .select("id, total_score")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="min-h-dvh bg-neutral-50 p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <header className="rounded-lg bg-violet-600 p-6 text-white">
          <p className="text-xs opacity-80">행사 홈</p>
          <h1 className="text-xl font-bold">{event.name}</h1>
          <p className="mt-1 text-sm opacity-90">📍 {event.location}</p>
          {participant && (
            <div className="mt-4 rounded-lg bg-white/20 p-3">
              <div className="text-xs opacity-80">내 점수</div>
              <div className="text-2xl font-bold">{participant.total_score}점</div>
            </div>
          )}
        </header>

        <section className="rounded-lg border bg-white p-6 text-center text-neutral-500">
          <p className="text-sm">미션이 곧 공개됩니다</p>
          <p className="mt-1 text-xs">Phase 2에서 구현 예정</p>
        </section>
      </div>
    </main>
  );
}
