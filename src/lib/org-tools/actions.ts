"use server";

// 지사가 도구를 켜고 끄고 상단에 올리는 액션 한 벌.
//
// 같은 조작이 두 층에서 일어난다:
//   전체(partner) — partner_feature_defaults / partner_tool_pins
//   개별(org)     — org_feature_switches     / org_tool_pins
// 층만 다르고 규칙은 같아서 한 파일에 둔다. 갈라 두면 한쪽만 고쳐진다.
//
// 세 자리(끔/켬/상단)를 두 컬럼으로 나눠 저장한다:
//   끔   enabled=false, pinned=false
//   켬   enabled=true,  pinned=false
//   상단 enabled=true,  pinned=true    ← pinned 는 enabled 를 함의한다
// 화면에서 못 만드는 조합(꺼졌는데 고정됨)을 서버에서도 막는다.

import { revalidatePath } from "next/cache";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { toolByKey, MAX_PINNED_TOOLS } from "./registry";

export type ToolState = "off" | "on" | "pinned";
export type ToolResult = { ok: true } | { ok: false; message: string };

function fail(message: string): ToolResult {
  return { ok: false, message };
}

/** 이 기관이 정말 내 지사 것인가 — 남의 기관 설정을 건드리지 못하게. */
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

async function upsert(
  table: string,
  row: Record<string, unknown>,
  onConflict: string
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await (
    supabase.from(table as never) as unknown as {
      upsert: (
        r: Record<string, unknown>,
        o: { onConflict: string }
      ) => Promise<{ error: unknown }>;
    }
  ).upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict });
  if (error) {
    console.error(`[org-tools] ${table} upsert failed`, error);
    return (error as { message?: string }).message || "저장하지 못했어요";
  }
  return null;
}

/**
 * 지금 상단에 몇 개가 올라가 있나 — 5칸 제한을 서버에서도 센다.
 *
 * 화면에서만 막으면 탭 두 개를 열어 놓고 각각 올릴 때 6개가 된다. 흔한 일은
 * 아니지만, 넘친 상단 메뉴는 **지사가 아니라 기관 화면**에서 터지므로 아무도
 * 모른 채 남는다.
 */
async function countPinned(
  scope: { orgId: string } | { partnerId: string },
  exceptKey: string
): Promise<number> {
  const supabase = await createClient();
  const table = "orgId" in scope ? "org_tool_pins" : "partner_tool_pins";
  const col = "orgId" in scope ? "org_id" : "partner_id";
  const val = "orgId" in scope ? scope.orgId : scope.partnerId;

  const { data } = await (
    supabase.from(table as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: boolean) => Promise<{
            data: { tool_key: string }[] | null;
          }>;
        };
      };
    }
  )
    .select("tool_key")
    .eq(col, val)
    .eq("pinned", true);

  return (data ?? []).filter((r) => r.tool_key !== exceptKey).length;
}

/* -------------------------------------------------------------------------- */
/* 기관별 개별                                                                 */
/* -------------------------------------------------------------------------- */

export async function setOrgToolStateAction(
  orgId: string,
  toolKey: string,
  state: ToolState
): Promise<ToolResult> {
  try {
    const partner = await requirePartner();
    const tool = toolByKey(toolKey);
    if (!tool) return fail("모르는 도구예요");
    if (state === "off" && !tool.featureCode) {
      return fail("끌 수 없는 기본 기능이에요");
    }
    await assertOwnedOrg(orgId, partner.id);

    if (state === "pinned") {
      const n = await countPinned({ orgId }, toolKey);
      if (n >= MAX_PINNED_TOOLS) {
        return fail(`상단은 ${MAX_PINNED_TOOLS}개까지예요`);
      }
    }

    const actor = partner.teamMemberId ?? partner.id;

    // 기능 온오프는 **기능** 단위라 같은 기능을 쓰는 다른 도구도 함께 움직인다.
    // (관제실을 끄면 관제실 TV 모드도 꺼진다 — 같은 CONTROL_ROOM 이다)
    if (tool.featureCode) {
      const err = await upsert(
        "org_feature_switches",
        {
          org_id: orgId,
          feature_code: tool.featureCode,
          enabled: state !== "off",
          updated_by: actor,
        },
        "org_id,feature_code"
      );
      if (err) return fail(err);
    }

    const err = await upsert(
      "org_tool_pins",
      {
        org_id: orgId,
        tool_key: toolKey,
        pinned: state === "pinned",
        updated_by: actor,
      },
      "org_id,tool_key"
    );
    if (err) return fail(err);

    revalidatePath(`/partner/customers/org/${orgId}`);
    revalidatePath(`/org/${orgId}`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "변경하지 못했어요");
  }
}

/** 개별 설정을 지워 지사 전체값으로 되돌린다. */
export async function clearOrgToolOverrideAction(
  orgId: string,
  toolKey: string
): Promise<ToolResult> {
  try {
    const partner = await requirePartner();
    const tool = toolByKey(toolKey);
    if (!tool) return fail("모르는 도구예요");
    await assertOwnedOrg(orgId, partner.id);

    const supabase = await createClient();
    const del = (table: string, col: string, key: string, val: string) =>
      (
        supabase.from(table as never) as unknown as {
          delete: () => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => Promise<{ error: unknown }>;
            };
          };
        }
      )
        .delete()
        .eq(col, orgId)
        .eq(key, val);

    await del("org_tool_pins", "org_id", "tool_key", toolKey);
    // 기능 스위치는 같은 기능을 쓰는 도구들이 공유하므로, 그 기능을 쓰는 도구가
    // 이 하나뿐일 때만 지운다. 아니면 옆 도구의 개별 설정까지 같이 날아간다.
    if (tool.featureCode) {
      const { ORG_TOOLS } = await import("./registry");
      const siblings = ORG_TOOLS.filter(
        (t) => t.featureCode === tool.featureCode
      );
      if (siblings.length === 1) {
        await del("org_feature_switches", "org_id", "feature_code", tool.featureCode);
      }
    }

    revalidatePath(`/partner/customers/org/${orgId}`);
    revalidatePath(`/org/${orgId}`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "되돌리지 못했어요");
  }
}

/* -------------------------------------------------------------------------- */
/* 지사 전체                                                                   */
/* -------------------------------------------------------------------------- */

export async function setPartnerToolStateAction(
  toolKey: string,
  state: ToolState
): Promise<ToolResult> {
  try {
    const partner = await requirePartner();
    const tool = toolByKey(toolKey);
    if (!tool) return fail("모르는 도구예요");
    if (state === "off" && !tool.featureCode) {
      return fail("끌 수 없는 기본 기능이에요");
    }

    if (state === "pinned") {
      const n = await countPinned({ partnerId: partner.id }, toolKey);
      if (n >= MAX_PINNED_TOOLS) {
        return fail(`상단은 ${MAX_PINNED_TOOLS}개까지예요`);
      }
    }

    const actor = partner.teamMemberId ?? partner.id;

    if (tool.featureCode) {
      const err = await upsert(
        "partner_feature_defaults",
        {
          partner_id: partner.id,
          feature_code: tool.featureCode,
          enabled: state !== "off",
          updated_by: actor,
        },
        "partner_id,feature_code"
      );
      if (err) return fail(err);
    }

    const err = await upsert(
      "partner_tool_pins",
      {
        partner_id: partner.id,
        tool_key: toolKey,
        pinned: state === "pinned",
        updated_by: actor,
      },
      "partner_id,tool_key"
    );
    if (err) return fail(err);

    revalidatePath("/partner/features");
    // 개별 설정이 없는 기관들의 화면이 지금 바뀐다. 몇 곳인지는 화면이 말한다.
    revalidatePath("/org", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "변경하지 못했어요");
  }
}
