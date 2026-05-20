// partner_venues row 타입. 클라이언트/서버 양쪽 import 가능.

import type { ParkingLot } from "@/lib/partner-programs/types";

export interface PartnerVenueRow {
  id: string;
  partner_id: string;
  /** 장소 이름 — 행사 invitation_location 자리에 채움. */
  name: string;
  /** 도로명 주소 — invitation_address 로. */
  address: string | null;
  /** 장소 대표 이미지 — invitation_location_image_url 로. */
  image_url: string | null;
  /** 내부 메모 (선택). 행사에 노출되지 않음. */
  description: string | null;
  /** ParkingLot[] — program 의 parking_lots 와 동일 포맷. */
  parking_lots: ParkingLot[];
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
