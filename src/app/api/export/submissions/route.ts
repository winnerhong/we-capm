import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCSV, csvResponse, formatDateKR, todayISO } from "@/lib/csv-export";
import { requireAdminOrManager } from "@/lib/auth-guard";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("event_id");
  if (!eventId) {
    return NextResponse.json({ error: "event_id required" }, { status: 400 });
  }

  try {
    await requireAdminOrManager(eventId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unauthorized" },
      { status: 403 }
    );
  }

  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("name")
    .eq("id", eventId)
    .single();
  if (!event) {
    return NextResponse.json({ error: "event not found" }, { status: 404 });
  }

  // Missions scoped to this event — use IDs to filter submissions safely.
  const { data: missions } = await supabase
    .from("missions")
    .select("id, title")
    .eq("event_id", eventId);
  const missionMap = new Map(
    (missions ?? []).map((m) => [m.id, m.title as string])
  );
  const missionIds = (missions ?? []).map((m) => m.id);

  if (missionIds.length === 0) {
    const csv = toCSV<{ placeholder: string }>([], [
      { key: "placeholder", label: "데이터 없음" },
    ]);
    return csvResponse(csv, `submissions_${event.name}_${todayISO()}.csv`);
  }

  const { data: submissions } = await supabase
    .from("submissions")
    .select(
      "id, mission_id, participant_id, status, submitted_at, reviewed_at, reviewed_by_user_id, earned_points, reject_reason"
    )
    .in("mission_id", missionIds)
    .order("submitted_at", { ascending: true });

  const participantIds = Array.from(
    new Set((submissions ?? []).map((s) => s.participant_id))
  );
  const { data: participants } = participantIds.length
    ? await supabase
        .from("participants")
        .select("id, user_id, phone")
        .in("id", participantIds)
    : { data: [] };

  const userIds = Array.from(
    new Set(
      (participants ?? [])
        .map((p) => p.user_id)
        .filter((v): v is string => v !== null)
    )
  );

  const reviewerIds = Array.from(
    new Set(
      (submissions ?? [])
        .map((s) => s.reviewed_by_user_id)
        .filter((v): v is string => v !== null)
    )
  );

  const allProfileIds = Array.from(new Set([...userIds, ...reviewerIds]));
  const { data: profiles } = allProfileIds.length
    ? await supabase
        .from("profiles")
        .select("id, name")
        .in("id", allProfileIds)
    : { data: [] };

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.name as string])
  );
  const participantMap = new Map(
    (participants ?? []).map((p) => [p.id, p])
  );

  const statusLabel = (s: string) => {
    if (s === "PENDING") return "대기";
    if (s === "APPROVED") return "승인";
    if (s === "AUTO_APPROVED") return "자동승인";
    if (s === "REJECTED") return "반려";
    return s;
  };

  const rows = (submissions ?? []).map((s) => {
    const p = participantMap.get(s.participant_id);
    const name = p?.user_id ? profileMap.get(p.user_id) ?? "" : "";
    const reviewer = s.reviewed_by_user_id
      ? profileMap.get(s.reviewed_by_user_id) ?? ""
      : "";
    return {
      participant: name,
      phone: p?.phone ?? "",
      mission: missionMap.get(s.mission_id) ?? "(삭제됨)",
      status: statusLabel(s.status),
      submitted_at: formatDateKR(s.submitted_at),
      reviewed_at: formatDateKR(s.reviewed_at),
      reviewer,
      earned: s.earned_points ?? 0,
      reject_reason: s.reject_reason ?? "",
    };
  });

  const csv = toCSV(rows, [
    { key: "participant", label: "참가자" },
    { key: "phone", label: "전화번호" },
    { key: "mission", label: "미션" },
    { key: "status", label: "상태" },
    { key: "submitted_at", label: "제출 시각" },
    { key: "reviewed_at", label: "심사 시각" },
    { key: "reviewer", label: "승인자" },
    { key: "earned", label: "획득 도토리" },
    { key: "reject_reason", label: "반려 사유" },
  ]);

  return csvResponse(csv, `submissions_${event.name}_${todayISO()}.csv`);
}
