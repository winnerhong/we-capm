import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubmissionCard } from "./submission-card";
import { RealtimeRefresher } from "./realtime-refresher";

export const dynamic = "force-dynamic";

type FilterStatus = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

export default async function SubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const { status } = await searchParams;
  const filter: FilterStatus = (status as FilterStatus) ?? "PENDING";

  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  let query = supabase
    .from("submissions")
    .select(
      "id, status, photo_urls, text_content, submitted_at, reject_reason, mission_id, participant_id"
    )
    .order("submitted_at", { ascending: true });

  if (filter !== "ALL") query = query.eq("status", filter);

  const { data: submissions } = await query;

  const missionIds = Array.from(new Set((submissions ?? []).map((s) => s.mission_id)));
  const participantIds = Array.from(new Set((submissions ?? []).map((s) => s.participant_id)));

  const { data: missions } = missionIds.length
    ? await supabase
        .from("missions")
        .select("id, title, template_type, points, event_id")
        .in("id", missionIds)
    : { data: [] };

  const { data: participants } = participantIds.length
    ? await supabase.from("participants").select("id, user_id").in("id", participantIds)
    : { data: [] };

  const userIds = Array.from(new Set((participants ?? []).map((p) => p.user_id).filter((id): id is string => id !== null)));
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, name").in("id", userIds)
    : { data: [] };

  const missionMap = new Map((missions ?? []).map((m) => [m.id, m]));
  const participantMap = new Map((participants ?? []).map((p) => [p.id, p]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const filteredForEvent = (submissions ?? []).filter((s) => {
    const m = missionMap.get(s.mission_id);
    return m?.event_id === id;
  });

  return (
    <div className="space-y-4">
      <RealtimeRefresher />
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/admin/events/${id}`} className="text-sm text-neutral-500 hover:underline">
            ← {event.name}
          </Link>
          <h1 className="text-2xl font-bold">승인 대기함</h1>
        </div>
        <a href={`/api/export/submissions?event_id=${id}`} download
          className="rounded-lg border border-[#D4E4BC] px-3 py-2 text-sm text-[#2D5A3D] hover:bg-[#E8F0E4]">
          📥 CSV 다운로드
        </a>
      </div>

      <div className="flex gap-2 text-sm">
        {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/events/${id}/submissions?status=${s}`}
            className={`rounded-full px-3 py-1 ${
              filter === s ? "bg-violet-600 text-white" : "bg-white border"
            }`}
          >
            {s === "PENDING" ? "대기" : s === "APPROVED" ? "승인" : s === "REJECTED" ? "반려" : "전체"}
          </Link>
        ))}
      </div>

      {filteredForEvent.length > 0 ? (
        <ul className="space-y-3">
          {filteredForEvent.map((s) => {
            const mission = missionMap.get(s.mission_id);
            const participant = participantMap.get(s.participant_id);
            const profile = participant ? participant.user_id ? profileMap.get(participant.user_id) : null : null;
            return (
              <SubmissionCard
                key={s.id}
                eventId={id}
                submission={s}
                missionTitle={mission?.title ?? "(삭제됨)"}
                missionType={mission?.template_type ?? ""}
                missionPoints={mission?.points ?? 0}
                participantName={profile?.name ?? "(알 수 없음)"}
              />
            );
          })}
        </ul>
      ) : (
        <div className="rounded-lg border bg-white p-12 text-center text-neutral-500">
          {filter === "PENDING" ? "대기 중인 제출이 없습니다" : "해당 상태의 제출이 없습니다"}
        </div>
      )}
    </div>
  );
}
