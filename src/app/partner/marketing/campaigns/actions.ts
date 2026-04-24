"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";

// ---------- helpers ----------

function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function strOrNull(value: FormDataEntryValue | null): string | null {
  const s = str(value);
  return s === "" ? null : s;
}

function multiStrings(formData: FormData, key: string): string[] | null {
  const all = formData
    .getAll(key)
    .map((v) => String(v).trim())
    .filter(Boolean);
  return all.length > 0 ? all : null;
}

// Supabase untyped wrapper — partner_campaigns not in generated types
function campaignsTable(supabase: Awaited<ReturnType<typeof createClient>>) {
  return supabase.from("partner_campaigns" as never) as unknown as {
    insert: (row: unknown) => {
      select: (c: string) => {
        single: () => Promise<{
          data: { id: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
    update: (patch: unknown) => {
      eq: (k: string, v: string) => Promise<{
        error: { message: string } | null;
      }>;
    };
    delete: () => {
      eq: (k: string, v: string) => Promise<{
        error: { message: string } | null;
      }>;
    };
    select: (c: string) => {
      eq: (k: string, v: string) => {
        single: () => Promise<{
          data: Record<string, unknown> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

async function fetchTargetCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  partnerId: string,
  segmentId: string | null
): Promise<number> {
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{ data: unknown[] | null }>;
      };
    };
  };

  if (segmentId) {
    const { data: segRows } = await client
      .from("partner_segments")
      .select("member_count")
      .eq("id", segmentId);
    const first = (segRows ?? [])[0] as { member_count?: number } | undefined;
    return first?.member_count ?? 0;
  }

  // 전체: partner_customers count
  const { data: custRows } = await client
    .from("partner_customers")
    .select("id")
    .eq("partner_id", partnerId);
  return (custRows ?? []).length;
}

// ---------- actions ----------

export async function createCampaignAction(formData: FormData) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const name = str(formData.get("name"));
  if (!name) throw new Error("캠페인 이름을 입력해 주세요");

  const goal = strOrNull(formData.get("goal"));
  const target_segment_id = strOrNull(formData.get("target_segment_id"));
  const channels = multiStrings(formData, "channels");
  const message_title = strOrNull(formData.get("message_title"));
  const message_body = strOrNull(formData.get("message_body"));
  const message_cta_url = strOrNull(formData.get("message_cta_url"));
  const schedule_type =
    strOrNull(formData.get("schedule_type")) ?? "IMMEDIATE";
  const scheduled_at = strOrNull(formData.get("scheduled_at"));

  const row = {
    partner_id: partner.id,
    name,
    goal,
    target_segment_id,
    target_filter: null,
    channels,
    message_title,
    message_body,
    message_cta_url,
    schedule_type,
    scheduled_at,
    recurring_rule: null,
    status: "DRAFT" as const,
    sent_count: 0,
    opened_count: 0,
    clicked_count: 0,
    converted_count: 0,
  };

  const { data, error } = await campaignsTable(supabase)
    .insert(row)
    .select("id")
    .single();

  if (error || !data) {
    console.error("[campaigns/create] error", error);
    throw new Error(`캠페인 생성 실패: ${error?.message ?? "unknown"}`);
  }

  revalidatePath("/partner/marketing/campaigns");
  redirect(`/partner/marketing/campaigns/${data.id}`);
}

export async function updateCampaignAction(id: string, formData: FormData) {
  await requirePartner();
  const supabase = await createClient();

  const patch: Record<string, unknown> = {
    name: str(formData.get("name")),
    goal: strOrNull(formData.get("goal")),
    target_segment_id: strOrNull(formData.get("target_segment_id")),
    channels: multiStrings(formData, "channels"),
    message_title: strOrNull(formData.get("message_title")),
    message_body: strOrNull(formData.get("message_body")),
    message_cta_url: strOrNull(formData.get("message_cta_url")),
    schedule_type:
      strOrNull(formData.get("schedule_type")) ?? "IMMEDIATE",
    scheduled_at: strOrNull(formData.get("scheduled_at")),
  };

  const { error } = await campaignsTable(supabase).update(patch).eq("id", id);
  if (error) throw new Error(`캠페인 수정 실패: ${error.message}`);

  revalidatePath("/partner/marketing/campaigns");
  revalidatePath(`/partner/marketing/campaigns/${id}`);
}

export async function sendCampaignAction(id: string) {
  const partner = await requirePartner();
  const supabase = await createClient();

  // 1) 캠페인 로드
  const { data: campaign, error: loadErr } = await campaignsTable(supabase)
    .select(
      "id,partner_id,target_segment_id,channels,message_title,message_body,status"
    )
    .eq("id", id)
    .single();

  if (loadErr || !campaign) {
    throw new Error(`캠페인을 찾을 수 없어요: ${loadErr?.message ?? ""}`);
  }

  // 2) SENDING으로 전환
  const { error: sendErr } = await campaignsTable(supabase)
    .update({ status: "SENDING" })
    .eq("id", id);
  if (sendErr) throw new Error(`발송 시작 실패: ${sendErr.message}`);

  // 3) 대상 수 계산 (mock: 실제 발송 없음)
  const targetSegmentId = (campaign as { target_segment_id?: string | null })
    .target_segment_id ?? null;
  const targetCount = await fetchTargetCount(
    supabase,
    partner.id,
    targetSegmentId
  );

  console.log(
    `[campaigns/send] id=${id} target=${targetCount}명 channels=${JSON.stringify(
      (campaign as { channels?: unknown }).channels
    )} title=${String((campaign as { message_title?: unknown }).message_title ?? "")}`
  );

  // 4) SENT로 전환 + sent_count 업데이트
  const { error: doneErr } = await campaignsTable(supabase)
    .update({
      status: "SENT",
      sent_count: targetCount,
    })
    .eq("id", id);
  if (doneErr) throw new Error(`발송 완료 처리 실패: ${doneErr.message}`);

  revalidatePath("/partner/marketing/campaigns");
  revalidatePath(`/partner/marketing/campaigns/${id}`);
}

export async function scheduleCampaignAction(id: string, scheduledAt: string) {
  await requirePartner();
  const supabase = await createClient();

  if (!scheduledAt) throw new Error("발송 시점을 선택해 주세요");

  const { error } = await campaignsTable(supabase)
    .update({
      status: "SCHEDULED",
      schedule_type: "SCHEDULED",
      scheduled_at: scheduledAt,
    })
    .eq("id", id);

  if (error) throw new Error(`예약 실패: ${error.message}`);

  revalidatePath("/partner/marketing/campaigns");
  revalidatePath(`/partner/marketing/campaigns/${id}`);
}

export async function pauseCampaignAction(id: string) {
  await requirePartner();
  const supabase = await createClient();

  const { error } = await campaignsTable(supabase)
    .update({ status: "PAUSED" })
    .eq("id", id);

  if (error) throw new Error(`일시중지 실패: ${error.message}`);

  revalidatePath("/partner/marketing/campaigns");
  revalidatePath(`/partner/marketing/campaigns/${id}`);
}

export async function deleteCampaignAction(id: string) {
  await requirePartner();
  const supabase = await createClient();

  const { error } = await campaignsTable(supabase).delete().eq("id", id);
  if (error) throw new Error(`캠페인 삭제 실패: ${error.message}`);

  revalidatePath("/partner/marketing/campaigns");
  redirect("/partner/marketing/campaigns");
}
