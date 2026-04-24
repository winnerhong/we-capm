"use server";

import { revalidatePath } from "next/cache";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

const BUILT_IN_KEYS = new Set(["EASY", "MEDIUM", "HARD"]);

function slugify(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return `CUSTOM_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  // 한글/영문/숫자만 남기고 나머지는 언더스코어로
  const cleaned = trimmed
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .slice(0, 30);
  return `C_${cleaned || Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function createDifficultyAction(formData: FormData) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const label = String(formData.get("label") ?? "").trim();
  const icon = String(formData.get("icon") ?? "🌿").trim() || "🌿";
  const description = String(formData.get("description") ?? "").trim() || null;
  const keyInput = String(formData.get("key") ?? "").trim();

  if (!label) throw new Error("난이도 이름을 입력해 주세요");
  if (label.length > 30) throw new Error("난이도 이름이 너무 길어요 (30자 이내)");

  const key = keyInput || slugify(label);
  if (BUILT_IN_KEYS.has(key)) {
    throw new Error("기본 난이도(EASY/MEDIUM/HARD)와 중복되는 키는 사용할 수 없어요");
  }

  const sb = supabase as unknown as {
    from: (t: string) => {
      insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await sb.from("partner_trail_difficulties").insert({
    partner_id: partner.id,
    key,
    label,
    icon,
    description,
  });
  if (error) throw new Error(`난이도 생성 실패: ${error.message}`);

  revalidatePath("/partner/trails");
}

export async function updateDifficultyAction(id: string, formData: FormData) {
  await requirePartner();
  const supabase = await createClient();

  const label = String(formData.get("label") ?? "").trim();
  const icon = String(formData.get("icon") ?? "🌿").trim() || "🌿";
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!label) throw new Error("난이도 이름을 입력해 주세요");
  if (label.length > 30) throw new Error("난이도 이름이 너무 길어요 (30자 이내)");

  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await sb
    .from("partner_trail_difficulties")
    .update({ label, icon, description })
    .eq("id", id);
  if (error) throw new Error(`난이도 수정 실패: ${error.message}`);

  revalidatePath("/partner/trails");
}

export async function deleteDifficultyAction(id: string) {
  const partner = await requirePartner();
  const supabase = await createClient();

  // 삭제 전 이 난이도를 쓰는 숲길이 있는지 확인
  const sbSelect = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { key: string } | null;
          }>;
        };
      };
    };
  };
  const { data: diff } = await sbSelect
    .from("partner_trail_difficulties")
    .select("key")
    .eq("id", id)
    .maybeSingle();
  if (!diff) throw new Error("난이도를 찾을 수 없어요");

  const sbCount = supabase as unknown as {
    from: (t: string) => {
      select: (
        c: string,
        o: { count: "exact"; head: true }
      ) => {
        eq: (k: string, v: string) => {
          eq: (k2: string, v2: string) => Promise<{ count: number | null }>;
        };
      };
    };
  };
  const { count } = await sbCount
    .from("partner_trails")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partner.id)
    .eq("difficulty", diff.key);
  if ((count ?? 0) > 0) {
    throw new Error(
      `이 난이도를 사용 중인 숲길이 ${count}개 있어요. 먼저 다른 난이도로 바꾸거나 삭제하세요.`
    );
  }

  const sbDelete = supabase as unknown as {
    from: (t: string) => {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await sbDelete
    .from("partner_trail_difficulties")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`난이도 삭제 실패: ${error.message}`);

  revalidatePath("/partner/trails");
}
