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

  const { data: reviews } = await supabase
    .from("event_reviews")
    .select(
      "participant_name, participant_phone, rating, comment, mission_highlight, improvement, is_public, photo_consent, created_at"
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  const rows = (reviews ?? []).map((r) => ({
    participant: r.participant_name ?? "",
    phone: r.participant_phone,
    rating: r.rating,
    comment: r.comment ?? "",
    highlight: r.mission_highlight ?? "",
    improvement: r.improvement ?? "",
    is_public: r.is_public ? "공개" : "비공개",
    photo_consent: r.photo_consent ? "동의" : "비동의",
    created_at: formatDateKR(r.created_at),
  }));

  const csv = toCSV(rows, [
    { key: "participant", label: "참가자" },
    { key: "phone", label: "전화번호" },
    { key: "rating", label: "별점" },
    { key: "comment", label: "후기" },
    { key: "highlight", label: "최고 숲길" },
    { key: "improvement", label: "개선사항" },
    { key: "is_public", label: "공개여부" },
    { key: "photo_consent", label: "사진동의" },
    { key: "created_at", label: "작성일" },
  ]);

  return csvResponse(csv, `reviews_${event.name}_${todayISO()}.csv`);
}
