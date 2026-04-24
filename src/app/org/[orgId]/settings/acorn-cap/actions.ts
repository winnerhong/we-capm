"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadPlatformAcornGuidelines } from "@/lib/missions/queries";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

export async function updateOrgAcornCapAction(
  orgId: string,
  formData: FormData
): Promise<void> {
  const org = await requireOrg();
  if (org.orgId !== orgId) {
    throw new Error("다른 기관의 설정은 변경할 수 없어요");
  }

  const raw = formData.get("daily_cap");
  if (raw === null || raw === undefined) {
    throw new Error("일일 상한 값을 입력해 주세요");
  }
  const str = typeof raw === "string" ? raw.trim() : "";
  if (!str) throw new Error("일일 상한 값을 입력해 주세요");
  const dailyCap = Number(str);
  if (!Number.isFinite(dailyCap) || Math.floor(dailyCap) !== dailyCap) {
    throw new Error("일일 상한은 정수로 입력해 주세요");
  }
  if (dailyCap < 1) {
    throw new Error("일일 상한은 1 이상이어야 해요");
  }

  const guidelines = await loadPlatformAcornGuidelines();
  const hardCap = guidelines?.max_daily_hard_cap ?? 200;
  if (dailyCap > hardCap) {
    throw new Error(`절대 하드캡(도토리 ${hardCap}개)을 넘길 수 없어요`);
  }

  const supabase = await createClient();
  const updatedBy = org.managerId ?? org.orgId;

  // UNIQUE(org_id) 를 이용해 upsert
  const upsertResp = (await (
    supabase.from("org_daily_acorn_caps" as never) as unknown as {
      upsert: (
        r: Row,
        o: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert(
    {
      org_id: orgId,
      daily_cap: dailyCap,
      updated_by: updatedBy,
    } satisfies Row,
    { onConflict: "org_id" }
  )) as { error: { message: string } | null };

  if (upsertResp.error) {
    console.error("[org/acorn-cap] upsert error", upsertResp.error);
    throw new Error(`저장 실패: ${upsertResp.error.message}`);
  }

  revalidatePath(`/org/${orgId}/settings/acorn-cap`);
  redirect(`/org/${orgId}/settings/acorn-cap?updated=1`);
}
