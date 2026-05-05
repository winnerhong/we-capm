"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";
import {
  isValidPackTier,
  isValidFeatureStatus,
  getFeatureByCode,
} from "@/lib/features/queries";
import type {
  PackTier,
  FeatureStatus,
  FeatureCategory,
} from "@/lib/features/types";
import { FEATURE_CATEGORIES } from "@/lib/features/types";

type ActionResult = { ok: true } | { ok: false; message: string };

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;

function validateCategory(v: unknown): FeatureCategory {
  if (typeof v === "string" && (FEATURE_CATEGORIES as readonly string[]).includes(v))
    return v as FeatureCategory;
  return "OTHER";
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof n === "string" ? parseInt(n, 10) : Number(n);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

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
    console.error("[features] audit insert failed", e);
  }
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
export async function createFeatureAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const short_desc = String(formData.get("short_desc") ?? "").trim() || null;
  const long_desc = String(formData.get("long_desc") ?? "").trim() || null;
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const category = validateCategory(formData.get("category"));
  const pack_tierRaw = formData.get("pack_tier");
  const statusRaw = formData.get("status");

  if (!CODE_PATTERN.test(code)) {
    return {
      ok: false,
      message: "코드는 대문자/숫자/언더스코어, 영문 대문자로 시작 (2~50자)",
    };
  }
  if (!name) return { ok: false, message: "이름은 필수입니다." };
  if (!isValidPackTier(pack_tierRaw))
    return { ok: false, message: "분류(BASIC/OPTIONAL/HIDDEN)가 올바르지 않습니다." };
  if (!isValidFeatureStatus(statusRaw))
    return { ok: false, message: "상태가 올바르지 않습니다." };

  const pack_tier: PackTier = pack_tierRaw;
  const status: FeatureStatus = statusRaw;

  // BASIC / HIDDEN 은 가격 강제 0
  const setup_fee_krw =
    pack_tier === "OPTIONAL" ? clampInt(formData.get("setup_fee_krw"), 0, 1_000_000_000, 0) : 0;
  const monthly_fee_krw =
    pack_tier === "OPTIONAL" ? clampInt(formData.get("monthly_fee_krw"), 0, 100_000_000, 0) : 0;
  const trial_days = clampInt(formData.get("trial_days"), 0, 365, 0);
  const sort_order = clampInt(formData.get("sort_order"), 0, 99999, 100);

  const existing = await getFeatureByCode(code);
  if (existing) {
    return { ok: false, message: `이미 존재하는 코드입니다: ${code}` };
  }

  const supabase = await createClient();
  const { error } = await (
    supabase.from("platform_features" as never) as unknown as {
      insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }
  ).insert({
    code,
    name,
    short_desc,
    long_desc,
    icon,
    category,
    pack_tier,
    status,
    setup_fee_krw,
    monthly_fee_krw,
    trial_days,
    sort_order,
    released_at: status === "GA" ? new Date().toISOString() : null,
  });

  if (error) {
    console.error("[features] create failed", error);
    return { ok: false, message: error.message };
  }

  await logAudit({
    action: "FEATURE_CREATE",
    feature_code: code,
    actor_admin_id: typeof admin?.id === "string" ? admin.id : null,
    after_json: {
      code,
      name,
      pack_tier,
      status,
      setup_fee_krw,
      monthly_fee_krw,
      category,
    },
  });

  revalidatePath("/admin/features");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// UPDATE (메타데이터·가격 — tier 변경은 아래 별도)
// ---------------------------------------------------------------------------
export async function updateFeatureAction(
  code: string,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const before = await getFeatureByCode(code);
  if (!before) return { ok: false, message: "기능을 찾을 수 없습니다." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "이름은 필수입니다." };

  const short_desc = String(formData.get("short_desc") ?? "").trim() || null;
  const long_desc = String(formData.get("long_desc") ?? "").trim() || null;
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const category = validateCategory(formData.get("category"));
  const trial_days = clampInt(formData.get("trial_days"), 0, 365, before.trial_days);
  const sort_order = clampInt(formData.get("sort_order"), 0, 99999, before.sort_order);

  // 가격은 OPTIONAL 일 때만 입력 받음
  const setup_fee_krw =
    before.pack_tier === "OPTIONAL"
      ? clampInt(formData.get("setup_fee_krw"), 0, 1_000_000_000, before.setup_fee_krw)
      : 0;
  const monthly_fee_krw =
    before.pack_tier === "OPTIONAL"
      ? clampInt(formData.get("monthly_fee_krw"), 0, 100_000_000, before.monthly_fee_krw)
      : 0;

  const supabase = await createClient();
  const { error } = await (
    supabase.from("platform_features" as never) as unknown as {
      update: (row: Record<string, unknown>) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({
      name,
      short_desc,
      long_desc,
      icon,
      category,
      trial_days,
      sort_order,
      setup_fee_krw,
      monthly_fee_krw,
    })
    .eq("code", code);

  if (error) {
    console.error("[features] update failed", error);
    return { ok: false, message: error.message };
  }

  const priceChanged =
    before.setup_fee_krw !== setup_fee_krw || before.monthly_fee_krw !== monthly_fee_krw;

  await logAudit({
    action: priceChanged ? "FEATURE_PRICE_CHANGE" : "FEATURE_UPDATE",
    feature_code: code,
    actor_admin_id: typeof admin?.id === "string" ? admin.id : null,
    before_json: {
      name: before.name,
      setup_fee_krw: before.setup_fee_krw,
      monthly_fee_krw: before.monthly_fee_krw,
      category: before.category,
    },
    after_json: { name, setup_fee_krw, monthly_fee_krw, category },
  });

  revalidatePath("/admin/features");
  revalidatePath(`/admin/features/${code}/edit`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 상태 변경 (DRAFT/BETA/GA/DEPRECATED)
// ---------------------------------------------------------------------------
export async function setFeatureStatusAction(
  code: string,
  next: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!isValidFeatureStatus(next))
    return { ok: false, message: "상태 값이 올바르지 않습니다." };

  const before = await getFeatureByCode(code);
  if (!before) return { ok: false, message: "기능을 찾을 수 없습니다." };
  if (before.status === next) return { ok: true };

  const supabase = await createClient();
  const { error } = await (
    supabase.from("platform_features" as never) as unknown as {
      update: (row: Record<string, unknown>) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({
      status: next,
      released_at:
        next === "GA" && !before.released_at
          ? new Date().toISOString()
          : before.released_at,
    })
    .eq("code", code);

  if (error) return { ok: false, message: error.message };

  await logAudit({
    action: "FEATURE_STATUS_CHANGE",
    feature_code: code,
    actor_admin_id: typeof admin?.id === "string" ? admin.id : null,
    before_json: { status: before.status },
    after_json: { status: next },
  });

  revalidatePath("/admin/features");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 분류(tier) 변경 — 정책 선택 포함
// existingPolicy:
//   GRANDFATHER  : 기존 보유 지사 권한 그대로 유지 (BASIC/OPTIONAL 모두 가능, 안전)
//   AUTO_GRANT   : OPTIONAL→BASIC 일 때 미보유 지사 모두에게 ACTIVE grant 부여
//   REVOKE_ALL   : BASIC→OPTIONAL 일 때 기존 grant 모두 회수 (위험)
// ---------------------------------------------------------------------------
export async function changeFeatureTierAction(
  code: string,
  next: string,
  existingPolicy: "GRANDFATHER" | "AUTO_GRANT" | "REVOKE_ALL"
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!isValidPackTier(next))
    return { ok: false, message: "분류 값이 올바르지 않습니다." };

  const before = await getFeatureByCode(code);
  if (!before) return { ok: false, message: "기능을 찾을 수 없습니다." };
  if (before.pack_tier === next) return { ok: true };

  const supabase = await createClient();

  // 1) tier 자체 변경
  const updatePayload: Record<string, unknown> = { pack_tier: next };
  if (next !== "OPTIONAL") {
    // BASIC/HIDDEN 은 가격 0으로 정리
    updatePayload.setup_fee_krw = 0;
    updatePayload.monthly_fee_krw = 0;
  }

  const { error: e1 } = await (
    supabase.from("platform_features" as never) as unknown as {
      update: (row: Record<string, unknown>) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update(updatePayload)
    .eq("code", code);

  if (e1) return { ok: false, message: e1.message };

  // 2) 기존 보유 지사 정책 처리
  let affected = 0;

  if (existingPolicy === "AUTO_GRANT" && next === "BASIC") {
    // 모든 partners 에 ACTIVE 가 없으면 grant 생성
    const { data: partners } = await (
      supabase.from("partners" as never) as unknown as {
        select: (c: string) => Promise<{ data: { id: string }[] | null; error: unknown }>;
      }
    ).select("id");

    const { data: existing } = await (
      supabase.from("partner_feature_grants" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => Promise<{
              data: { partner_id: string }[] | null;
              error: unknown;
            }>;
          };
        };
      }
    )
      .select("partner_id")
      .eq("feature_code", code)
      .eq("status", "ACTIVE");

    const have = new Set((existing ?? []).map((r) => r.partner_id));
    const missing = (partners ?? [])
      .map((p) => p.id)
      .filter((id) => !have.has(id));

    if (missing.length > 0) {
      const rows = missing.map((pid) => ({
        partner_id: pid,
        feature_code: code,
        source: "DEFAULT_PACK",
        status: "ACTIVE",
        note: "tier 변경 시 자동 부여 (OPTIONAL→BASIC)",
      }));
      const { error: e2 } = await (
        supabase.from("partner_feature_grants" as never) as unknown as {
          insert: (rows: Record<string, unknown>[]) => Promise<{
            error: { message: string } | null;
          }>;
        }
      ).insert(rows);
      if (e2) return { ok: false, message: e2.message };
      affected = missing.length;
    }
  } else if (existingPolicy === "REVOKE_ALL" && next !== "BASIC") {
    const { data: revoked, error: e3 } = await (
      supabase.from("partner_feature_grants" as never) as unknown as {
        update: (r: Record<string, unknown>) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              select: (c: string) => Promise<{
                data: { id: string }[] | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      }
    )
      .update({
        status: "REVOKED",
        revoked_at: new Date().toISOString(),
        note: "tier 변경 시 일괄 회수",
      })
      .eq("feature_code", code)
      .eq("status", "ACTIVE")
      .select("id");
    if (e3) return { ok: false, message: e3.message };
    affected = (revoked ?? []).length;
  }
  // GRANDFATHER 는 기존 grant 그대로 둠 — 아무것도 안 함

  await logAudit({
    action: "FEATURE_TIER_CHANGE",
    feature_code: code,
    actor_admin_id: typeof admin?.id === "string" ? admin.id : null,
    before_json: { pack_tier: before.pack_tier },
    after_json: {
      pack_tier: next,
      existing_policy: existingPolicy,
      affected_partner_count: affected,
    },
    note: `tier ${before.pack_tier} → ${next} (${existingPolicy})`,
  });

  revalidatePath("/admin/features");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 의존성 / 추가 메타 — 단순 텍스트 배열로 입력
// formData "requires_features" : "TORI_FM,EVENT_BASIC" (콤마 구분)
// ---------------------------------------------------------------------------
export async function setFeatureRequiresAction(
  code: string,
  requiresCsv: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const before = await getFeatureByCode(code);
  if (!before) return { ok: false, message: "기능을 찾을 수 없습니다." };

  const list = requiresCsv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== code);

  // 모든 dependency 가 카탈로그에 존재해야 함
  if (list.length > 0) {
    const supabase = await createClient();
    const { data } = await (
      supabase.from("platform_features" as never) as unknown as {
        select: (c: string) => {
          in: (k: string, v: string[]) => Promise<{
            data: { code: string }[] | null;
            error: unknown;
          }>;
        };
      }
    )
      .select("code")
      .in("code", list);
    const found = new Set((data ?? []).map((r) => r.code));
    const missing = list.filter((c) => !found.has(c));
    if (missing.length > 0)
      return {
        ok: false,
        message: `존재하지 않는 의존 기능: ${missing.join(", ")}`,
      };
  }

  const supabase = await createClient();
  const { error } = await (
    supabase.from("platform_features" as never) as unknown as {
      update: (row: Record<string, unknown>) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ requires_features: list })
    .eq("code", code);
  if (error) return { ok: false, message: error.message };

  await logAudit({
    action: "FEATURE_UPDATE",
    feature_code: code,
    actor_admin_id: typeof admin?.id === "string" ? admin.id : null,
    before_json: { requires_features: before.requires_features },
    after_json: { requires_features: list },
  });

  revalidatePath("/admin/features");
  revalidatePath(`/admin/features/${code}/edit`);
  return { ok: true };
}
