"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getFeatureByCode } from "@/lib/features/queries";

type ActionResult = { ok: true; affected?: number } | { ok: false; message: string };

async function logAudit(args: {
  action: string;
  feature_code?: string | null;
  partner_id?: string | null;
  actor_admin_id?: string | null;
  before_json?: unknown;
  after_json?: unknown;
  note?: string | null;
}) {
  try {
    const supabase = await createClient();
    await (supabase.from("platform_feature_audit" as never) as unknown as {
      insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
    }).insert({
      action: args.action,
      feature_code: args.feature_code ?? null,
      partner_id: args.partner_id ?? null,
      actor_admin_id: args.actor_admin_id ?? null,
      before_json: args.before_json ?? null,
      after_json: args.after_json ?? null,
      note: args.note ?? null,
    });
  } catch (e) {
    console.error("[grants] audit insert failed", e);
  }
}

// ---------------------------------------------------------------------------
// 한 지사에 한 기능 부여
// ---------------------------------------------------------------------------
export async function grantFeatureAction(
  partnerId: string,
  featureCode: string,
  note?: string
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const feature = await getFeatureByCode(featureCode);
  if (!feature) return { ok: false, message: "기능을 찾을 수 없습니다." };

  const supabase = await createClient();

  // partner 존재 확인
  const { data: p } = await (
    supabase.from("partners" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { id: string; name: string } | null;
            error: unknown;
          }>;
        };
      };
    }
  )
    .select("id,name")
    .eq("id", partnerId)
    .maybeSingle();
  if (!p) return { ok: false, message: "지사를 찾을 수 없습니다." };

  // 이미 ACTIVE 인 grant 가 있으면 noop
  const { data: existing } = await (
    supabase.from("partner_feature_grants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{
                data: { id: string } | null;
                error: unknown;
              }>;
            };
          };
        };
      };
    }
  )
    .select("id")
    .eq("partner_id", partnerId)
    .eq("feature_code", featureCode)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (existing) {
    return { ok: true };
  }

  const { error } = await (
    supabase.from("partner_feature_grants" as never) as unknown as {
      insert: (row: Record<string, unknown>) => Promise<{
        error: { message: string } | null;
      }>;
    }
  ).insert({
    partner_id: partnerId,
    feature_code: featureCode,
    source: "ADMIN_GRANT",
    status: "ACTIVE",
    granted_by: typeof admin?.id === "string" ? admin.id : null,
    note: note ?? null,
  });

  if (error) {
    console.error("[grants] insert failed", error);
    return { ok: false, message: error.message };
  }

  await logAudit({
    action: "GRANT_CREATE",
    feature_code: featureCode,
    partner_id: partnerId,
    actor_admin_id: typeof admin?.id === "string" ? admin.id : null,
    after_json: { source: "ADMIN_GRANT", note: note ?? null },
  });

  revalidatePath(`/admin/features/${featureCode}/grants`);
  revalidatePath(`/admin/partners/${partnerId}`);
  revalidatePath("/admin/features");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// grant 회수 (ACTIVE → REVOKED)
// ---------------------------------------------------------------------------
export async function revokeGrantAction(
  grantId: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: existing } = await (
    supabase.from("partner_feature_grants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              partner_id: string;
              feature_code: string;
              status: string;
            } | null;
            error: unknown;
          }>;
        };
      };
    }
  )
    .select("id,partner_id,feature_code,status")
    .eq("id", grantId)
    .maybeSingle();

  if (!existing) return { ok: false, message: "grant 를 찾을 수 없습니다." };
  if (existing.status !== "ACTIVE")
    return { ok: false, message: "이미 회수된 grant 입니다." };

  const { error } = await (
    supabase.from("partner_feature_grants" as never) as unknown as {
      update: (r: Record<string, unknown>) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update({
      status: "REVOKED",
      revoked_at: new Date().toISOString(),
      revoked_by: typeof admin?.id === "string" ? admin.id : null,
    })
    .eq("id", grantId);

  if (error) return { ok: false, message: error.message };

  await logAudit({
    action: "GRANT_REVOKE",
    feature_code: existing.feature_code,
    partner_id: existing.partner_id,
    actor_admin_id: typeof admin?.id === "string" ? admin.id : null,
    before_json: { status: "ACTIVE" },
    after_json: { status: "REVOKED" },
  });

  revalidatePath(`/admin/features/${existing.feature_code}/grants`);
  revalidatePath(`/admin/partners/${existing.partner_id}`);
  revalidatePath("/admin/features");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 일괄 부여 — 한 기능을 여러 지사에 (또는 전체)
//   selection: "ALL" | partnerId[] (csv)
// ---------------------------------------------------------------------------
export async function bulkGrantFeatureAction(
  featureCode: string,
  selectionCsv: string,
  note?: string
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const feature = await getFeatureByCode(featureCode);
  if (!feature) return { ok: false, message: "기능을 찾을 수 없습니다." };

  const supabase = await createClient();

  let partnerIds: string[];
  if (selectionCsv.trim().toUpperCase() === "ALL") {
    const { data, error } = await (
      supabase.from("partners" as never) as unknown as {
        select: (c: string) => Promise<{
          data: { id: string }[] | null;
          error: { message: string } | null;
        }>;
      }
    ).select("id");
    if (error) return { ok: false, message: error.message };
    partnerIds = (data ?? []).map((r) => r.id);
  } else {
    partnerIds = selectionCsv
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  if (partnerIds.length === 0) return { ok: true, affected: 0 };

  // 이미 ACTIVE 인 지사 제외
  const { data: existing } = await (
    supabase.from("partner_feature_grants" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            in: (k: string, v: string[]) => Promise<{
              data: { partner_id: string }[] | null;
              error: unknown;
            }>;
          };
        };
      };
    }
  )
    .select("partner_id")
    .eq("feature_code", featureCode)
    .eq("status", "ACTIVE")
    .in("partner_id", partnerIds);

  const have = new Set((existing ?? []).map((r) => r.partner_id));
  const missing = partnerIds.filter((id) => !have.has(id));

  if (missing.length === 0) return { ok: true, affected: 0 };

  const rows = missing.map((pid) => ({
    partner_id: pid,
    feature_code: featureCode,
    source: "ADMIN_GRANT",
    status: "ACTIVE",
    granted_by: typeof admin?.id === "string" ? admin.id : null,
    note: note ?? "bulk grant",
  }));

  const { error } = await (
    supabase.from("partner_feature_grants" as never) as unknown as {
      insert: (rows: Record<string, unknown>[]) => Promise<{
        error: { message: string } | null;
      }>;
    }
  ).insert(rows);
  if (error) return { ok: false, message: error.message };

  await logAudit({
    action: "GRANT_BULK",
    feature_code: featureCode,
    actor_admin_id: typeof admin?.id === "string" ? admin.id : null,
    after_json: {
      selection: selectionCsv,
      affected_partner_count: missing.length,
    },
    note: note ?? null,
  });

  revalidatePath(`/admin/features/${featureCode}/grants`);
  revalidatePath("/admin/features");
  return { ok: true, affected: missing.length };
}
