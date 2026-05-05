// 프로그램의 주차장/집결장소 JSON 직렬화 ↔ 검증 유틸.
// 파트너/기관 양쪽 액션이 공유.

import type { ParkingLot, MeetingPoint } from "@/lib/partner-programs/types";

const MAX_LOTS = 10;

function strSlice(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max).trim();
}

/**
 * FormData 의 "parking_lots" 값(JSON 문자열) 을 ParkingLot[] 로 파싱·검증.
 * 잘못된 입력은 빈 배열, 부분 손상은 valid 항목만 추려 반환.
 */
export function parseParkingLots(raw: FormDataEntryValue | null): ParkingLot[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    const valid: ParkingLot[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const name = strSlice(o.name, 50);
      const address = strSlice(o.address, 200);
      // 이름·주소 둘 중 하나라도 비면 skip — 사용자가 빈 카드 제출 시 무시
      if (!name || !address) continue;
      const lot: ParkingLot = { name, address };
      if (
        typeof o.capacity === "number" &&
        Number.isFinite(o.capacity) &&
        o.capacity >= 0 &&
        o.capacity <= 9999
      ) {
        lot.capacity = Math.floor(o.capacity);
      }
      const fee = strSlice(o.fee, 50);
      if (fee) lot.fee = fee;
      const note = strSlice(o.note, 200);
      if (note) lot.note = note;
      const imageUrl = strSlice(o.image_url, 500);
      if (imageUrl) lot.image_url = imageUrl;
      valid.push(lot);
      if (valid.length >= MAX_LOTS) break;
    }
    return valid;
  } catch {
    return [];
  }
}

/**
 * FormData 의 "meeting_point" 값(JSON 문자열) 을 MeetingPoint | null 로 파싱.
 * 이름·주소가 모두 비면 NULL 반환 (= 미설정).
 */
export function parseMeetingPoint(
  raw: FormDataEntryValue | null
): MeetingPoint | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    const name = strSlice(o.name, 80);
    const address = strSlice(o.address, 200);
    if (!name && !address) return null;
    const point: MeetingPoint = { name, address };
    const time = strSlice(o.time, 50);
    if (time) point.time = time;
    const note = strSlice(o.note, 200);
    if (note) point.note = note;
    const imageUrl = strSlice(o.image_url, 500);
    if (imageUrl) point.image_url = imageUrl;
    return point;
  } catch {
    return null;
  }
}
