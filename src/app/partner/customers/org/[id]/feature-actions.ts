"use server";

// 지사가 기관 하나의 기능을 켜고 끈다.
//
// 스위치는 upsert 다 — "행 없음 = 기본값" 이라 끄는 순간 행이 생기고, 다시 켜도
// 행을 지우지 않고 enabled=true 로 둔다. 지웠다 만들었다 하면 "누가 언제 껐다
// 켰나" 가 사라진다(updated_at·updated_by 가 원본).

import { revalidatePath } from "next/cache";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { isAlwaysOn } from "@/lib/features/codes";

export type SwitchResult = { ok: true } | { ok: false; message: string };

/** 이 기관이 정말 내 지사 것인가 — 남의 기관 스위치를 건드리지 못하게. */
async function assertOwnedOrg(orgId: string, partnerId: string) {
  const supabase = await createClient();
  const { data, error } = await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { partner_id: string } | null;
            error: unknown;
          }>;
        };
      };
    }
  )
    .select("partner_id")
    .eq("id", orgId)
    .maybeSingle();

  if (error || !data) throw new Error("기관을 찾을 수 없습니다");
  if (data.partner_id !== partnerId) throw new Error("권한이 없습니다");
}

export async function setOrgFeatureAction(
  orgId: string,
  featureCode: string,
  enabled: boolean
): Promise<SwitchResult> {
  try {
    const partner = await requirePartner();

    if (isAlwaysOn(featureCode)) {
      // 끄면 기관 포털이 통째로 빈 화면이 된다. 화면에도 안 띄우지만 여기서도 막는다.
      return { ok: false, message: "끌 수 없는 기본 기능이에요" };
    }
    await assertOwnedOrg(orgId, partner.id);

    const supabase = await createClient();
    const { error } = await (
      supabase.from("org_feature_switches" as never) as unknown as {
        upsert: (
          row: Record<string, unknown>,
          opts: { onConflict: string }
        ) => Promise<{ error: unknown }>;
      }
    ).upsert(
      {
        org_id: orgId,
        feature_code: featureCode,
        enabled,
        updated_by: partner.teamMemberId ?? partner.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,feature_code" }
    );

    if (error) {
      const msg = (error as { message?: string }).message ?? "";
      console.error("[org-features] upsert failed", error);
      return { ok: false, message: msg || "저장하지 못했어요" };
    }

    // 감사 로그는 실패해도 스위치는 유효하다 — 로그 때문에 토글이 실패하면 안 된다.
    void logSwitch({
      orgId,
      partnerId: partner.id,
      featureCode,
      enabled,
      actor: partner.username || partner.name,
    });

    revalidatePath(`/partner/customers/org/${orgId}`);
    revalidatePath(`/org/${orgId}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "변경하지 못했어요",
    };
  }
}

async function logSwitch(a: {
  orgId: string;
  partnerId: string;
  featureCode: string;
  enabled: boolean;
  actor: string;
}) {
  try {
    const supabase = await createClient();
    await (
      supabase.from("platform_feature_audit" as never) as unknown as {
        insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
      }
    ).insert({
      action: a.enabled ? "ORG_SWITCH_ON" : "ORG_SWITCH_OFF",
      feature_code: a.featureCode,
      partner_id: a.partnerId,
      org_id: a.orgId,
      after_json: { enabled: a.enabled },
      note: `지사 ${a.actor}`,
    });
  } catch (e) {
    console.error("[org-features] audit log failed", e);
  }
}
