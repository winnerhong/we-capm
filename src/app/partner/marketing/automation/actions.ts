"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";

type TriggerType =
  | "SIGNUP"
  | "FIRST_PURCHASE"
  | "ABANDONED_CART"
  | "POST_EVENT"
  | "NO_ACTIVITY_30D"
  | "REVIEW_REQUEST"
  | "BIRTHDAY";

type ActionType = "SMS" | "EMAIL" | "KAKAO" | "PUSH" | "COUPON";

interface AutomationAction {
  type: ActionType;
  delayHours: number;
  title: string;
  body: string;
  couponId?: string;
}

const TRIGGER_SET = new Set<TriggerType>([
  "SIGNUP",
  "FIRST_PURCHASE",
  "ABANDONED_CART",
  "POST_EVENT",
  "NO_ACTIVITY_30D",
  "REVIEW_REQUEST",
  "BIRTHDAY",
]);

const ACTION_TYPE_SET = new Set<ActionType>([
  "SMS",
  "EMAIL",
  "KAKAO",
  "PUSH",
  "COUPON",
]);

const PRESETS: Record<
  string,
  { name: string; trigger: TriggerType; actions: AutomationAction[] }
> = {
  welcome: {
    name: "신규 환영 시나리오",
    trigger: "SIGNUP",
    actions: [
      {
        type: "KAKAO",
        delayHours: 0,
        title: "환영합니다!",
        body: "{이름}님, 토리로에 오신 걸 환영해요 🌲 첫 예약 10% 할인 쿠폰을 드립니다!",
      },
      {
        type: "SMS",
        delayHours: 72,
        title: "",
        body: "{이름}님, 쿠폰 아직 사용 전이에요! 우리 숲이 기다리고 있어요 🌿",
      },
    ],
  },
  revisit: {
    name: "재방문 유도 시나리오",
    trigger: "NO_ACTIVITY_30D",
    actions: [
      {
        type: "KAKAO",
        delayHours: 0,
        title: "오랜만이에요",
        body: "{이름}님, 한 달만이네요! 이번 달 새 프로그램 보러 오세요 🌲",
      },
      {
        type: "SMS",
        delayHours: 168,
        title: "",
        body: "특별 할인 쿠폰 남아있어요. {쿠폰코드}",
      },
    ],
  },
  review: {
    name: "리뷰 요청 시나리오",
    trigger: "REVIEW_REQUEST",
    actions: [
      {
        type: "KAKAO",
        delayHours: 72,
        title: "어떠셨어요?",
        body: "{이름}님, 지난 주 방문은 어떠셨나요? 간단히 리뷰 남겨주시면 다음 방문 시 5% 할인!",
      },
    ],
  },
};

function norm(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function parseActions(raw: string): AutomationAction[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("액션 데이터 형식이 올바르지 않습니다");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("액션은 배열이어야 합니다");
  }
  const cleaned: AutomationAction[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const type = String(r.type ?? "");
    if (!ACTION_TYPE_SET.has(type as ActionType)) continue;
    const delayHoursNum = Number(r.delayHours ?? 0);
    cleaned.push({
      type: type as ActionType,
      delayHours: Number.isFinite(delayHoursNum) ? delayHoursNum : 0,
      title: String(r.title ?? ""),
      body: String(r.body ?? ""),
      couponId: r.couponId ? String(r.couponId) : undefined,
    });
  }
  return cleaned;
}

export async function createAutomationAction(formData: FormData) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const name = norm(formData.get("name")) || "이름 없는 시나리오";
  const triggerRaw = norm(formData.get("trigger_type"));
  if (!TRIGGER_SET.has(triggerRaw as TriggerType)) {
    throw new Error("트리거를 선택해 주세요");
  }
  const trigger_type = triggerRaw as TriggerType;

  const actionsRaw = norm(formData.get("actions"));
  const actions = parseActions(actionsRaw);
  if (actions.length === 0) {
    throw new Error("최소 1개 이상의 액션을 추가해 주세요");
  }

  const row = {
    partner_id: partner.id,
    name,
    trigger_type,
    trigger_config: {},
    actions,
    is_active: false,
    executed_count: 0,
  };

  // 실제 메시지 발송은 별도 워커에서 처리 (MVP: 플래그만 저장)
  // console.log("[automation] created", row);

  const { data, error } = await (
    supabase.from("partner_automations" as never) as any
  )
    .insert(row as never)
    .select("id")
    .single();

  if (error) throw new Error(`자동화 생성 실패: ${error.message}`);

  revalidatePath("/partner/marketing/automation");
  redirect(`/partner/marketing/automation/${data?.id ?? ""}`);
}

export async function createPresetAutomationAction(formData: FormData) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const presetKey = norm(formData.get("preset_key"));
  const preset = PRESETS[presetKey];
  if (!preset) throw new Error("존재하지 않는 프리셋입니다");

  const row = {
    partner_id: partner.id,
    name: preset.name,
    trigger_type: preset.trigger,
    trigger_config: {},
    actions: preset.actions,
    is_active: false,
    executed_count: 0,
  };

  // console.log("[automation] preset created", presetKey);

  const { data, error } = await (
    supabase.from("partner_automations" as never) as any
  )
    .insert(row as never)
    .select("id")
    .single();

  if (error) throw new Error(`프리셋 생성 실패: ${error.message}`);

  revalidatePath("/partner/marketing/automation");
  redirect(`/partner/marketing/automation/${data?.id ?? ""}`);
}

export async function toggleAutomationAction(formData: FormData) {
  await requirePartner();
  const supabase = await createClient();

  const id = norm(formData.get("id"));
  const nextActive = norm(formData.get("next_active")) === "true";
  if (!id) throw new Error("시나리오 ID가 필요합니다");

  // console.log("[automation] toggle", id, nextActive);

  const { error } = await (
    supabase.from("partner_automations" as never) as any
  )
    .update({ is_active: nextActive } as never)
    .eq("id", id);

  if (error) throw new Error(`상태 변경 실패: ${error.message}`);

  revalidatePath("/partner/marketing/automation");
  revalidatePath(`/partner/marketing/automation/${id}`);
}

export async function updateAutomationAction(id: string, formData: FormData) {
  await requirePartner();
  const supabase = await createClient();

  if (!id) throw new Error("시나리오 ID가 필요합니다");

  const name = norm(formData.get("name")) || "이름 없는 시나리오";
  const triggerRaw = norm(formData.get("trigger_type"));
  if (!TRIGGER_SET.has(triggerRaw as TriggerType)) {
    throw new Error("트리거를 선택해 주세요");
  }
  const trigger_type = triggerRaw as TriggerType;

  const actionsRaw = norm(formData.get("actions"));
  const actions = parseActions(actionsRaw);
  if (actions.length === 0) {
    throw new Error("최소 1개 이상의 액션을 추가해 주세요");
  }

  const patch = {
    name,
    trigger_type,
    actions,
  };

  // console.log("[automation] updated", id, patch);

  const { error } = await (
    supabase.from("partner_automations" as never) as any
  )
    .update(patch as never)
    .eq("id", id);

  if (error) throw new Error(`자동화 수정 실패: ${error.message}`);

  revalidatePath("/partner/marketing/automation");
  revalidatePath(`/partner/marketing/automation/${id}`);
}

export async function deleteAutomationAction(formData: FormData) {
  await requirePartner();
  const supabase = await createClient();

  const id = norm(formData.get("id"));
  if (!id) throw new Error("시나리오 ID가 필요합니다");

  // console.log("[automation] deleted", id);

  const { error } = await (
    supabase.from("partner_automations" as never) as any
  )
    .delete()
    .eq("id", id);

  if (error) throw new Error(`자동화 삭제 실패: ${error.message}`);

  revalidatePath("/partner/marketing/automation");
  redirect("/partner/marketing/automation");
}

export async function testSendAutomationAction(formData: FormData) {
  await requirePartner();

  const id = norm(formData.get("id"));
  if (!id) throw new Error("시나리오 ID가 필요합니다");

  // MVP: 실제 발송 없이 로그만 (향후 파트너 본인 번호로 첫 액션 발송 예정)
  // console.log("[automation] test send requested", id);

  revalidatePath(`/partner/marketing/automation/${id}`);
}
