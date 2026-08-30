// 행사 편집 폼이 받는 초기값 만들기.
//
// 같은 폼을 두 화면이 쓴다 — /edit(기본 정보)과 행사 화면의 ② 초대장. 초기값
// 매핑이 30줄쯤 되는데 양쪽에 복사해 두면 컬럼이 하나 늘 때 한쪽만 고치게 된다.
// 그러면 "초대장 화면에서 저장했더니 새 필드가 비워지는" 종류의 버그가 난다.

import type { OrgEventRow } from "@/lib/org-events/types";

export type EditFormInitial = {
  name: string;
  description: string;
  starts_at: string | null;
  ends_at: string | null;
  cover_image_url: string;
  status: OrgEventRow["status"];
  allow_self_register: boolean;
  invitation_message: string;
  invitation_body: string;
  invitation_location: string;
  invitation_address: string;
  invitation_location_image_url: string;
  invitation_dress_code: string;
  invitation_entry_lead_min: string;
  invitation_parkings: NonNullable<OrgEventRow["invitation_parkings"]>;
  invitation_host: string;
  invitation_organizer: string;
};

export function buildEditFormInitial(event: OrgEventRow): EditFormInitial {
  return {
    name: event.name ?? "",
    description: event.description ?? "",
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    cover_image_url: event.cover_image_url ?? "",
    status: event.status,
    // allow_self_register 는 backend migration 후 추가된 컬럼 — 타입에는
    // 아직 없을 수 있으므로 안전하게 캐스팅.
    allow_self_register:
      (event as unknown as { allow_self_register?: boolean })
        .allow_self_register ?? false,
    invitation_message: event.invitation_message ?? "",
    invitation_body: event.invitation_body ?? "",
    invitation_location: event.invitation_location ?? "",
    invitation_address: event.invitation_address ?? "",
    invitation_location_image_url: event.invitation_location_image_url ?? "",
    invitation_dress_code: event.invitation_dress_code ?? "",
    // null 이면 빈 문자열 = 입장 안내 숨김. 컬럼 미적용(undefined) 이면
    // 기본 20 을 채워 지금과 같은 화면을 유지한다.
    invitation_entry_lead_min:
      event.invitation_entry_lead_min === undefined
        ? "20"
        : event.invitation_entry_lead_min == null
          ? ""
          : String(event.invitation_entry_lead_min),
    invitation_parkings: event.invitation_parkings ?? [],
    invitation_host: event.invitation_host ?? "",
    invitation_organizer: event.invitation_organizer ?? "",
  };
}
