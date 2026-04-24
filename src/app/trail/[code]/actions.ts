"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MissionType, TrailStopRow, TrailCompletionRow } from "@/lib/trails/types";

// ─────────────────────────────────────────────────────────────────────────
// 해버사인 거리 계산 (미터)
// ─────────────────────────────────────────────────────────────────────────
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalize(s: string) {
  return s.replace(/\s+/g, "").trim().toLowerCase();
}

function toStr(v: FormDataEntryValue | null): string {
  return v === null ? "" : String(v).trim();
}

function toNum(v: FormDataEntryValue | null): number | null {
  const s = toStr(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────────────────────────────────────────────────────
// 미션 제출
// ─────────────────────────────────────────────────────────────────────────
export async function submitStopMissionAction(qrCode: string, formData: FormData) {
  const supabase = await createClient();

  // 1) qr_code로 지점 + 숲길 조회
  const stopSel = supabase.from("partner_trail_stops" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: TrailStopRow | null }>;
      };
    };
  };
  const { data: stop } = await stopSel
    .select(
      "id, trail_id, order, name, mission_type, mission_config, reward_points, lat, lng, photo_url, qr_code"
    )
    .eq("qr_code", qrCode)
    .maybeSingle();

  if (!stop) throw new Error("지점을 찾을 수 없어요");

  // 2) 미션 검증
  const missionType = stop.mission_type as MissionType;
  const config = (stop.mission_config ?? {}) as Record<string, unknown>;

  if (missionType === "PHOTO") {
    const photoUrl = toStr(formData.get("photo_url"));
    if (!photoUrl) throw new Error("사진을 업로드해 주세요");
  } else if (missionType === "QUIZ") {
    const answer = toStr(formData.get("answer"));
    const expected = typeof config.answer === "string" ? config.answer : "";
    if (!answer) throw new Error("정답을 입력해 주세요");
    if (normalize(answer) !== normalize(expected)) {
      throw new Error("정답이 아니에요. 힌트를 다시 확인해 주세요!");
    }
  } else if (missionType === "LOCATION") {
    const lat = toNum(formData.get("lat"));
    const lng = toNum(formData.get("lng"));
    if (lat === null || lng === null) throw new Error("위치 정보를 확인해 주세요");
    if (stop.lat === null || stop.lng === null) {
      throw new Error("이 지점에 좌표가 등록되어 있지 않아요");
    }
    const radius =
      typeof config.radiusMeters === "number" && config.radiusMeters > 0
        ? config.radiusMeters
        : 50;
    const dist = haversineMeters(lat, lng, stop.lat, stop.lng);
    if (dist > radius) {
      throw new Error(
        `지점에서 ${Math.round(dist)}m 떨어져 있어요. ${radius}m 안으로 이동해 주세요.`
      );
    }
  }
  // CHECKIN은 자동 통과

  // 3) 참여자 정보 (선택)
  const participantName = toStr(formData.get("participant_name")) || null;
  const participantPhone = toStr(formData.get("participant_phone")) || null;

  // 4) 완주 기록 upsert — phone + trail_id로 unique
  const compSel = supabase.from("partner_trail_completions" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: TrailCompletionRow | null }>;
        };
      };
    };
  };

  let existing: TrailCompletionRow | null = null;
  if (participantPhone) {
    const { data } = await compSel
      .select(
        "id, trail_id, event_id, participant_phone, participant_name, stops_cleared, total_score, started_at, completed_at, certificate_url"
      )
      .eq("trail_id", stop.trail_id)
      .eq("participant_phone", participantPhone)
      .maybeSingle();
    existing = data;
  }

  // 총 지점 수 조회 (완주 판정용)
  const totalSel = supabase.from("partner_trail_stops" as never) as unknown as {
    select: (c: string, opts: { count: "exact"; head: true }) => {
      eq: (k: string, v: string) => {
        eq: (
          k: string,
          v: boolean
        ) => Promise<{ count: number | null }>;
      };
    };
  };
  const { count: totalStops } = await totalSel
    .select("id", { count: "exact", head: true })
    .eq("trail_id", stop.trail_id)
    .eq("is_active", true);

  const reward = stop.reward_points ?? 0;

  if (existing) {
    // 이미 기록 있음 → 업데이트
    const cleared = new Set(existing.stops_cleared ?? []);
    const alreadyCleared = cleared.has(qrCode);
    cleared.add(qrCode);
    const newClearedArr = Array.from(cleared);
    const newScore = alreadyCleared
      ? existing.total_score
      : (existing.total_score ?? 0) + reward;
    const isComplete =
      !existing.completed_at &&
      totalStops !== null &&
      newClearedArr.length >= totalStops;

    const updater = supabase.from("partner_trail_completions" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await updater
      .update({
        stops_cleared: newClearedArr,
        total_score: newScore,
        participant_name: participantName ?? existing.participant_name,
        completed_at: isComplete ? new Date().toISOString() : existing.completed_at,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`기록 저장 실패: ${error.message}`);
  } else {
    // 새 기록
    const inserter = supabase.from("partner_trail_completions" as never) as unknown as {
      insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await inserter.insert({
      trail_id: stop.trail_id,
      participant_phone: participantPhone,
      participant_name: participantName,
      stops_cleared: [qrCode],
      total_score: reward,
      started_at: new Date().toISOString(),
      completed_at:
        totalStops !== null && 1 >= totalStops ? new Date().toISOString() : null,
    });
    if (error) throw new Error(`기록 저장 실패: ${error.message}`);
  }

  redirect(`/trail/${qrCode}/done?score=${reward}`);
}
