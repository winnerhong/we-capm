"use server";

// 지난 행사에서 스탬프북 가져오기.
//
// 무엇을 복사하는가: 스탬프북 한 권 + 그 안의 미션 전부.
// 무엇을 복사하지 않는가: 참가자 제출물·도토리·좋아요. 지난 행사의 기록이지
// 이번 행사의 것이 아니다.
//
// 복제 규칙(잠금 연결 옮기기·QR 새로 뽑기)은 quest-pack-copy-core 에 있고 테스트로
// 고정돼 있다. 여기서는 읽고 → 계획 세우고 → 넣고 → 행사에 연결하는 일만 한다.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  copiedPackName,
  planQuestPackCopy,
  type CopyMissionInput,
} from "./quest-pack-copy-core";

type Row = Record<string, unknown>;
type SbErr = { message?: string; code?: string } | null;
type SbResp<T> = { data: T[] | null; error: SbErr };

export type CopyQuestPackResult =
  | {
      ok: true;
      newPackId: string;
      missionCount: number;
      /** 잠금을 풀 수밖에 없었던 미션 — 화면에서 확인하라고 알린다. */
      unlockedTitles: string[];
      /** QR 을 새로 뽑은 미션 — 예전에 인쇄한 QR 은 못 쓴다. */
      reissuedQrTitles: string[];
    }
  | { ok: false; error: string };

/**
 * 스탬프북을 통째로 복제해 이 행사에 연결한다.
 *
 * 원본은 건드리지 않는다 — 지난 행사 화면이 그대로 남아야 "작년에 뭐 했더라" 를
 * 볼 수 있다.
 */
export async function copyQuestPackToEventAction(
  sourcePackId: string,
  targetEventId: string
): Promise<CopyQuestPackResult> {
  try {
    const org = await requireOrg();
    if (!sourcePackId || !targetEventId) {
      return { ok: false, error: "스탬프북을 찾을 수 없어요" };
    }

    const supabase = await createClient();

    // 1) 원본 스탬프북 — 우리 기관 것인지까지 함께 본다.
    const packResp = (await (
      supabase.from("org_quest_packs" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            eq: (
              k: string,
              v: string
            ) => { maybeSingle: () => Promise<{ data: PackRow | null }> };
          };
        };
      }
    )
      .select(
        "id, org_id, name, description, trail_id, cover_image_url, layout_mode, stamp_icon_set, completion_animation, tier_config"
      )
      .eq("id", sourcePackId)
      .eq("org_id", org.orgId)
      .maybeSingle()) as { data: PackRow | null };

    const source = packResp.data;
    if (!source) {
      return { ok: false, error: "다른 기관의 스탬프북은 가져올 수 없어요" };
    }

    // 2) 원본 미션들
    const missionResp = (await (
      supabase.from("org_missions" as never) as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: string
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<SbResp<CopyMissionInput>>;
          };
        };
      }
    )
      .select(
        "id, kind, title, description, icon, acorns, config_json, display_order, unlock_rule, unlock_threshold, unlock_previous_id, approval_mode, geofence_lat, geofence_lng, geofence_radius_m"
      )
      .eq("quest_pack_id", sourcePackId)
      .order("display_order", { ascending: true })) as SbResp<CopyMissionInput>;

    const missions = missionResp.data ?? [];

    // 3) 새 스탬프북 — 처음엔 DRAFT. 확인하고 켜야 한다.
    const newPackId = crypto.randomUUID();
    const packRow: Row = {
      id: newPackId,
      org_id: org.orgId,
      name: copiedPackName(source.name),
      description: source.description,
      trail_id: source.trail_id,
      cover_image_url: source.cover_image_url,
      layout_mode: source.layout_mode,
      stamp_icon_set: source.stamp_icon_set,
      completion_animation: source.completion_animation,
      tier_config: source.tier_config ?? {},
      status: "DRAFT",
    };

    const packIns = (await (
      supabase.from("org_quest_packs" as never) as unknown as {
        insert: (r: Row) => Promise<{ error: SbErr }>;
      }
    ).insert(packRow)) as { error: SbErr };

    if (packIns.error) {
      console.error("[quest-pack-copy] pack insert", packIns.error);
      return { ok: false, error: "스탬프북 복사에 실패했어요" };
    }

    // 4) 미션 복제 — 잠금 연결·QR 은 core 가 정리한다.
    const plan = planQuestPackCopy({
      missions,
      newIdFor: () => crypto.randomUUID(),
      newQrToken: () => crypto.randomUUID().replace(/-/g, "").slice(0, 12),
    });

    if (plan.missions.length > 0) {
      const rows: Row[] = plan.missions.map((m) => ({
        ...m,
        org_id: org.orgId,
        quest_pack_id: newPackId,
      }));

      const misIns = (await (
        supabase.from("org_missions" as never) as unknown as {
          insert: (r: Row[]) => Promise<{ error: SbErr }>;
        }
      ).insert(rows)) as { error: SbErr };

      if (misIns.error) {
        console.error("[quest-pack-copy] missions insert", misIns.error);
        // 미션이 없는 빈 스탬프북만 남으면 더 헷갈린다 — 되돌린다.
        await (
          supabase.from("org_quest_packs" as never) as unknown as {
            delete: () => {
              eq: (k: string, v: string) => Promise<{ error: SbErr }>;
            };
          }
        )
          .delete()
          .eq("id", newPackId);
        return { ok: false, error: "미션 복사에 실패했어요" };
      }
    }

    // 5) 이 행사에 연결 — 기존 연결은 그대로 두고 뒤에 붙인다.
    const linkResp = (await (
      supabase.from("org_event_quest_packs" as never) as unknown as {
        insert: (r: Row) => Promise<{ error: SbErr }>;
      }
    ).insert({
      event_id: targetEventId,
      quest_pack_id: newPackId,
      sort_order: 999,
    })) as { error: SbErr };

    if (linkResp.error) {
      // 복사 자체는 됐다 — 연결만 실패했으면 목록에서 직접 연결할 수 있다.
      console.error("[quest-pack-copy] link", linkResp.error);
    }

    revalidatePath("/org/[orgId]/events/[eventId]", "page");
    revalidatePath("/org/[orgId]/quest-packs", "page");

    return {
      ok: true,
      newPackId,
      missionCount: plan.missions.length,
      unlockedTitles: plan.unlockedTitles,
      reissuedQrTitles: plan.reissuedQrTitles,
    };
  } catch (e) {
    console.error("[quest-pack-copy] threw", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "가져오기에 실패했어요",
    };
  }
}

type PackRow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  trail_id: string | null;
  cover_image_url: string | null;
  layout_mode: string;
  stamp_icon_set: string;
  completion_animation: string;
  tier_config: Record<string, unknown> | null;
};
