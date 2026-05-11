export type ToritalkRoomRow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  max_members: number;
  archived: boolean;
  /** 비멤버에게 "다른 방 둘러보기" 목록에 노출할지. */
  is_listed: boolean;
  /** 비멤버 셀프 입장 허용. false면 admin 초대만. */
  allow_self_join: boolean;
  created_at: string;
  updated_at: string;
};

export type ToritalkRoomMemberRow = {
  id: string;
  room_id: string;
  user_id: string;
  role: "MEMBER" | "ADMIN";
  joined_at: string;
  last_read_at: string;
};

export type ToritalkMessageRow = {
  id: string;
  room_id: string;
  /** 일반 보호자가 보낸 경우. sender_org_id 와 동시 not-null 불가 (DB CHECK). */
  sender_user_id: string | null;
  /** 기관 admin 이 보낸 경우. */
  sender_org_id: string | null;
  content: string;
  created_at: string;
  /** 마지막 수정 시각. NULL=원본. */
  edited_at: string | null;
  /** 소프트 삭제 시각. NOT NULL이면 클라이언트에서 "삭제된 메시지" 처리. */
  deleted_at: string | null;
};

export type ToritalkRoomWithStats = ToritalkRoomRow & {
  member_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
};

export type ToritalkMessageWithSender = ToritalkMessageRow & {
  sender_name: string | null;
  sender_photo_url: string | null;
  /** 원생(is_enrolled=true) 첫 아이 이름 — 표시·아바타 글자에 우선 사용. */
  sender_child_name: string | null;
  /** 아바타 fallback 글자 — 원생 첫 글자 우선, 없으면 parent 첫 글자. */
  sender_display_letter: string | null;
  /** 기관 admin 메시지인 경우 기관 이름. (sender_org_id 가 있을 때 채워짐) */
  sender_org_name: string | null;
};
