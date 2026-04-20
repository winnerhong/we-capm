"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CampaignPortal = "FAMILY" | "ORG" | "PARTNER" | "TALK";
export type CampaignPlacement = "BANNER" | "CARD" | "INLINE" | "POPUP";
export type CampaignStatus = "DRAFT" | "PENDING" | "ACTIVE" | "PAUSED" | "ENDED";

// Stage 1: 실제 로그인이 없으므로 고정 광고주명 사용 (추후 Stage 2에서 세션으로 교체)
const DEFAULT_ADVERTISER_NAME = "숲속 정령 (Stage 1 프리뷰)";

function toNumber(value: FormDataEntryValue | null, fallback = 0): number {
  if (value === null) return fallback;
  const s = String(value).trim();
  if (s === "") return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function toDateISO(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const s = String(value).trim();
  if (s === "") return null;
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function toTrimmedOrNull(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

const VALID_PORTALS: CampaignPortal[] = ["FAMILY", "ORG", "PARTNER", "TALK"];
const VALID_PLACEMENTS: CampaignPlacement[] = ["BANNER", "CARD", "INLINE", "POPUP"];
const VALID_STATUSES: CampaignStatus[] = ["DRAFT", "PENDING", "ACTIVE", "PAUSED", "ENDED"];

export async function createCampaignAction(formData: FormData) {
  const supabase = await createClient();

  const advertiser_name =
    String(formData.get("advertiser_name") ?? "").trim() || DEFAULT_ADVERTISER_NAME;
  const title = String(formData.get("title") ?? "").trim();
  const description = toTrimmedOrNull(formData.get("description"));
  const creative_url = toTrimmedOrNull(formData.get("creative_url"));

  const target_portal_raw = String(formData.get("target_portal") ?? "").trim();
  const target_portal = VALID_PORTALS.includes(target_portal_raw as CampaignPortal)
    ? (target_portal_raw as CampaignPortal)
    : null;

  const placement_raw = String(formData.get("placement") ?? "").trim();
  const placement = VALID_PLACEMENTS.includes(placement_raw as CampaignPlacement)
    ? (placement_raw as CampaignPlacement)
    : null;

  const target_region = toTrimmedOrNull(formData.get("target_region"));
  const target_age_group = toTrimmedOrNull(formData.get("target_age_group"));
  const budget = Math.max(0, Math.round(toNumber(formData.get("budget"), 0)));
  const start_date = toDateISO(formData.get("start_date"));
  const end_date = toDateISO(formData.get("end_date"));

  if (!title) throw new Error("캠페인 제목을 입력해 주세요");
  if (!target_portal) throw new Error("타겟 포털을 선택해 주세요");
  if (!placement) throw new Error("광고 영역을 선택해 주세요");
  if (budget <= 0) throw new Error("예산을 올바르게 입력해 주세요");

  // Stage 1: 모든 신규 캠페인은 PENDING(검토 대기) 상태로 저장
  const insertPayload = {
    advertiser_name,
    title,
    description,
    creative_url,
    target_portal,
    target_region,
    target_age_group,
    placement,
    budget,
    spent: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    start_date,
    end_date,
    status: "PENDING" as CampaignStatus,
  };

  const { error } = await supabase.from("ad_campaigns").insert(insertPayload as never);

  if (error) throw new Error(error.message);

  revalidatePath("/ads-portal/campaigns");
  redirect("/ads-portal/campaigns?submitted=1");
}

export async function updateCampaignStatusAction(id: string, status: string) {
  if (!VALID_STATUSES.includes(status as CampaignStatus)) {
    throw new Error("올바르지 않은 상태입니다");
  }
  const supabase = await createClient();

  const { error } = await supabase
    .from("ad_campaigns")
    .update({ status: status as CampaignStatus } as never)
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/ads-portal/campaigns");
}

export async function deleteCampaignAction(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("ad_campaigns").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/ads-portal/campaigns");
}
