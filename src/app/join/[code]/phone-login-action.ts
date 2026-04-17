"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { formatKorean } from "@/lib/phone";

export async function phoneLoginAction(joinCode: string, phoneDigits: string) {
  const supabase = await createClient();

  const phone = phoneDigits.startsWith("0") ? phoneDigits : `0${phoneDigits}`;
  const formatted = formatKorean(phone);

  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("join_code", joinCode)
    .single();

  if (!event) return { ok: false, message: "행사를 찾을 수 없습니다" };

  const { data: reg } = await supabase.rpc("check_phone_registration", {
    p_join_code: joinCode,
    p_phone: formatted,
  });

  const result = reg as unknown as { ok: boolean; name?: string; registrationId?: string; eventId?: string };

  let name = "참가자";

  if (result?.ok) {
    name = result.name ?? "참가자";
  } else {
    const { data: regByDigits } = await supabase
      .from("event_registrations")
      .select("id, name, phone")
      .eq("event_id", event.id)
      .like("phone", `%${phoneDigits.slice(-4)}`)
      .limit(1);

    if (regByDigits && regByDigits.length > 0) {
      name = regByDigits[0].name;
      await supabase
        .from("event_registrations")
        .update({ status: "ENTERED", entered_at: new Date().toISOString() })
        .eq("id", regByDigits[0].id);
    }
  }

  // participant 자동 생성
  const { data: existingP } = await supabase
    .from("participants")
    .select("id")
    .eq("event_id", event.id)
    .eq("phone", formatted)
    .maybeSingle();

  let participantId = existingP?.id;
  if (!participantId) {
    const { data: newP } = await supabase
      .from("participants")
      .insert({ event_id: event.id, phone: formatted, participation_type: "INDIVIDUAL" })
      .select("id")
      .single();
    participantId = newP?.id;
  }

  // 채팅방 자동 입장: 전체방 + 공지방 + 학급방
  const displayName = name === "참가자" ? formatted : `${name} 가족`;

  // 이 행사의 모든 채팅방 가져오기
  const { data: allRooms } = await supabase
    .from("chat_rooms")
    .select("id, name, type")
    .eq("event_id", event.id);

  // 등록명단에서 학급 정보 추출
  const { data: regData } = await supabase
    .from("event_registrations")
    .select("name")
    .eq("event_id", event.id)
    .eq("phone", formatted)
    .maybeSingle();

  const classMatch = regData?.name?.match(/^\[(.+?)\]/);
  const myClass = classMatch ? classMatch[1] : null;

  for (const room of allRooms ?? []) {
    let shouldJoin = false;

    if (room.type === "ANNOUNCEMENT") {
      shouldJoin = true; // 공지방은 전원 입장
    } else if (room.name === "💬 전체 단톡방") {
      shouldJoin = true; // 전체 단톡방 전원 입장
    } else if (myClass && room.name === `💬 ${myClass}`) {
      shouldJoin = true; // 내 학급방 입장
    }

    if (!shouldJoin) continue;

    const { data: existingMember } = await supabase
      .from("chat_members")
      .select("id")
      .eq("room_id", room.id)
      .eq("participant_phone", formatted)
      .maybeSingle();

    if (!existingMember) {
      await supabase.from("chat_members").insert({
        room_id: room.id,
        participant_name: displayName,
        participant_phone: formatted,
      });
    }
  }

  // 전체 단톡방에 입장 시스템 메시지
  const groupRoom = (allRooms ?? []).find((r) => r.name === "💬 전체 단톡방");
  if (groupRoom) {
    await supabase.from("chat_messages").insert({
      room_id: groupRoom.id,
      sender_name: "시스템",
      type: "SYSTEM",
      content: `${displayName}님이 입장했습니다`,
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(
    "campnic_participant",
    JSON.stringify({
      eventId: event.id,
      phone: formatted,
      name,
      participantId,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    }
  );

  return { ok: true, eventId: event.id, name };
}
