import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StampScanner } from "./stamp-scanner";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

export default async function ManagerStampPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, status")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  const { data: board } = await supabase
    .from("stamp_boards")
    .select("id, name, total_slots, tier_config")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .maybeSingle();

  if (!board) {
    return (
      <div className="rounded-2xl border border-[#E8F0E4] bg-white p-12 text-center shadow-sm">
        <div className="mb-4 flex justify-center" aria-hidden><AcornIcon size={48} className="text-[#C4956A]" /></div>
        <h2 className="text-lg font-bold text-[#2D5A3D]">도장판이 아직 준비되지 않았어요</h2>
        <p className="mt-2 text-sm text-[#6B6560]">관리자에게 도장판 생성을 요청해 주세요</p>
      </div>
    );
  }

  const { data: slots } = await supabase
    .from("stamp_slots")
    .select("id, name, icon, order, congestion_status, type, staff_name, location_hint")
    .eq("board_id", board.id)
    .eq("is_active", true)
    .order("order", { ascending: true });

  // Recent stamp records
  const slotIds = (slots ?? []).map((s) => s.id);
  const { data: recentRecords } = slotIds.length
    ? await supabase
        .from("stamp_records")
        .select("id, slot_id, participant_id, stamped_at, stamped_by")
        .in("slot_id", slotIds)
        .order("stamped_at", { ascending: false })
        .limit(10)
    : { data: [] };

  // Get participant names for recent records
  const participantIds = [...new Set((recentRecords ?? []).map((r) => r.participant_id))];
  const { data: participants } = participantIds.length
    ? await supabase
        .from("participants")
        .select("id, phone")
        .in("id", participantIds)
    : { data: [] };

  const phones = (participants ?? []).map((p) => p.phone).filter(Boolean) as string[];
  const { data: regs } = phones.length
    ? await supabase
        .from("event_registrations")
        .select("phone, name")
        .eq("event_id", eventId)
        .in("phone", phones)
    : { data: [] };

  const phoneToName = new Map((regs ?? []).map((r) => [r.phone, r.name]));
  const idToPhone = new Map((participants ?? []).map((p) => [p.id, p.phone]));
  const slotNameMap = new Map((slots ?? []).map((s) => [s.id, s.name]));

  const recentHistory = (recentRecords ?? []).map((r) => {
    const phone = idToPhone.get(r.participant_id) ?? "";
    return {
      id: r.id,
      participantName: phoneToName.get(phone) ?? phone ?? "참가자",
      slotName: slotNameMap.get(r.slot_id) ?? "스테이션",
      stampedAt: r.stamped_at,
      stampedBy: r.stamped_by,
    };
  });

  return (
    <StampScanner
      eventId={eventId}
      eventName={event.name}
      boardId={board.id}
      boardName={board.name}
      slots={(slots ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
        order: s.order,
        congestionStatus: s.congestion_status as "GREEN" | "YELLOW" | "RED",
        type: s.type,
        staffName: s.staff_name,
        locationHint: s.location_hint,
      }))}
      recentHistory={recentHistory}
    />
  );
}
