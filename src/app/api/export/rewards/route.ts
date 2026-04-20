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

  const { data: rewards } = await supabase
    .from("rewards")
    .select("id, name")
    .eq("event_id", eventId);
  const rewardMap = new Map(
    (rewards ?? []).map((r) => [r.id, r.name as string])
  );
  const rewardIds = (rewards ?? []).map((r) => r.id);

  if (rewardIds.length === 0) {
    const csv = toCSV<{ placeholder: string }>([], [
      { key: "placeholder", label: "데이터 없음" },
    ]);
    return csvResponse(csv, `rewards_${event.name}_${todayISO()}.csv`);
  }

  const { data: claims } = await supabase
    .from("reward_claims")
    .select("id, reward_id, participant_id, status, earned_at, claimed_at")
    .in("reward_id", rewardIds)
    .order("earned_at", { ascending: true });

  const participantIds = Array.from(
    new Set((claims ?? []).map((c) => c.participant_id))
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
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, name").in("id", userIds)
    : { data: [] };
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.name as string])
  );
  const participantMap = new Map(
    (participants ?? []).map((p) => [p.id, p])
  );

  const statusLabel = (s: string) => {
    if (s === "EARNED") return "획득";
    if (s === "CLAIMED") return "수령";
    return s;
  };

  const rows = (claims ?? []).map((c) => {
    const p = participantMap.get(c.participant_id);
    const name = p?.user_id ? profileMap.get(p.user_id) ?? "" : "";
    return {
      participant: name,
      phone: p?.phone ?? "",
      reward: rewardMap.get(c.reward_id) ?? "(삭제됨)",
      status: statusLabel(c.status),
      earned_at: formatDateKR(c.earned_at),
      claimed_at: formatDateKR(c.claimed_at),
    };
  });

  const csv = toCSV(rows, [
    { key: "participant", label: "참가자" },
    { key: "phone", label: "전화번호" },
    { key: "reward", label: "보상명" },
    { key: "status", label: "상태" },
    { key: "earned_at", label: "획득 시각" },
    { key: "claimed_at", label: "수령 시각" },
  ]);

  return csvResponse(csv, `rewards_${event.name}_${todayISO()}.csv`);
}
