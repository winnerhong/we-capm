// org_invitation_templates row — 클라이언트/서버 양쪽 import 가능.

export interface OrgInvitationTemplateRow {
  id: string;
  org_id: string;
  /** 셀렉터에 노출되는 템플릿 이름 (예: "봄 트레일 표준"). */
  label: string;
  /** 인사말 (짧은 한 줄) — 행사 invitation_message 자리에 채움. */
  message: string | null;
  /** 초대장 본문 (긴 multi-line) — 행사 invitation_body 자리에 채움. */
  body: string | null;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
