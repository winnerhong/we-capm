// NOTE: Supabase Storage bucket `stamp-photos` should be created manually in the dashboard.
// For now, uploads use the existing `chat-files` bucket with path `stamps/{slotId}/{participantId}/...`.
"use server";

import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { revalidatePath } from "next/cache";

const BUCKET = "chat-files";

export async function uploadStampPhotoAction(
  eventId: string,
  slotId: string,
  formData: FormData
) {
  const p = await getParticipant(eventId);
  if (!p) throw new Error("로그인 필요");

  const supabase = await createClient();

  // 참가자 확인
  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("event_id", eventId)
    .eq("phone", p.phone)
    .maybeSingle();
  if (!participant) throw new Error("참가자 없음");

  const file = formData.get("photo") as File | null;
  const caption = String(formData.get("caption") ?? "").trim();
  if (!file || file.size === 0) throw new Error("사진 필요");

  const ext = (file.type?.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const path = `stamps/${slotId}/${participant.id}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (upErr) {
    // bucket이 없는 경우에 대한 안내 메시지
    if (upErr.message?.includes("Bucket not found")) {
      throw new Error("사진 저장소가 준비되지 않았어요. 관리자에게 문의해주세요.");
    }
    throw new Error(upErr.message);
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // stamp_albums 는 database.types에 포함되어 있어요.
  const { error: insErr } = await supabase.from("stamp_albums").insert({
    slot_id: slotId,
    participant_id: participant.id,
    photo_url: urlData.publicUrl,
    caption: caption || null,
  });
  if (insErr) throw new Error(insErr.message);

  revalidatePath(`/event/${eventId}/stamps`);
  revalidatePath(`/event/${eventId}/album`);
}

export async function deleteStampPhotoAction(eventId: string, albumId: string) {
  const p = await getParticipant(eventId);
  if (!p) throw new Error("로그인 필요");

  const supabase = await createClient();

  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("event_id", eventId)
    .eq("phone", p.phone)
    .maybeSingle();
  if (!participant) throw new Error("참가자 없음");

  // 본인 사진만 삭제 가능
  const { data: album } = await supabase
    .from("stamp_albums")
    .select("id, participant_id, photo_url")
    .eq("id", albumId)
    .maybeSingle();

  if (!album) throw new Error("사진을 찾을 수 없어요");
  if (album.participant_id !== participant.id) {
    throw new Error("본인이 올린 사진만 삭제할 수 있어요");
  }

  // storage에서도 파일 제거 (URL에서 path 추출)
  try {
    const url = album.photo_url;
    const marker = `/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      const path = url.substring(idx + marker.length).split("?")[0];
      if (path) {
        await supabase.storage.from(BUCKET).remove([path]);
      }
    }
  } catch {
    // storage 삭제 실패는 무시 (DB 기록만 지우면 UI에서 사라짐)
  }

  const { error: delErr } = await supabase
    .from("stamp_albums")
    .delete()
    .eq("id", albumId);
  if (delErr) throw new Error(delErr.message);

  revalidatePath(`/event/${eventId}/stamps`);
  revalidatePath(`/event/${eventId}/album`);
}
