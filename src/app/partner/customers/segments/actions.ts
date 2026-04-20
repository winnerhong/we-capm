"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";

export type SegmentType = "ORG" | "CUSTOMER" | "COMPANY" | "MIXED";

const SEGMENT_TYPES = new Set<SegmentType>(["ORG", "CUSTOMER", "COMPANY", "MIXED"]);

export type SegmentRuleCondition = {
  field: string;
  op: ">" | "<" | "=" | ">=" | "<=" | "contains";
  value: string | number;
};

export type SegmentRules = {
  combinator: "AND" | "OR";
  conditions: SegmentRuleCondition[];
};

function norm(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function parseRules(formData: FormData): SegmentRules {
  const combinator = (norm(formData.get("combinator")) || "AND") as "AND" | "OR";
  const conditions: SegmentRuleCondition[] = [];
  for (let i = 1; i <= 10; i++) {
    const field = norm(formData.get(`rule_field_${i}`));
    if (!field) continue;
    const op = (norm(formData.get(`rule_op_${i}`)) || "=") as SegmentRuleCondition["op"];
    const valueRaw = norm(formData.get(`rule_value_${i}`));
    if (!valueRaw) continue;
    const numeric = Number(valueRaw);
    conditions.push({
      field,
      op,
      value: Number.isFinite(numeric) && valueRaw !== "" ? numeric : valueRaw,
    });
  }
  return { combinator, conditions };
}

async function evaluateMemberCount(
  partnerId: string,
  segmentType: SegmentType,
  rules: SegmentRules
): Promise<number> {
  const supabase = await createClient();

  const tableByType: Record<SegmentType, string[]> = {
    ORG: ["partner_orgs"],
    CUSTOMER: ["partner_customers"],
    COMPANY: ["partner_companies"],
    MIXED: ["partner_orgs", "partner_customers", "partner_companies"],
  };

  let total = 0;
  for (const table of tableByType[segmentType]) {
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => Promise<{ data: Record<string, unknown>[] | null }>;
          };
        };
      }
    )
      .from(table)
      .select("*")
      .eq("partner_id", partnerId);

    const rows = data ?? [];
    const matched = rows.filter((row) => matchRow(row, rules));
    total += matched.length;
  }
  return total;
}

function matchRow(row: Record<string, unknown>, rules: SegmentRules): boolean {
  if (rules.conditions.length === 0) return true;
  const results = rules.conditions.map((c) => matchCondition(row, c));
  return rules.combinator === "AND" ? results.every(Boolean) : results.some(Boolean);
}

function matchCondition(row: Record<string, unknown>, c: SegmentRuleCondition): boolean {
  const raw = row[c.field];
  if (raw == null) return false;
  if (c.op === "contains") {
    const hay = String(raw).toLowerCase();
    return hay.includes(String(c.value).toLowerCase());
  }
  const a = typeof raw === "number" ? raw : Number(raw);
  const b = typeof c.value === "number" ? c.value : Number(c.value);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    if (c.op === "=") return String(raw) === String(c.value);
    return false;
  }
  switch (c.op) {
    case ">":
      return a > b;
    case "<":
      return a < b;
    case ">=":
      return a >= b;
    case "<=":
      return a <= b;
    case "=":
      return a === b;
    default:
      return false;
  }
}

export async function createSegmentAction(formData: FormData) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const name = norm(formData.get("name"));
  const description = norm(formData.get("description")) || null;
  const icon = norm(formData.get("icon")) || "🎯";
  const color = norm(formData.get("color")) || "#2D5A3D";
  const typeRaw = norm(formData.get("segment_type"));
  const segment_type = SEGMENT_TYPES.has(typeRaw as SegmentType)
    ? (typeRaw as SegmentType)
    : "CUSTOMER";

  if (!name) throw new Error("세그먼트 이름을 입력해 주세요");

  const rules = parseRules(formData);
  const member_count = await evaluateMemberCount(partner.id, segment_type, rules);

  const row = {
    partner_id: partner.id,
    name,
    description,
    icon,
    color,
    segment_type,
    rules,
    auto_update: true,
    member_count,
  };

  const { data, error } = await (
    supabase.from("partner_segments") as unknown as {
      insert: (r: unknown) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .insert(row as never)
    .select("id")
    .single();

  if (error) throw new Error(`세그먼트 생성 실패: ${error.message}`);

  revalidatePath("/partner/customers/segments");
  redirect(`/partner/customers/segments/${data?.id ?? ""}`);
}

export async function updateSegmentAction(id: string, formData: FormData) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const name = norm(formData.get("name"));
  const description = norm(formData.get("description")) || null;
  const icon = norm(formData.get("icon")) || "🎯";
  const color = norm(formData.get("color")) || "#2D5A3D";
  const typeRaw = norm(formData.get("segment_type"));
  const segment_type = SEGMENT_TYPES.has(typeRaw as SegmentType)
    ? (typeRaw as SegmentType)
    : "CUSTOMER";

  if (!name) throw new Error("세그먼트 이름을 입력해 주세요");

  const rules = parseRules(formData);
  const member_count = await evaluateMemberCount(partner.id, segment_type, rules);

  const patch = {
    name,
    description,
    icon,
    color,
    segment_type,
    rules,
    member_count,
  };

  const { error } = await (
    supabase.from("partner_segments") as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update(patch as never)
    .eq("id", id);

  if (error) throw new Error(`세그먼트 수정 실패: ${error.message}`);

  revalidatePath("/partner/customers/segments");
  revalidatePath(`/partner/customers/segments/${id}`);
}

export async function refreshSegmentMembersAction(id: string) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const { data } = await (
    supabase.from("partner_segments") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { segment_type: SegmentType; rules: SegmentRules } | null;
          }>;
        };
      };
    }
  )
    .select("segment_type,rules")
    .eq("id", id)
    .maybeSingle();

  if (!data) throw new Error("세그먼트를 찾을 수 없습니다");

  const rules: SegmentRules =
    data.rules && typeof data.rules === "object"
      ? data.rules
      : { combinator: "AND", conditions: [] };

  const member_count = await evaluateMemberCount(partner.id, data.segment_type, rules);

  const { error } = await (
    supabase.from("partner_segments") as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ member_count } as never)
    .eq("id", id);

  if (error) throw new Error(`멤버 수 갱신 실패: ${error.message}`);

  revalidatePath("/partner/customers/segments");
  revalidatePath(`/partner/customers/segments/${id}`);
}

export async function deleteSegmentAction(id: string) {
  await requirePartner();
  const supabase = await createClient();

  const { error } = await (
    supabase.from("partner_segments") as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .delete()
    .eq("id", id);

  if (error) throw new Error(`세그먼트 삭제 실패: ${error.message}`);

  revalidatePath("/partner/customers/segments");
  redirect("/partner/customers/segments");
}

/** 클라이언트 builder가 실시간 미리보기용으로 호출 */
export async function previewSegmentCountAction(
  segmentType: SegmentType,
  rules: SegmentRules
): Promise<number> {
  const partner = await requirePartner();
  return evaluateMemberCount(partner.id, segmentType, rules);
}
