"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";

// challenges 테이블 타입이 아직 database.types.ts에 반영되지 않았을 수 있어서
// 임시로 any 브릿지를 통해 Supabase 쿼리 체인에 접근한다.
// DB 에이전트가 타입을 추가하면 이 헬퍼는 제거할 예정.
type ChallengeQuery = {
  insert: (data: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
  update: (data: unknown) => {
    eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>;
  };
  delete: () => {
    eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>;
  };
};

async function challengesTable() {
  const supabase = await createClient();
  return (supabase as unknown as { from: (t: string) => ChallengeQuery }).from("challenges");
}

function parseForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const icon = String(formData.get("icon") ?? "🎯");
  const goal_type = String(formData.get("goal_type") ?? "MISSION_COUNT");
  const goal_value = Number(formData.get("goal_value") ?? 0);
  const reward_acorns = Number(formData.get("reward_acorns") ?? 10);
  const reward_badge = String(formData.get("reward_badge") ?? "").trim() || null;
  const starts_at_raw = String(formData.get("starts_at") ?? "");
  const ends_at_raw = String(formData.get("ends_at") ?? "");
  const event_id = String(formData.get("event_id") ?? "").trim() || null;

  if (!title) throw new Error("챌린지 이름을 입력해주세요");
  if (!goal_value || goal_value <= 0) throw new Error("목표 값을 1 이상으로 설정해주세요");
  if (!starts_at_raw || !ends_at_raw) throw new Error("시작일과 종료일을 입력해주세요");

  return {
    title,
    description,
    icon,
    goal_type,
    goal_value,
    reward_acorns,
    reward_badge,
    starts_at: new Date(starts_at_raw).toISOString(),
    ends_at: new Date(ends_at_raw).toISOString(),
    event_id,
    status: "ACTIVE",
  };
}

export async function createChallengeAction(formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);

  try {
    const table = await challengesTable();
    const { error } = await table.insert(data);
    if (error) throw new Error(error.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "챌린지 생성 실패";
    // 테이블 자체가 없거나(마이그레이션 미적용) 기타 오류는 친근한 메시지로 전달
    throw new Error(`챌린지를 저장하지 못했어요: ${msg}`);
  }

  revalidatePath("/admin/challenges");
  redirect("/admin/challenges");
}

export async function updateChallengeAction(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);

  try {
    const table = await challengesTable();
    const { error } = await table.update(data).eq("id", id);
    if (error) throw new Error(error.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "챌린지 수정 실패";
    throw new Error(`챌린지를 수정하지 못했어요: ${msg}`);
  }

  revalidatePath("/admin/challenges");
  redirect("/admin/challenges");
}

export async function endChallengeAction(id: string) {
  await requireAdmin();

  try {
    const table = await challengesTable();
    const { error } = await table.update({ status: "ENDED" }).eq("id", id);
    if (error) throw new Error(error.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "챌린지 종료 실패";
    throw new Error(`챌린지를 종료하지 못했어요: ${msg}`);
  }

  revalidatePath("/admin/challenges");
}

export async function deleteChallengeAction(id: string) {
  await requireAdmin();

  try {
    const table = await challengesTable();
    const { error } = await table.delete().eq("id", id);
    if (error) throw new Error(error.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "챌린지 삭제 실패";
    throw new Error(`챌린지를 삭제하지 못했어요: ${msg}`);
  }

  revalidatePath("/admin/challenges");
}
