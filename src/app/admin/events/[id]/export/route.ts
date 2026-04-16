import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("name").eq("id", id).single();
  if (!event) return new NextResponse("Not Found", { status: 404 });

  const [participantsRes, missionsRes, submissionsRes] = await Promise.all([
    supabase.from("participants").select("id, user_id, total_score, joined_at").eq("event_id", id).order("total_score", { ascending: false }),
    supabase.from("missions").select("id, title, points").eq("event_id", id).eq("is_active", true),
    supabase.from("submissions").select("id, mission_id, participant_id, status, earned_points, submitted_at").in("status", ["APPROVED", "AUTO_APPROVED"]),
  ]);

  const participants = participantsRes.data ?? [];
  const missions = missionsRes.data ?? [];

  const userIds = participants.map((p) => p.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, name").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const { data: regs } = await supabase.from("event_registrations").select("phone, name").eq("event_id", id);
  const regByName = new Map((regs ?? []).map((r) => [r.name, r.phone]));

  const submissionsByParticipant = new Map<string, Set<string>>();
  for (const sub of submissionsRes.data ?? []) {
    if (!submissionsByParticipant.has(sub.participant_id)) {
      submissionsByParticipant.set(sub.participant_id, new Set());
    }
    submissionsByParticipant.get(sub.participant_id)!.add(sub.mission_id);
  }

  const header = ["순위", "이름", "전화번호", "총점", "완료미션", ...missions.map((m) => m.title), "가입일"];
  const rows = participants.map((p, i) => {
    const profile = profileMap.get(p.user_id);
    const name = profile?.name ?? "?";
    const phone = regByName.get(name) ?? "";
    const completedMissions = submissionsByParticipant.get(p.id);
    const missionCols = missions.map((m) => (completedMissions?.has(m.id) ? "O" : ""));
    return [
      String(i + 1),
      name,
      phone,
      String(p.total_score),
      String(completedMissions?.size ?? 0),
      ...missionCols,
      new Date(p.joined_at).toLocaleString("ko-KR"),
    ];
  });

  const bom = "\uFEFF";
  const csv = bom + [header, ...rows].map((r) => r.join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.name}_results.csv"`,
    },
  });
}
