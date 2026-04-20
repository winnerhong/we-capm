import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  toCSV,
  csvResponse,
  formatDateKR,
  todayISO,
  splitClassName,
} from "@/lib/csv-export";
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

  const [{ data: regs }, { data: participants }] = await Promise.all([
    supabase
      .from("event_registrations")
      .select("phone, name, status, entered_at, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true }),
    supabase
      .from("participants")
      .select("id, phone, total_score")
      .eq("event_id", eventId),
  ]);

  const scoreByPhone = new Map<string, number>();
  const participantIdByPhone = new Map<string, string>();
  for (const p of participants ?? []) {
    if (!p.phone) continue;
    scoreByPhone.set(p.phone, p.total_score);
    participantIdByPhone.set(p.phone, p.id);
  }

  // Count approved submissions per participant for the "completed missions" column.
  const participantIds = (participants ?? []).map((p) => p.id);
  const completedByParticipant = new Map<string, number>();
  if (participantIds.length) {
    const { data: subs } = await supabase
      .from("submissions")
      .select("participant_id, status, missions!inner(event_id)")
      .in("participant_id", participantIds)
      .eq("missions.event_id", eventId)
      .in("status", ["APPROVED", "AUTO_APPROVED"]);
    for (const s of subs ?? []) {
      completedByParticipant.set(
        s.participant_id,
        (completedByParticipant.get(s.participant_id) ?? 0) + 1
      );
    }
  }

  const statusLabel = (s: string) => {
    if (s === "ENTERED") return "입장";
    if (s === "REGISTERED") return "미입장";
    return s;
  };

  const rows = (regs ?? []).map((r) => {
    const { className, name } = splitClassName(r.name);
    const participantId = participantIdByPhone.get(r.phone);
    return {
      name,
      class: className,
      phone: r.phone,
      status: statusLabel(r.status),
      entered_at: formatDateKR(r.entered_at),
      score: scoreByPhone.get(r.phone) ?? 0,
      completed: participantId ? completedByParticipant.get(participantId) ?? 0 : 0,
    };
  });

  const csv = toCSV(rows, [
    { key: "name", label: "이름" },
    { key: "class", label: "학급" },
    { key: "phone", label: "전화번호" },
    { key: "status", label: "입장 상태" },
    { key: "entered_at", label: "입장 시각" },
    { key: "score", label: "총 도토리" },
    { key: "completed", label: "완료 숲길 수" },
  ]);

  return csvResponse(csv, `participants_${event.name}_${todayISO()}.csv`);
}
