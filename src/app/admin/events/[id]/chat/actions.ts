"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOrManager } from "@/lib/auth-guard";

// 톡방 생성 (기관/관리자)
export async function createChatRoomAction(eventId: string, formData: FormData) {
  await requireAdminOrManager(eventId);
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "GROUP");

  if (!name) throw new Error("톡방 이름을 입력해주세요");

  await supabase.from("chat_rooms").insert({
    event_id: eventId,
    type,
    name,
  });

  revalidatePath(`/admin/events/${eventId}/chat`);
  revalidatePath(`/admin/chat`);
}

// 톡방 삭제 (전체방/공지방은 삭제 불가)
export async function deleteChatRoomAction(eventId: string, roomId: string) {
  await requireAdminOrManager(eventId);
  const supabase = await createClient();

  // 전체방, 공지방 보호
  const { data: room } = await supabase
    .from("chat_rooms")
    .select("name, type")
    .eq("id", roomId)
    .single();

  if (!room) throw new Error("톡방을 찾을 수 없습니다");
  if (room.name === "💬 전체 단톡방" || room.type === "ANNOUNCEMENT") {
    throw new Error("전체 단톡방과 공지방은 삭제할 수 없습니다");
  }

  await supabase.from("chat_rooms").delete().eq("id", roomId);

  revalidatePath(`/admin/events/${eventId}/chat`);
  revalidatePath(`/admin/chat`);
}

// 학급별 톡방 자동 생성 (등록명단에서 학급명 추출)
export async function createClassRoomsAction(eventId: string) {
  await requireAdminOrManager(eventId);
  const supabase = await createClient();

  // 등록명단에서 [학급명] 추출
  const { data: regs } = await supabase
    .from("event_registrations")
    .select("name")
    .eq("event_id", eventId);

  if (!regs || regs.length === 0) throw new Error("등록명단이 없습니다");

  const classNames = new Set<string>();
  for (const reg of regs) {
    const match = reg.name.match(/^\[(.+?)\]/);
    if (match) classNames.add(match[1]);
  }

  if (classNames.size === 0) throw new Error("학급 정보가 없습니다. 등록명단에 [학급명] 형식이 필요합니다");

  // 이미 존재하는 학급방 확인
  const { data: existingRooms } = await supabase
    .from("chat_rooms")
    .select("name")
    .eq("event_id", eventId)
    .eq("type", "GROUP");

  const existingNames = new Set((existingRooms ?? []).map((r) => r.name));

  const newRooms: { event_id: string; type: string; name: string }[] = [];
  for (const className of classNames) {
    const roomName = `💬 ${className}`;
    if (!existingNames.has(roomName)) {
      newRooms.push({ event_id: eventId, type: "GROUP", name: roomName });
    }
  }

  if (newRooms.length === 0) return { created: 0, message: "모든 학급방이 이미 존재합니다" };

  await supabase.from("chat_rooms").insert(newRooms);

  // 기존 멤버들을 해당 학급방에 자동 배정
  const { data: allRooms } = await supabase
    .from("chat_rooms")
    .select("id, name")
    .eq("event_id", eventId)
    .eq("type", "GROUP");

  for (const room of allRooms ?? []) {
    const match = room.name?.match(/^💬\s*(.+)$/);
    if (!match || match[1] === "전체 단톡방") continue;
    const targetClass = match[1];

    // 해당 학급 등록자 찾기
    const classRegs = regs.filter((r) => r.name.startsWith(`[${targetClass}]`));
    if (classRegs.length === 0) continue;

    // 등록자 전화번호 가져오기
    const { data: regPhones } = await supabase
      .from("event_registrations")
      .select("phone, name")
      .eq("event_id", eventId)
      .like("name", `[${targetClass}]%`);

    for (const reg of regPhones ?? []) {
      // 이미 participants에 있는 사람만 (입장한 사람)
      const { data: participant } = await supabase
        .from("participants")
        .select("id")
        .eq("event_id", eventId)
        .eq("phone", reg.phone)
        .maybeSingle();

      if (!participant) continue;

      // 이미 멤버인지 확인
      const { data: existing } = await supabase
        .from("chat_members")
        .select("id")
        .eq("room_id", room.id)
        .eq("participant_phone", reg.phone)
        .maybeSingle();

      if (!existing) {
        const displayName = reg.name.replace(/^\[.+?\]\s*/, "") + " 가족";
        await supabase.from("chat_members").insert({
          room_id: room.id,
          participant_name: displayName,
          participant_phone: reg.phone,
        });
      }
    }
  }

  revalidatePath(`/admin/events/${eventId}/chat`);
  revalidatePath(`/admin/chat`);
  return { created: newRooms.length, message: `${newRooms.length}개 학급방 생성 완료` };
}

// 팀 채팅방 생성 (팀 생성 시 호출)
export async function createTeamChatRoom(eventId: string, teamId: string, teamName: string) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("chat_rooms")
    .select("id")
    .eq("event_id", eventId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: room } = await supabase
    .from("chat_rooms")
    .insert({
      event_id: eventId,
      type: "TEAM",
      name: `🤝 ${teamName}`,
      team_id: teamId,
    })
    .select("id")
    .single();

  return room?.id ?? null;
}

// 공지 메시지 전송
export async function sendAnnouncementAction(eventId: string, roomId: string, content: string) {
  await requireAdminOrManager(eventId);
  const supabase = await createClient();

  if (!content.trim()) throw new Error("내용을 입력해주세요");

  await supabase.from("chat_messages").insert({
    room_id: roomId,
    sender_name: "시스템",
    type: "ANNOUNCEMENT",
    content: content.trim(),
  });

  revalidatePath(`/admin/events/${eventId}/chat`);
}
