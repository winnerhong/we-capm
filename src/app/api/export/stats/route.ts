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
    .select("id, name, start_at, end_at, location, status")
    .eq("id", eventId)
    .single();
  if (!event) {
    return NextResponse.json({ error: "event not found" }, { status: 404 });
  }

  // Parallel count + aggregate queries.
  const [
    { count: registeredCount },
    { count: enteredCount },
    { count: participantCount },
    { count: missionCount },
    { data: participantScores },
    { count: pendingCount },
    { count: approvedCount },
    { count: rejectedCount },
    { count: rewardEarnedCount },
    { count: rewardClaimedCount },
    { data: reviews },
  ] = await Promise.all([
    supabase
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId),
    supabase
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "ENTERED"),
    supabase
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId),
    supabase
      .from("missions")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("is_active", true),
    supabase
      .from("participants")
      .select("total_score")
      .eq("event_id", eventId),
    supabase
      .from("submissions")
      .select("missions!inner(event_id)", { count: "exact", head: true })
      .eq("missions.event_id", eventId)
      .eq("status", "PENDING"),
    supabase
      .from("submissions")
      .select("missions!inner(event_id)", { count: "exact", head: true })
      .eq("missions.event_id", eventId)
      .in("status", ["APPROVED", "AUTO_APPROVED"]),
    supabase
      .from("submissions")
      .select("missions!inner(event_id)", { count: "exact", head: true })
      .eq("missions.event_id", eventId)
      .eq("status", "REJECTED"),
    supabase
      .from("reward_claims")
      .select("rewards!inner(event_id)", { count: "exact", head: true })
      .eq("rewards.event_id", eventId)
      .eq("status", "EARNED"),
    supabase
      .from("reward_claims")
      .select("rewards!inner(event_id)", { count: "exact", head: true })
      .eq("rewards.event_id", eventId)
      .eq("status", "CLAIMED"),
    supabase
      .from("event_reviews")
      .select("rating")
      .eq("event_id", eventId),
  ]);

  const reg = registeredCount ?? 0;
  const ent = enteredCount ?? 0;
  const entryRate = reg > 0 ? Math.round((ent / reg) * 1000) / 10 : 0;

  const scores = (participantScores ?? []).map((p) => p.total_score);
  const avgScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

  const ratings = (reviews ?? []).map((r) => r.rating);
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;

  // Vertical "label / value" layout — easier for one-off event summaries.
  const rows: { metric: string; value: string | number }[] = [
    { metric: "행사명", value: event.name },
    { metric: "장소", value: event.location },
    { metric: "시작", value: formatDateKR(event.start_at) },
    { metric: "종료", value: formatDateKR(event.end_at) },
    { metric: "상태", value: event.status },
    { metric: "등록 인원", value: reg },
    { metric: "입장 인원", value: ent },
    { metric: "입장률 (%)", value: entryRate },
    { metric: "실제 참가자(가입)", value: participantCount ?? 0 },
    { metric: "활성 미션 수", value: missionCount ?? 0 },
    { metric: "제출 대기", value: pendingCount ?? 0 },
    { metric: "제출 승인", value: approvedCount ?? 0 },
    { metric: "제출 반려", value: rejectedCount ?? 0 },
    { metric: "평균 도토리", value: avgScore },
    { metric: "최고 도토리", value: maxScore },
    { metric: "보상 미수령", value: rewardEarnedCount ?? 0 },
    { metric: "보상 수령", value: rewardClaimedCount ?? 0 },
    { metric: "후기 수", value: ratings.length },
    { metric: "평균 별점", value: avgRating },
    { metric: "내보낸 시각", value: formatDateKR(new Date().toISOString()) },
  ];

  const csv = toCSV(rows, [
    { key: "metric", label: "항목" },
    { key: "value", label: "값" },
  ]);

  return csvResponse(csv, `stats_${event.name}_${todayISO()}.csv`);
}
