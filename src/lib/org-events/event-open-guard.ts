// server-only: "지금 이 행사에 뭔가를 남길 수 있나" — 서버 액션의 관문.
//
// 화면에서 버튼을 지우는 것만으로는 부족하다. 행사장에서 폰을 켜 둔 채로
// 기관이 종료를 누르면, 그 탭에는 여전히 [제출] 버튼이 남아 있고 눌린다.
// 화면과 서버가 같은 함수(resolveEventAccess)로 판단해야 어긋나지 않는다.
//
// 행사에 묶이지 않은 스탬프북(기관 상시 미션)은 여기서 막지 않는다 —
// 닫을 행사가 없으면 닫을 근거도 없다.

import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { eventIdForQuestPack } from "@/lib/app-user/acorn-ledger";
import { loadOrgEventById } from "./queries";
import { resolveEventAccess } from "./event-access";
import { loadOrgFeatureFlags, canUse } from "@/lib/features/org-switches";

export type OpenGuard = { ok: true } | { ok: false; error: string };

const OK: OpenGuard = { ok: true };

/**
 * 행사 id 로 검사. 같은 요청에서 여러 번 불려도 조회는 한 번이다
 * (제출 한 번에 미션·팩·행사를 각자 읽는 경로가 여럿이다).
 */
export const assertEventOpen = cache(async function assertEventOpen(
  eventId: string | null | undefined,
  /**
   * 이 동작이 속한 기능. 주최 기관이 껐으면 열린 행사여도 막는다.
   *
   * 화면에서 버튼을 지우는 것으로는 부족한 이유가 여기서도 똑같다 —
   * 행사 중에 지사가 기능을 끄면, 참가자 폰에 열려 있던 탭에는 버튼이 남아 있다.
   */
  feature?: string
): Promise<OpenGuard> {
  if (!eventId) return OK;
  const event = await loadOrgEventById(eventId).catch(() => null);
  if (!event) return OK;

  // 기능 검사가 먼저다. "끝난 행사예요" 보다 "여기서는 안 쓰는 기능이에요" 가
  // 정확한 사실이고, 행사가 끝났는지는 그 다음 문제다.
  if (feature) {
    const flags = await loadOrgFeatureFlags(event.org_id);
    if (!canUse(flags, feature)) {
      return { ok: false, error: "이 행사에서는 사용하지 않는 기능이에요" };
    }
  }

  const access = resolveEventAccess({
    status: event.status,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
  });
  if (access.canPlay) return OK;

  return {
    ok: false,
    error:
      access.phase === "upcoming"
        ? "아직 시작하지 않은 행사예요"
        : "끝난 행사예요. 더 이상 참여할 수 없어요",
  };
});

/** 스탬프북 id 로 검사 — 미션 액션은 행사 id 를 들고 있지 않다. */
export async function assertEventOpenForPack(
  questPackId: string | null | undefined,
  feature?: string
): Promise<OpenGuard> {
  if (!questPackId) return OK;
  const supabase = await createClient();
  const eventId = await eventIdForQuestPack(supabase, questPackId);
  return assertEventOpen(eventId, feature);
}

/**
 * 기능만 본다 — 행사가 열려 있는지는 따지지 않는다.
 *
 * assertEventOpen 과 나눠 둔 이유: 설문처럼 **행사가 끝난 뒤에** 하는 것이 있다.
 * 거기에 openness 검사를 끼워 넣으면 멀쩡하던 흐름이 막힌다.
 */
export const assertOrgFeature = cache(async function assertOrgFeature(
  orgId: string | null | undefined,
  code: string
): Promise<OpenGuard> {
  if (!orgId) return OK;
  const flags = await loadOrgFeatureFlags(orgId);
  if (canUse(flags, code)) return OK;
  return { ok: false, error: "이 행사에서는 사용하지 않는 기능이에요" };
});

/** 행사 id 로 기능만 검사. 행사 → 기관을 거친다(조회는 요청당 한 번). */
export const assertEventFeature = cache(async function assertEventFeature(
  eventId: string | null | undefined,
  code: string
): Promise<OpenGuard> {
  if (!eventId) return OK;
  const event = await loadOrgEventById(eventId).catch(() => null);
  if (!event) return OK;
  return assertOrgFeature(event.org_id, code);
});
