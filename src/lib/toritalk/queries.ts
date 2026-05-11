// server-only: @/lib/supabase/server 사용
//
// Supabase의 자동 생성 타입에는 toritalk_* 테이블이 아직 없어서
// `as never` + `as unknown as {...}` 패턴으로 우회 (프로젝트 컨벤션).
import { createClient } from "@/lib/supabase/server";
import type {
  ToritalkMessageRow,
  ToritalkMessageWithSender,
  ToritalkRoomMemberRow,
  ToritalkRoomRow,
  ToritalkRoomWithStats,
} from "./types";

type AnyTable = ReturnType<
  Awaited<ReturnType<typeof createClient>>["from"]
>;

/** 타입 우회: 새 테이블에 대한 untyped from() 헬퍼. */
async function fromTable(table: string): Promise<AnyTable> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase.from(table as never) as any;
}

/**
 * 기관에서 토리톡이 활성화되어 있는지 확인.
 * 마이그레이션 미실행/컬럼 누락 등 어떤 에러도 false 로 silent fail.
 */
export async function isToritalkEnabled(orgId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("partner_orgs")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("toritalk_enabled" as any)
      .eq("id", orgId)
      .maybeSingle();
    if (error) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Boolean((data as any)?.toritalk_enabled);
  } catch {
    return false;
  }
}

/**
 * 기관의 모든 방 로드 + 멤버 수 / 최근 메시지 미리보기 동봉.
 */
export async function loadOrgRoomsWithStats(
  orgId: string
): Promise<ToritalkRoomWithStats[]> {
  const roomsTable = await fromTable("toritalk_rooms");
  const { data: rooms } = await roomsTable
    .select("*")
    .eq("org_id", orgId)
    .order("archived", { ascending: true })
    .order("created_at", { ascending: false });

  const list = (rooms ?? []) as unknown as ToritalkRoomRow[];
  if (list.length === 0) return [];

  const ids = list.map((r) => r.id);

  const membersTable = await fromTable("toritalk_room_members");
  const { data: memberRows } = await membersTable
    .select("room_id")
    .in("room_id", ids);
  const memberCount = new Map<string, number>();
  for (const m of (memberRows ?? []) as unknown as { room_id: string }[]) {
    memberCount.set(m.room_id, (memberCount.get(m.room_id) ?? 0) + 1);
  }

  const msgTable = await fromTable("toritalk_messages");
  const { data: msgRows } = await msgTable
    .select("room_id,content,created_at")
    .in("room_id", ids)
    .order("created_at", { ascending: false })
    .limit(200);
  const lastMsg = new Map<
    string,
    { content: string; created_at: string }
  >();
  for (const m of (msgRows ?? []) as unknown as {
    room_id: string;
    content: string;
    created_at: string;
  }[]) {
    if (!lastMsg.has(m.room_id)) {
      lastMsg.set(m.room_id, { content: m.content, created_at: m.created_at });
    }
  }

  return list.map<ToritalkRoomWithStats>((r) => ({
    ...r,
    member_count: memberCount.get(r.id) ?? 0,
    last_message_at: lastMsg.get(r.id)?.created_at ?? null,
    last_message_preview: lastMsg.get(r.id)?.content ?? null,
  }));
}

/**
 * 특정 사용자가 속한 모든 방 (참가자 뷰).
 * 토리톡 테이블이 없거나 에러 시 빈 배열 반환 (silent fail).
 */
export async function loadRoomsForUser(
  userId: string
): Promise<ToritalkRoomWithStats[]> {
  try {
    return await loadRoomsForUserCore(userId);
  } catch {
    return [];
  }
}

async function loadRoomsForUserCore(
  userId: string
): Promise<ToritalkRoomWithStats[]> {
  const membersTable = await fromTable("toritalk_room_members");
  const { data: memberRows } = await membersTable
    .select("room_id,last_read_at")
    .eq("user_id", userId);

  const myMemberships = (memberRows ?? []) as unknown as {
    room_id: string;
    last_read_at: string;
  }[];
  if (myMemberships.length === 0) return [];

  const ids = myMemberships.map((r) => r.room_id);
  const roomsTable = await fromTable("toritalk_rooms");
  const { data: roomRows } = await roomsTable
    .select("*")
    .in("id", ids)
    .eq("archived", false)
    .order("updated_at", { ascending: false });

  const list = (roomRows ?? []) as unknown as ToritalkRoomRow[];
  if (list.length === 0) return [];

  // 멤버 수
  const { data: allMembers } = await membersTable
    .select("room_id")
    .in("room_id", ids);
  const mc = new Map<string, number>();
  for (const m of (allMembers ?? []) as unknown as { room_id: string }[]) {
    mc.set(m.room_id, (mc.get(m.room_id) ?? 0) + 1);
  }

  const msgTable = await fromTable("toritalk_messages");
  const { data: msgRows } = await msgTable
    .select("room_id,content,created_at")
    .in("room_id", ids)
    .order("created_at", { ascending: false })
    .limit(200);
  const lm = new Map<string, { content: string; created_at: string }>();
  for (const m of (msgRows ?? []) as unknown as {
    room_id: string;
    content: string;
    created_at: string;
  }[]) {
    if (!lm.has(m.room_id))
      lm.set(m.room_id, { content: m.content, created_at: m.created_at });
  }

  return list.map<ToritalkRoomWithStats>((r) => ({
    ...r,
    member_count: mc.get(r.id) ?? 0,
    last_message_at: lm.get(r.id)?.created_at ?? null,
    last_message_preview: lm.get(r.id)?.content ?? null,
  }));
}

/**
 * 사용자가 속하지 않은 방 중 노출 가능(is_listed=true) 한 것들.
 * "다른 방 둘러보기" 섹션용. 같은 org_id 의 archived=false 방만.
 * 토리톡 테이블이 없거나 에러 시 빈 배열 반환 (silent fail).
 */
export async function loadDiscoverableRoomsForUser(
  userId: string,
  orgId: string
): Promise<ToritalkRoomWithStats[]> {
  try {
    return await loadDiscoverableRoomsForUserCore(userId, orgId);
  } catch {
    return [];
  }
}

async function loadDiscoverableRoomsForUserCore(
  userId: string,
  orgId: string
): Promise<ToritalkRoomWithStats[]> {
  const membersTable = await fromTable("toritalk_room_members");
  const { data: myMemberships } = await membersTable
    .select("room_id")
    .eq("user_id", userId);
  const myRoomIds = new Set(
    ((myMemberships ?? []) as { room_id: string }[]).map((r) => r.room_id)
  );

  const roomsTable = await fromTable("toritalk_rooms");
  const { data: roomRows } = await roomsTable
    .select("*")
    .eq("org_id", orgId)
    .eq("archived", false)
    .eq("is_listed", true)
    .order("created_at", { ascending: false });

  const list = (
    ((roomRows ?? []) as unknown) as ToritalkRoomRow[]
  ).filter((r) => !myRoomIds.has(r.id));

  if (list.length === 0) return [];

  const ids = list.map((r) => r.id);

  // 멤버 수
  const { data: allMembers } = await membersTable
    .select("room_id")
    .in("room_id", ids);
  const mc = new Map<string, number>();
  for (const m of (allMembers ?? []) as unknown as { room_id: string }[]) {
    mc.set(m.room_id, (mc.get(m.room_id) ?? 0) + 1);
  }

  // 최근 메시지 미리보기
  const msgTable = await fromTable("toritalk_messages");
  const { data: msgRows } = await msgTable
    .select("room_id,content,created_at")
    .in("room_id", ids)
    .order("created_at", { ascending: false })
    .limit(200);
  const lm = new Map<string, { content: string; created_at: string }>();
  for (const m of (msgRows ?? []) as unknown as {
    room_id: string;
    content: string;
    created_at: string;
  }[]) {
    if (!lm.has(m.room_id))
      lm.set(m.room_id, { content: m.content, created_at: m.created_at });
  }

  return list.map<ToritalkRoomWithStats>((r) => ({
    ...r,
    member_count: mc.get(r.id) ?? 0,
    last_message_at: lm.get(r.id)?.created_at ?? null,
    last_message_preview: lm.get(r.id)?.content ?? null,
  }));
}

/**
 * 방 단건 로드.
 */
export async function loadRoom(
  roomId: string
): Promise<ToritalkRoomRow | null> {
  const roomsTable = await fromTable("toritalk_rooms");
  const { data } = await roomsTable
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  return (data as unknown as ToritalkRoomRow) ?? null;
}

/**
 * 보호자 ID 목록에 대해 첫 enrolled 자녀 이름을 가져옴.
 * 채팅 아바타·표시명 fallback 에 사용 (학부모_xxxx → 홍유빈 우선).
 */
async function loadEnrolledChildNameMap(
  userIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_children")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("user_id,name,is_enrolled,created_at" as any)
    .in("user_id", userIds);

  type Row = {
    user_id: string;
    name: string;
    is_enrolled: boolean;
    created_at: string;
  };
  const rows = ((data ?? []) as unknown) as Row[];

  // user_id 별 정렬: enrolled 우선, 그 다음 created_at 오름차순
  const grouped = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = grouped.get(r.user_id) ?? [];
    arr.push(r);
    grouped.set(r.user_id, arr);
  }
  for (const [uid, arr] of grouped.entries()) {
    arr.sort((a, b) => {
      if (a.is_enrolled !== b.is_enrolled) return a.is_enrolled ? -1 : 1;
      return (a.created_at ?? "").localeCompare(b.created_at ?? "");
    });
    const first = arr.find((c) => c.name?.trim());
    if (first) map.set(uid, first.name.trim());
  }
  return map;
}

/**
 * 방 멤버 목록 (app_users 프로필 photo·이름 + 원생 첫 이름 join).
 */
export async function loadRoomMembersWithProfile(roomId: string): Promise<
  Array<
    ToritalkRoomMemberRow & {
      parent_name: string;
      profile_photo_url: string | null;
      enrolled_child_name: string | null;
    }
  >
> {
  const membersTable = await fromTable("toritalk_room_members");
  const { data: members } = await membersTable
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });

  const list = (members ?? []) as unknown as ToritalkRoomMemberRow[];
  if (list.length === 0) return [];

  const userIds = list.map((m) => m.user_id);
  const [profileResp, childNameMap] = await Promise.all([
    (async () => {
      const supabase = await createClient();
      const { data } = await supabase
        .from("app_users")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select("id,parent_name,profile_photo_url" as any)
        .in("id", userIds);
      return data ?? [];
    })(),
    loadEnrolledChildNameMap(userIds),
  ]);

  const map = new Map<
    string,
    { parent_name: string; profile_photo_url: string | null }
  >();
  for (const u of profileResp as unknown as {
    id: string;
    parent_name: string;
    profile_photo_url: string | null;
  }[]) {
    map.set(u.id, {
      parent_name: u.parent_name,
      profile_photo_url: u.profile_photo_url,
    });
  }

  return list.map((m) => ({
    ...m,
    parent_name: map.get(m.user_id)?.parent_name ?? "(알 수 없음)",
    profile_photo_url: map.get(m.user_id)?.profile_photo_url ?? null,
    enrolled_child_name: childNameMap.get(m.user_id) ?? null,
  }));
}

/**
 * 방 멤버십 확인.
 */
export async function isRoomMember(
  roomId: string,
  userId: string
): Promise<boolean> {
  const membersTable = await fromTable("toritalk_room_members");
  const { data } = await membersTable
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * 메시지 최근 N건 (오름차순 반환). user / org admin 발신 모두 처리.
 */
export async function loadRoomMessages(
  roomId: string,
  limit = 100
): Promise<ToritalkMessageWithSender[]> {
  const msgTable = await fromTable("toritalk_messages");
  const { data: msgs } = await msgTable
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const list = (msgs ?? []) as unknown as ToritalkMessageRow[];
  if (list.length === 0) return [];

  const senderIds = Array.from(
    new Set(list.map((m) => m.sender_user_id).filter(Boolean) as string[])
  );
  const senderOrgIds = Array.from(
    new Set(list.map((m) => m.sender_org_id).filter(Boolean) as string[])
  );

  const senderMap = new Map<
    string,
    { parent_name: string; profile_photo_url: string | null }
  >();
  let childNameMap: Map<string, string> = new Map();
  const orgNameMap = new Map<string, string>();

  const supabase = await createClient();

  if (senderIds.length > 0) {
    const [usersResp, childMapResp] = await Promise.all([
      supabase
        .from("app_users")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select("id,parent_name,profile_photo_url" as any)
        .in("id", senderIds),
      loadEnrolledChildNameMap(senderIds),
    ]);
    for (const u of (usersResp.data ?? []) as unknown as {
      id: string;
      parent_name: string;
      profile_photo_url: string | null;
    }[]) {
      senderMap.set(u.id, {
        parent_name: u.parent_name,
        profile_photo_url: u.profile_photo_url,
      });
    }
    childNameMap = childMapResp;
  }

  if (senderOrgIds.length > 0) {
    const { data: orgs } = await supabase
      .from("partner_orgs")
      .select("id,org_name")
      .in("id", senderOrgIds);
    for (const o of (orgs ?? []) as { id: string; org_name: string }[]) {
      orgNameMap.set(o.id, o.org_name);
    }
  }

  return list
    .slice()
    .reverse()
    .map<ToritalkMessageWithSender>((m) => {
      const senderInfo = m.sender_user_id
        ? senderMap.get(m.sender_user_id)
        : null;
      const childName = m.sender_user_id
        ? childNameMap.get(m.sender_user_id) ?? null
        : null;
      const orgName = m.sender_org_id
        ? orgNameMap.get(m.sender_org_id) ?? null
        : null;
      // 아바타 글자: 원생 → 보호자 → 기관명 첫 글자
      const letter =
        childName?.charAt(0) ||
        senderInfo?.parent_name?.trim().charAt(0) ||
        orgName?.trim().charAt(0) ||
        null;
      return {
        ...m,
        sender_name: senderInfo?.parent_name ?? null,
        sender_photo_url: senderInfo?.profile_photo_url ?? null,
        sender_child_name: childName,
        sender_display_letter: letter,
        sender_org_name: orgName,
      };
    });
}

/**
 * 기관의 모든 app_users 로드 (방 멤버 추가 후보) + 원생 첫 이름.
 */
export async function loadOrgAppUsers(orgId: string): Promise<
  Array<{
    id: string;
    parent_name: string;
    phone: string;
    profile_photo_url: string | null;
    enrolled_child_name: string | null;
  }>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_users")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("id,parent_name,phone,profile_photo_url" as any)
    .eq("org_id", orgId)
    .eq("status", "ACTIVE")
    .order("parent_name", { ascending: true });

  const users = ((data ?? []) as unknown) as Array<{
    id: string;
    parent_name: string;
    phone: string;
    profile_photo_url: string | null;
  }>;

  const childNameMap = await loadEnrolledChildNameMap(users.map((u) => u.id));

  return users.map((u) => ({
    ...u,
    enrolled_child_name: childNameMap.get(u.id) ?? null,
  }));
}
