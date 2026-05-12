"use server";

// Supabase 자동 생성 타입에는 toritalk_* 가 아직 없어서 from()/update/insert 시
// `as never` 캐스트가 필요. 프로젝트 컨벤션과 동일.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-auth-guard";
import { requireAppUser } from "@/lib/user-auth-guard";

type Row = Record<string, unknown>;

async function tx() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

// ---------------------------------------------------------------------------
// 기관(Org) 측 액션
// ---------------------------------------------------------------------------

export async function setToritalkEnabledAction(
  orgId: string,
  enabled: boolean
): Promise<void> {
  const org = await requireOrg();
  if (org.orgId !== orgId) throw new Error("권한이 없습니다");

  const sb = await tx();
  const { error } = await sb
    .from("partner_orgs")
    .update({ toritalk_enabled: enabled } as Row)
    .eq("id", orgId);
  if (error) throw new Error(error.message);

  revalidatePath(`/org/${orgId}/toritalk`);
  revalidatePath(`/org/${orgId}`);
}

/**
 * 백필 — 기존 자녀 class_name 데이터로 방/멤버 일괄 생성·가입.
 * 토리톡 활성화 직후 한 번 호출하면 누락된 보호자들이 자동으로 들어옴.
 */
export async function backfillToritalkFromClassNamesAction(
  orgId: string
): Promise<{ roomsCreated: number; membersAdded: number }> {
  const org = await requireOrg();
  if (org.orgId !== orgId) throw new Error("권한이 없습니다");

  const sb = await tx();
  const { data, error } = await sb.rpc("toritalk_backfill_classnames", {
    p_org_id: orgId,
  });
  if (error) throw new Error(error.message);

  // RPC returns table — supabase 가 array 로 줌
  const row = Array.isArray(data) ? data[0] : data;
  const roomsCreated = Number(row?.rooms_created ?? 0);
  const membersAdded = Number(row?.members_added ?? 0);

  revalidatePath(`/org/${orgId}/toritalk`);
  return { roomsCreated, membersAdded };
}

export async function createRoomAction(formData: FormData): Promise<string> {
  const org = await requireOrg();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const maxMembersRaw = Number(formData.get("max_members") ?? 35);
  const maxMembers = Math.max(2, Math.min(200, maxMembersRaw || 35));

  if (!name) throw new Error("방 이름을 입력해 주세요");

  const sb = await tx();
  const { data, error } = await sb
    .from("toritalk_rooms")
    .insert({
      org_id: org.orgId,
      name,
      description,
      max_members: maxMembers,
    } as Row)
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "방 생성 실패");

  revalidatePath(`/org/${org.orgId}/toritalk`);
  return (data as { id: string }).id;
}

export async function updateRoomAction(
  roomId: string,
  formData: FormData
): Promise<void> {
  const org = await requireOrg();
  const sb = await tx();

  const { data: room } = await sb
    .from("toritalk_rooms")
    .select("org_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room || (room as { org_id: string }).org_id !== org.orgId)
    throw new Error("권한이 없습니다");

  const name = String(formData.get("name") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const maxMembersRaw = Number(formData.get("max_members") ?? 35);
  const maxMembers = Math.max(2, Math.min(200, maxMembersRaw || 35));
  // 정책 토글: form 에 없으면 기존값 유지 X, 명시적 false 로 들어옴 (체크박스 미체크 = 미전송).
  // checkbox 두 개 처리 — "1" 이면 true, 그 외(missing 포함) false.
  const isListed = String(formData.get("is_listed") ?? "") === "1";
  let allowSelfJoin = String(formData.get("allow_self_join") ?? "") === "1";
  // 노출 안 하는 방은 셀프 입장 의미 없음 → 강제 false
  if (!isListed) allowSelfJoin = false;

  if (!name) throw new Error("방 이름을 입력해 주세요");

  const { error } = await sb
    .from("toritalk_rooms")
    .update({
      name,
      description,
      max_members: maxMembers,
      is_listed: isListed,
      allow_self_join: allowSelfJoin,
    } as Row)
    .eq("id", roomId);
  if (error) throw new Error(error.message);

  revalidatePath(`/org/${org.orgId}/toritalk`);
  revalidatePath(`/org/${org.orgId}/toritalk/${roomId}`);
  // 참가자 측 디스커버 목록도 갱신
  revalidatePath(`/tori-talk`);
}

export async function archiveRoomAction(
  roomId: string,
  archived: boolean
): Promise<void> {
  const org = await requireOrg();
  const sb = await tx();

  const { data: room } = await sb
    .from("toritalk_rooms")
    .select("org_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room || (room as { org_id: string }).org_id !== org.orgId)
    throw new Error("권한이 없습니다");

  const { error } = await sb
    .from("toritalk_rooms")
    .update({ archived } as Row)
    .eq("id", roomId);
  if (error) throw new Error(error.message);

  revalidatePath(`/org/${org.orgId}/toritalk`);
}

export async function deleteRoomAction(roomId: string): Promise<void> {
  const org = await requireOrg();
  const sb = await tx();

  const { data: room } = await sb
    .from("toritalk_rooms")
    .select("org_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room || (room as { org_id: string }).org_id !== org.orgId)
    throw new Error("권한이 없습니다");

  const { error } = await sb.from("toritalk_rooms").delete().eq("id", roomId);
  if (error) throw new Error(error.message);

  revalidatePath(`/org/${org.orgId}/toritalk`);
}

export async function addRoomMembersAction(
  roomId: string,
  userIds: string[]
): Promise<{ added: number; skipped: number; overflowed: number }> {
  const org = await requireOrg();
  const sb = await tx();

  const { data: room } = await sb
    .from("toritalk_rooms")
    .select("org_id,max_members")
    .eq("id", roomId)
    .maybeSingle();
  if (!room || (room as { org_id: string }).org_id !== org.orgId)
    throw new Error("권한이 없습니다");

  const { count: currentCount } = await sb
    .from("toritalk_room_members")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId);

  const roomCap = (room as { max_members: number }).max_members;
  const slotsLeft = Math.max(0, roomCap - (currentCount ?? 0));

  const { data: existing } = await sb
    .from("toritalk_room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .in("user_id", userIds);
  const existingSet = new Set(
    ((existing ?? []) as { user_id: string }[]).map((e) => e.user_id)
  );
  const fresh = userIds.filter((id) => !existingSet.has(id));
  const skipped = userIds.length - fresh.length;

  const toAdd = fresh.slice(0, slotsLeft);
  const overflowed = fresh.length - toAdd.length;

  if (toAdd.length > 0) {
    const rows: Row[] = toAdd.map((user_id) => ({
      room_id: roomId,
      user_id,
      role: "MEMBER",
    }));
    const { error } = await sb.from("toritalk_room_members").insert(rows);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/org/${org.orgId}/toritalk/${roomId}`);
  return { added: toAdd.length, skipped, overflowed };
}

export async function removeRoomMemberAction(
  roomId: string,
  userId: string
): Promise<void> {
  const org = await requireOrg();
  const sb = await tx();

  const { data: room } = await sb
    .from("toritalk_rooms")
    .select("org_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room || (room as { org_id: string }).org_id !== org.orgId)
    throw new Error("권한이 없습니다");

  const { error } = await sb
    .from("toritalk_room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  revalidatePath(`/org/${org.orgId}/toritalk/${roomId}`);
}

// ---------------------------------------------------------------------------
// 참가자(App User) 측 액션
// ---------------------------------------------------------------------------

export async function sendMessageAction(
  roomId: string,
  content: string
): Promise<void> {
  const user = await requireAppUser();
  const text = (content ?? "").trim();
  if (!text) throw new Error("메시지를 입력해 주세요");
  if (text.length > 2000) throw new Error("메시지가 너무 길어요 (2000자 이하)");

  const sb = await tx();

  // 멤버십 검증
  const { data: member } = await sb
    .from("toritalk_room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) throw new Error("방 멤버가 아닙니다");

  const { error } = await sb.from("toritalk_messages").insert({
    room_id: roomId,
    sender_user_id: user.id,
    content: text,
  } as Row);
  if (error) throw new Error(error.message);

  // 방 updated_at 갱신 — room list 정렬용
  await sb
    .from("toritalk_rooms")
    .update({ updated_at: new Date().toISOString() } as Row)
    .eq("id", roomId);
}

/**
 * 기관 admin 이 보내는 시스템 메시지 — sender_org_id 로 표시됨.
 * 채팅뷰에서는 가운데 정렬·보라색 버블로 렌더링.
 */
export async function sendOrgMessageAction(
  roomId: string,
  content: string
): Promise<void> {
  const org = await requireOrg();
  const text = (content ?? "").trim();
  if (!text) throw new Error("메시지를 입력해 주세요");
  if (text.length > 2000)
    throw new Error("메시지가 너무 길어요 (2000자 이하)");

  const sb = await tx();

  // 같은 기관의 방인지 검증
  const { data: room } = await sb
    .from("toritalk_rooms")
    .select("org_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room || (room as { org_id: string }).org_id !== org.orgId)
    throw new Error("권한이 없습니다");

  const { error } = await sb.from("toritalk_messages").insert({
    room_id: roomId,
    sender_org_id: org.orgId,
    content: text,
  } as Row);
  if (error) throw new Error(error.message);

  await sb
    .from("toritalk_rooms")
    .update({ updated_at: new Date().toISOString() } as Row)
    .eq("id", roomId);

  revalidatePath(`/org/${org.orgId}/toritalk/${roomId}/chat`);
}

/**
 * 참가자가 공개·셀프입장 허용 방에 본인 의지로 입장.
 * 검증:
 *   - 방이 같은 기관 + archived=false + allow_self_join=true
 *   - 본인이 이미 멤버가 아님
 *   - 정원 미초과
 */
export async function joinRoomSelfAction(
  roomId: string
): Promise<{ ok: boolean; reason?: string }> {
  const user = await requireAppUser();
  const sb = await tx();

  const { data: room } = await sb
    .from("toritalk_rooms")
    .select("id,org_id,archived,allow_self_join,max_members")
    .eq("id", roomId)
    .maybeSingle();
  const r = room as
    | {
        id: string;
        org_id: string;
        archived: boolean;
        allow_self_join: boolean;
        max_members: number;
      }
    | null;
  if (!r) return { ok: false, reason: "방을 찾을 수 없어요" };
  if (r.org_id !== user.orgId) return { ok: false, reason: "권한이 없어요" };
  if (r.archived) return { ok: false, reason: "보관된 방이에요" };
  if (!r.allow_self_join)
    return { ok: false, reason: "이 방은 초대만 입장할 수 있어요" };

  // 이미 멤버?
  const { data: existing } = await sb
    .from("toritalk_room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return { ok: true };

  // 정원 체크
  const { count } = await sb
    .from("toritalk_room_members")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId);
  if ((count ?? 0) >= r.max_members)
    return { ok: false, reason: "방이 가득 찼어요" };

  const { error } = await sb.from("toritalk_room_members").insert({
    room_id: roomId,
    user_id: user.id,
    role: "MEMBER",
  } as Row);
  if (error) return { ok: false, reason: error.message };

  revalidatePath("/tori-talk");
  return { ok: true };
}

/**
 * 보호자 본인이 보낸 메시지 수정. content 만 변경, edited_at 갱신.
 * sender_user_id 가 자신과 일치하는 메시지만, 미삭제 상태에서만.
 */
export async function editMessageAction(
  messageId: string,
  newContent: string
): Promise<void> {
  const user = await requireAppUser();
  const text = (newContent ?? "").trim();
  if (!text) throw new Error("메시지를 입력해 주세요");
  if (text.length > 2000)
    throw new Error("메시지가 너무 길어요 (2000자 이하)");

  const sb = await tx();

  const { data: row } = await sb
    .from("toritalk_messages")
    .select("id,sender_user_id,deleted_at")
    .eq("id", messageId)
    .maybeSingle();
  const r = row as
    | {
        id: string;
        sender_user_id: string | null;
        deleted_at: string | null;
      }
    | null;
  if (!r) throw new Error("메시지를 찾을 수 없어요");
  if (r.deleted_at) throw new Error("삭제된 메시지는 수정할 수 없어요");
  if (r.sender_user_id !== user.id)
    throw new Error("본인이 보낸 메시지만 수정할 수 있어요");

  const { error } = await sb
    .from("toritalk_messages")
    .update({ content: text, edited_at: new Date().toISOString() } as Row)
    .eq("id", messageId);
  if (error) throw new Error(error.message);
}

/**
 * 보호자 본인이 보낸 메시지 소프트 삭제. deleted_at만 갱신, content는 비움.
 */
export async function deleteMessageAction(messageId: string): Promise<void> {
  const user = await requireAppUser();
  const sb = await tx();

  const { data: row } = await sb
    .from("toritalk_messages")
    .select("id,sender_user_id,deleted_at")
    .eq("id", messageId)
    .maybeSingle();
  const r = row as
    | {
        id: string;
        sender_user_id: string | null;
        deleted_at: string | null;
      }
    | null;
  if (!r) throw new Error("메시지를 찾을 수 없어요");
  if (r.deleted_at) return; // 이미 삭제됨
  if (r.sender_user_id !== user.id)
    throw new Error("본인이 보낸 메시지만 삭제할 수 있어요");

  const { error } = await sb
    .from("toritalk_messages")
    .update({
      content: "",
      deleted_at: new Date().toISOString(),
    } as Row)
    .eq("id", messageId);
  if (error) throw new Error(error.message);
}

/**
 * 기관 admin 이 자기 기관 명의로 보낸 공지 메시지 수정.
 */
export async function editOrgMessageAction(
  messageId: string,
  newContent: string
): Promise<void> {
  const org = await requireOrg();
  const text = (newContent ?? "").trim();
  if (!text) throw new Error("메시지를 입력해 주세요");
  if (text.length > 2000)
    throw new Error("메시지가 너무 길어요 (2000자 이하)");

  const sb = await tx();

  const { data: row } = await sb
    .from("toritalk_messages")
    .select("id,sender_org_id,deleted_at")
    .eq("id", messageId)
    .maybeSingle();
  const r = row as
    | {
        id: string;
        sender_org_id: string | null;
        deleted_at: string | null;
      }
    | null;
  if (!r) throw new Error("메시지를 찾을 수 없어요");
  if (r.deleted_at) throw new Error("삭제된 메시지는 수정할 수 없어요");
  if (r.sender_org_id !== org.orgId)
    throw new Error("우리 기관 공지만 수정할 수 있어요");

  const { error } = await sb
    .from("toritalk_messages")
    .update({ content: text, edited_at: new Date().toISOString() } as Row)
    .eq("id", messageId);
  if (error) throw new Error(error.message);
}

/**
 * 기관 admin 권한 — 같은 기관 방에서 발생한 메시지면 (누가 보냈든) 소프트 삭제.
 * 부적절한 글·도배 등을 운영 차원에서 정리할 때 사용.
 */
export async function adminDeleteAnyMessageAction(
  messageId: string
): Promise<void> {
  const org = await requireOrg();
  const sb = await tx();

  const { data: msg } = await sb
    .from("toritalk_messages")
    .select("id,room_id,deleted_at")
    .eq("id", messageId)
    .maybeSingle();
  const m = msg as
    | { id: string; room_id: string; deleted_at: string | null }
    | null;
  if (!m) throw new Error("메시지를 찾을 수 없어요");
  if (m.deleted_at) return;

  // 메시지가 우리 기관 방에 속하는지 확인
  const { data: room } = await sb
    .from("toritalk_rooms")
    .select("id,org_id")
    .eq("id", m.room_id)
    .maybeSingle();
  const r = room as { id: string; org_id: string } | null;
  if (!r || r.org_id !== org.orgId) {
    throw new Error("우리 기관 방의 메시지만 삭제할 수 있어요");
  }

  const { error } = await sb
    .from("toritalk_messages")
    .update({
      content: "",
      deleted_at: new Date().toISOString(),
    } as Row)
    .eq("id", messageId);
  if (error) throw new Error(error.message);
}

/**
 * 기관 admin 권한 — 방의 모든 메시지를 일괄 소프트 삭제.
 * 새 행사 시작 전·이전 차수 정리할 때 사용. 멤버십·방 자체는 유지.
 */
export async function adminClearRoomMessagesAction(
  roomId: string
): Promise<{ deletedCount: number }> {
  const org = await requireOrg();
  const sb = await tx();

  const { data: room } = await sb
    .from("toritalk_rooms")
    .select("id,org_id")
    .eq("id", roomId)
    .maybeSingle();
  const r = room as { id: string; org_id: string } | null;
  if (!r || r.org_id !== org.orgId) {
    throw new Error("우리 기관 방만 정리할 수 있어요");
  }

  // 삭제 대상 카운트 (미삭제 메시지만)
  const { count } = await sb
    .from("toritalk_messages")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .is("deleted_at", null);

  const { error } = await sb
    .from("toritalk_messages")
    .update({
      content: "",
      deleted_at: new Date().toISOString(),
    } as Row)
    .eq("room_id", roomId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  return { deletedCount: Number(count ?? 0) };
}

/**
 * 기관 admin 공지 메시지 소프트 삭제.
 */
export async function deleteOrgMessageAction(
  messageId: string
): Promise<void> {
  const org = await requireOrg();
  const sb = await tx();

  const { data: row } = await sb
    .from("toritalk_messages")
    .select("id,sender_org_id,deleted_at")
    .eq("id", messageId)
    .maybeSingle();
  const r = row as
    | {
        id: string;
        sender_org_id: string | null;
        deleted_at: string | null;
      }
    | null;
  if (!r) throw new Error("메시지를 찾을 수 없어요");
  if (r.deleted_at) return;
  if (r.sender_org_id !== org.orgId)
    throw new Error("우리 기관 공지만 삭제할 수 있어요");

  const { error } = await sb
    .from("toritalk_messages")
    .update({
      content: "",
      deleted_at: new Date().toISOString(),
    } as Row)
    .eq("id", messageId);
  if (error) throw new Error(error.message);
}

export async function markRoomReadAction(roomId: string): Promise<void> {
  const user = await requireAppUser();
  const sb = await tx();

  await sb
    .from("toritalk_room_members")
    .update({ last_read_at: new Date().toISOString() } as Row)
    .eq("room_id", roomId)
    .eq("user_id", user.id);
}

/**
 * 가족사진 미션 결과로부터 프로필 사진을 끌어오기 (수동 갱신용).
 */
export async function refreshProfilePhotoFromFamilyMissionAction(): Promise<{
  updated: boolean;
  url: string | null;
}> {
  const user = await requireAppUser();
  const sb = await tx();

  const { data: subs } = await sb
    .from("mission_submissions")
    .select("payload_json,org_mission_id,submitted_at")
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(20);

  type Sub = {
    payload_json: unknown;
    org_mission_id: string;
    submitted_at: string;
  };
  const subList = (subs ?? []) as Sub[];
  if (subList.length === 0) return { updated: false, url: null };

  const missionIds = Array.from(new Set(subList.map((s) => s.org_mission_id)));
  const { data: missions } = await sb
    .from("org_missions")
    .select("id,kind")
    .in("id", missionIds);
  const photoMissionSet = new Set(
    ((missions ?? []) as { id: string; kind: string }[])
      .filter((m) => m.kind === "PHOTO")
      .map((m) => m.id)
  );

  const found = subList.find((s) => {
    if (!photoMissionSet.has(s.org_mission_id)) return false;
    const p = s.payload_json as { photo_urls?: unknown } | null;
    return Array.isArray(p?.photo_urls) && p.photo_urls.length > 0;
  });
  if (!found) return { updated: false, url: null };

  const payload = found.payload_json as { photo_urls: unknown[] };
  const url = String(payload.photo_urls[0] ?? "");
  if (!url) return { updated: false, url: null };

  await sb
    .from("app_users")
    .update({ profile_photo_url: url } as Row)
    .eq("id", user.id);

  revalidatePath("/profile");
  revalidatePath("/tori-talk");
  return { updated: true, url };
}
