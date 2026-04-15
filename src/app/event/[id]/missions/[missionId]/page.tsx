import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { QuizForm } from "./quiz-form";
import { PhotoForm } from "./photo-form";

export const dynamic = "force-dynamic";

export default async function MissionSubmitPage({
  params,
}: {
  params: Promise<{ id: string; missionId: string }>;
}) {
  const { id: eventId, missionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/event/${eventId}/missions/${missionId}`);

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
    .eq("user_id", user.id)
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
    <main className="min-h-dvh bg-neutral-50 p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <div>
          <Link
            href={`/event/${eventId}/missions`}
            className="text-sm text-neutral-500 hover:underline"
          >
            ← 미션 목록
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{mission.title}</h1>
          <p className="mt-1 text-sm text-neutral-600">{mission.description}</p>
          <p className="mt-2 text-sm font-semibold text-violet-600">{mission.points}점</p>
        </div>

        {existing && existing.status === "REJECTED" && existing.reject_reason && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            😢 반려됨: {existing.reject_reason}
          </div>
        )}

        {!canSubmit ? (
          <div className="rounded-lg border bg-white p-6 text-center">
            <p className="text-sm text-neutral-600">
              {existing?.status === "PENDING" && "⏳ 승인 대기 중"}
              {(existing?.status === "APPROVED" || existing?.status === "AUTO_APPROVED") &&
                "✅ 이미 완료한 미션입니다"}
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
        ) : (
          <div className="rounded-lg border bg-white p-6 text-center text-sm text-neutral-500">
            이 미션 유형은 아직 지원되지 않습니다
          </div>
        )}
      </div>
    </main>
  );
}
