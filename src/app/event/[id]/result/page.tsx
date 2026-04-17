import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getParticipant, getParticipantDb } from "@/lib/participant-session";
import { createClient } from "@/lib/supabase/server";
import { ShareCard } from "./share-card";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // redirect removed(`/login?next=/event/${id}/result`);

  const { data: event } = await supabase
    .from("events")
    .select("id, name, status, end_at, participation_type")
    .eq("id", id)
    .single();
  if (!event) notFound();

  if (event.status !== "ENDED" && event.status !== "CONFIRMED") {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="space-y-2 text-center">
          <p className="text-sm">행사가 아직 진행 중입니다</p>
          <Link href={`/event/${id}`} className="text-sm text-violet-600 hover:underline">
            행사 홈으로
          </Link>
        </div>
      </main>
    );
  }

  const { data: participant } = await supabase
    .from("participants")
    .select("id, total_score, team_id")
    .eq("event_id", id)
    .eq("phone", (await getParticipant(id))?.phone ?? "")
    .maybeSingle();
  if (!participant) redirect(`/event/${id}`);

  const { data: allParticipants } = await supabase
    .from("participants")
    .select("id, total_score")
    .eq("event_id", id)
    .order("total_score", { ascending: false });

  const rank = (allParticipants ?? []).findIndex((p) => p.id === participant.id) + 1;
  const totalParticipants = allParticipants?.length ?? 0;

  const { count: completedCount } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("participant_id", participant.id)
    .in("status", ["APPROVED", "AUTO_APPROVED"]);

  const { count: totalMissions } = await supabase
    .from("missions")
    .select("*", { count: "exact", head: true })
    .eq("event_id", id)
    .eq("is_active", true);

  const { data: claims } = await supabase
    .from("reward_claims")
    .select("id, reward_id")
    .eq("participant_id", participant.id);

  const rewardIds = (claims ?? []).map((c) => c.reward_id);
  const { data: rewards } = rewardIds.length
    ? await supabase.from("rewards").select("id, name").in("id", rewardIds)
    : { data: [] };

  const { data: photos } = await supabase
    .from("submissions")
    .select("id, photo_urls")
    .eq("participant_id", participant.id)
    .in("status", ["APPROVED", "AUTO_APPROVED"])
    .not("photo_urls", "eq", "{}");

  const photoPaths = (photos ?? []).flatMap((s) => s.photo_urls).slice(0, 6);

  return (
    <main className="min-h-dvh bg-neutral-50 p-4">
      <div className="mx-auto max-w-lg space-y-5">
        <Link href={`/event/${id}`} className="text-sm hover:underline">
          ← {event.name}
        </Link>

        <ShareCard
          eventName={event.name}
          rank={rank}
          totalParticipants={totalParticipants}
          score={participant.total_score}
          completedMissions={completedCount ?? 0}
          totalMissions={totalMissions ?? 0}
          rewardCount={claims?.length ?? 0}
        />

        {rewards && rewards.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">🎁 획득한 보상</h2>
            <ul className="space-y-1 rounded-lg border bg-white p-4 text-sm">
              {rewards.map((r) => (
                <li key={r.id}>• {r.name}</li>
              ))}
            </ul>
          </section>
        )}

        {photoPaths.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">📸 추억 모아보기</h2>
            <div className="grid grid-cols-3 gap-2">
              {photoPaths.map((path) => (
                <PhotoThumb key={path} path={path} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 text-center">
      <div className="text-xs">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

async function PhotoThumb({ path }: { path: string }) {
  const supabase = await createClient();
  const { data } = await supabase.storage.from("submission-photos").createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={data.signedUrl} alt="memory" className="aspect-square w-full rounded object-cover" />
  );
}
