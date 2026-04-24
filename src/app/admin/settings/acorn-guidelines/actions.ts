"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

function parseIntField(formData: FormData, key: string, label: string): number {
  const raw = formData.get(key);
  if (raw === null || raw === undefined) {
    throw new Error(`${label} 값이 비어 있어요`);
  }
  const str = typeof raw === "string" ? raw.trim() : "";
  if (!str) throw new Error(`${label} 값을 입력해 주세요`);
  const n = Number(str);
  if (!Number.isFinite(n) || Math.floor(n) !== n) {
    throw new Error(`${label} 은 정수로 입력해 주세요`);
  }
  if (n <= 0) throw new Error(`${label} 은 1 이상이어야 해요`);
  return n;
}

export async function updatePlatformAcornGuidelinesAction(
  formData: FormData
): Promise<void> {
  const admin = await requireAdmin();

  const maxDailySuggested = parseIntField(
    formData,
    "max_daily_suggested",
    "플랫폼 권장 일일 상한"
  );
  const maxDailyHardCap = parseIntField(
    formData,
    "max_daily_hard_cap",
    "절대 하드캡"
  );
  const maxPerMission = parseIntField(
    formData,
    "max_per_mission",
    "미션당 상한"
  );
  const suggestedRangeMin = parseIntField(
    formData,
    "suggested_range_min",
    "권장 범위 최소값"
  );
  const suggestedRangeMax = parseIntField(
    formData,
    "suggested_range_max",
    "권장 범위 최대값"
  );
  const notesRaw = formData.get("notes");
  const notes =
    typeof notesRaw === "string" && notesRaw.trim().length > 0
      ? notesRaw.trim()
      : null;

  // 교차 검증
  if (maxDailyHardCap < maxDailySuggested) {
    throw new Error("절대 하드캡은 권장 일일 상한보다 크거나 같아야 해요");
  }
  if (suggestedRangeMin > suggestedRangeMax) {
    throw new Error("권장 범위 최소값이 최대값보다 커요");
  }
  if (suggestedRangeMax > maxDailySuggested) {
    throw new Error(
      "권장 범위 최대값은 권장 일일 상한보다 크거나 같을 수 없어요"
    );
  }
  if (maxPerMission > maxDailySuggested) {
    throw new Error("미션당 상한은 권장 일일 상한을 넘을 수 없어요");
  }

  const updatedBy =
    (admin as { username?: string; id?: string })?.username ??
    (admin as { id?: string })?.id ??
    "admin";

  const supabase = await createClient();

  const patch: Row = {
    max_daily_suggested: maxDailySuggested,
    max_daily_hard_cap: maxDailyHardCap,
    max_per_mission: maxPerMission,
    suggested_range_min: suggestedRangeMin,
    suggested_range_max: suggestedRangeMax,
    notes,
    updated_by: updatedBy,
  };

  const resp = (await (
    supabase.from("platform_acorn_guidelines" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: number) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update(patch)
    .eq("id", 1)) as { error: { message: string } | null };

  if (resp.error) {
    console.error("[admin/acorn-guidelines] update error", resp.error);
    throw new Error(`저장 실패: ${resp.error.message}`);
  }

  revalidatePath("/admin/settings/acorn-guidelines");
  redirect("/admin/settings/acorn-guidelines?updated=1");
}
