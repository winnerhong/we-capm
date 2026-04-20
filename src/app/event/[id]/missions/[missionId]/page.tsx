import { notFound, redirect } from "next/navigation";
import { getParticipant, getParticipantDb } from "@/lib/participant-session";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { QuizForm } from "./quiz-form";
import { PhotoForm } from "./photo-form";
import { LocationForm } from "./location-form";
import { TimeattackForm } from "./timeattack-form";
import { VideoForm } from "./video-form";

export const dynamic = "force-dynamic";

export default async function MissionSubmitPage({
  params,
}: {
  params: Promise<{ id: string; missionId: string }>;
}) {
  const { id: eventId, missionId } = await params;
  const supabase = await createClient();

  // redirect removed(`/login?next=/event/${eventId}/missions/${missionId}`);

  const { data: mission } = await supabase
    .from("missions")
    .select("id, title, description, template_type, points, config, auto_approve, event_id")
    .eq("id", missionId)
    .single();
  if (!mission || mission.event_id !== eventId) notFound();

  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("event_id", eventId)
    .eq("phone", (await getParticipant(eventId))?.phone ?? "")
    .maybeSingle();
  if (!participant) redirect(`/event/${eventId}`);

  const { data: existing } = await supabase
    .from("submissions")
    .select("id, status, reject_reason")
    .eq("mission_id", missionId)
    .eq("participant_id", participant.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const canSubmit =
    !existing ||
    existing.status === "REJECTED" ||
    existing.status === "RESUBMIT_REQUESTED" ||
    existing.status === "EXPIRED";

  return (
    <main className="min-h-dvh bg-neutral-50 pb-24">
      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-lg">
          <Link
            href={`/event/${eventId}/missions`}
            className="text-xs opacity-80 hover:underline"
          >
            ← 숲길 목록
          </Link>
          <h1 className="mt-2 text-2xl font-bold">🌿 {mission.title}</h1>
          <p className="mt-1 text-sm opacity-90">{mission.description}</p>
          <p className="mt-3 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">🌰 도토리 {mission.points}개</p>
        </div>

        {existing && existing.status === "REJECTED" && existing.reject_reason && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            🍂 다시 도전: {existing.reject_reason}
          </div>
        )}

        {!canSubmit ? (
          <div className="rounded-2xl border bg-white p-6 text-center">
            <p className="text-sm text-[#6B6560]">
              {existing?.status === "PENDING" && "🌰 지기가 확인 중이에요"}
              {(existing?.status === "APPROVED" || existing?.status === "AUTO_APPROVED") &&
                "🐾 이미 걸어온 숲길이에요"}
            </p>
          </div>
        ) : mission.template_type === "QUIZ" ? (
          <QuizForm eventId={eventId} missionId={missionId} />
        ) : mission.template_type === "PHOTO" ? (
          <PhotoForm
            eventId={eventId}
            missionId={missionId}
            participantId={participant.id}
            config={mission.config as { minPhotos?: number; maxPhotos?: number }}
          />
        ) : mission.template_type === "LOCATION" ? (
          <LocationForm eventId={eventId} missionId={missionId} />
        ) : mission.template_type === "VIDEO" ? (
          <VideoForm
            eventId={eventId}
            missionId={missionId}
            participantId={participant.id}
            maxDurationSec={(mission.config as { maxDurationSec?: number }).maxDurationSec ?? 30}
          />
        ) : mission.template_type === "TIMEATTACK" ? (
          <TimeattackForm
            eventId={eventId}
            missionId={missionId}
            timeLimitSec={(mission.config as { timeLimitSec?: number }).timeLimitSec ?? 60}
          />
        ) : (
          <div className="rounded-2xl border bg-white p-6 text-center text-sm text-[#6B6560]">
            이 숲길은 아직 준비 중이에요 🌱
          </div>
        )}
      </div>
    </main>
  );
}
