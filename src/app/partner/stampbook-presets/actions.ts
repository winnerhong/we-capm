"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import {
  PRESET_CATEGORY_OPTIONS,
  type PartnerStampbookPresetRow,
  type PresetVisibility,
} from "@/lib/missions/types";

const COVER_URL_MAX_LEN = 2048;

/**
 * cover_image_url 유효성 검증.
 *  - null 허용
 *  - 길이 cap 2048
 *  - 스킴은 https:// 만 허용 (커버 업로드 버킷은 public https)
 * 문자열이 들어왔지만 조건 위반이면 throw.
 */
function validateCoverUrl(value: string | null): string | null {
  if (value === null) return null;
  if (value.length > COVER_URL_MAX_LEN) {
    throw new Error("커버 이미지 URL 이 너무 길어요");
  }
  if (!/^https:\/\//i.test(value)) {
    throw new Error("커버 이미지 URL 은 https:// 로 시작해야 해요");
  }
  return value;
}

type Row = Record<string, unknown>;

function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function strOrNull(value: FormDataEntryValue | null): string | null {
  const s = str(value);
  return s === "" ? null : s;
}

function intOrDefault(value: FormDataEntryValue | null, dflt: number): number {
  const s = str(value);
  if (s === "") return dflt;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : dflt;
}

/**
 * formData 의 mission_ids[] (복수 필드) 또는 mission_ids_json (단일 JSON 문자열) 파싱.
 * 순서 보존.
 */
function parseMissionIds(formData: FormData): string[] {
  // 우선 JSON 형태 시도
  const rawJson = str(formData.get("mission_ids_json"));
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        const cleaned: string[] = [];
        for (const v of parsed) {
          if (typeof v === "string" && v.trim()) cleaned.push(v.trim());
        }
        return cleaned;
      }
    } catch {
      // fallthrough
    }
  }
  const multi = formData.getAll("mission_ids");
  const out: string[] = [];
  for (const v of multi) {
    const s = String(v ?? "").trim();
    if (s) out.push(s);
  }
  return out;
}

/**
 * formData 의 category 는 여러 번 전송 가능 (chip UI 가 `category` 필드를 중복 append).
 * 유효한 PRESET_CATEGORY_OPTIONS.value 만 통과, 중복 제거, 순서 보존.
 */
function parseCategories(formData: FormData): string[] {
  const valid = new Set(PRESET_CATEGORY_OPTIONS.map((c) => c.value));
  const raw = formData.getAll("category");
  const arr: string[] = [];
  for (const v of raw) {
    const s = String(v ?? "").trim();
    if (valid.has(s)) arr.push(s);
  }
  return Array.from(new Set(arr));
}

async function loadPresetOwned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  partnerId: string
): Promise<PartnerStampbookPresetRow | null> {
  const resp = (await (
    supabase.from("partner_stampbook_presets" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: PartnerStampbookPresetRow | null;
          }>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as { data: PartnerStampbookPresetRow | null };
  const row = resp.data ?? null;
  if (!row) return null;
  if (row.partner_id !== partnerId) return null;
  return row;
}

/**
 * mission_ids 전부 partnerId 의 소유인지 확인.
 * true 면 모두 owned, false 면 하나라도 miss.
 */
async function verifyMissionsOwnedByPartner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  missionIds: string[],
  partnerId: string
): Promise<boolean> {
  if (missionIds.length === 0) return true;
  const resp = (await (
    supabase.from("partner_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          in: (k: string, v: string[]) => Promise<{
            data: Array<{ id: string }> | null;
          }>;
        };
      };
    }
  )
    .select("id")
    .eq("partner_id", partnerId)
    .in("id", missionIds)) as { data: Array<{ id: string }> | null };
  const owned = new Set((resp.data ?? []).map((r) => r.id));
  for (const mid of missionIds) {
    if (!owned.has(mid)) return false;
  }
  return true;
}

function parseVisibility(raw: string): PresetVisibility {
  return raw === "ALL_ORGS" || raw === "SELECTED_ORGS" ? raw : "PRIVATE";
}

/** selected_org_ids_json = string[] (JSON) 파싱. 중복 제거. */
function parseSelectedOrgIds(formData: FormData): string[] {
  const raw = str(formData.get("selected_org_ids_json"));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const set = new Set<string>();
    for (const v of parsed) {
      if (typeof v === "string" && v.trim()) set.add(v.trim());
    }
    return Array.from(set);
  } catch {
    return [];
  }
}

function parsePresetFields(formData: FormData): {
  name: string;
  description: string | null;
  slot_count: number;
  recommended_for_age: string | null;
  cover_image_url: string | null;
  mission_ids: string[];
  visibility: PresetVisibility;
  selected_org_ids: string[];
  category: string[];
} {
  const name = str(formData.get("name"));
  if (!name) throw new Error("프리셋 이름을 입력해 주세요");

  const description = strOrNull(formData.get("description"));
  const slot_count = intOrDefault(formData.get("slot_count"), 10);
  if (slot_count < 1 || slot_count > 30) {
    throw new Error("칸 수는 1~30 사이여야 해요");
  }

  const recommended_for_age = strOrNull(formData.get("recommended_for_age"));
  const cover_image_url = validateCoverUrl(
    strOrNull(formData.get("cover_image_url"))
  );
  const mission_ids = parseMissionIds(formData);

  if (mission_ids.length > slot_count) {
    throw new Error(
      `미션 개수(${mission_ids.length})가 칸 수(${slot_count})를 넘을 수 없어요`
    );
  }

  const visibility = parseVisibility(str(formData.get("visibility")));
  const selected_org_ids =
    visibility === "SELECTED_ORGS" ? parseSelectedOrgIds(formData) : [];
  const category = parseCategories(formData);

  return {
    name,
    description,
    slot_count,
    recommended_for_age,
    cover_image_url,
    mission_ids,
    visibility,
    selected_org_ids,
    category,
  };
}

/**
 * 해당 지사의 기관 id 목록 — 선택 공유 시 소유권 검증용.
 */
async function loadPartnerOwnedOrgIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  partnerId: string
): Promise<Set<string>> {
  const resp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ data: Array<{ id: string }> | null }>;
      };
    }
  )
    .select("id")
    .eq("partner_id", partnerId)) as {
    data: Array<{ id: string }> | null;
  };
  return new Set((resp.data ?? []).map((r) => r.id));
}

/**
 * grants 테이블 reconcile — diff 기반 INSERT/DELETE.
 * presetId 에 대해 nextOrgIds 집합을 맞춥니다. 기존과 비교해 최소한의 변경만 수행.
 */
async function reconcilePresetGrants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  presetId: string,
  nextOrgIds: string[]
): Promise<void> {
  // 현재 grants
  const curResp = (await (
    supabase.from(
      "partner_stampbook_preset_org_grants" as never
    ) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ data: Array<{ org_id: string }> | null }>;
      };
    }
  )
    .select("org_id")
    .eq("preset_id", presetId)) as {
    data: Array<{ org_id: string }> | null;
  };
  const current = new Set((curResp.data ?? []).map((r) => r.org_id));
  const next = new Set(nextOrgIds);

  const toInsert = Array.from(next).filter((id) => !current.has(id));
  const toDelete = Array.from(current).filter((id) => !next.has(id));

  if (toInsert.length > 0) {
    const rows: Row[] = toInsert.map((org_id) => ({
      preset_id: presetId,
      org_id,
    }));
    const { error } = (await (
      supabase.from(
        "partner_stampbook_preset_org_grants" as never
      ) as unknown as {
        insert: (r: Row[]) => Promise<{ error: { message: string } | null }>;
      }
    ).insert(rows)) as { error: { message: string } | null };
    if (error) throw new Error(`공유 대상 추가 실패: ${error.message}`);
  }

  if (toDelete.length > 0) {
    const { error } = (await (
      supabase.from(
        "partner_stampbook_preset_org_grants" as never
      ) as unknown as {
        delete: () => {
          eq: (
            k: string,
            v: string
          ) => {
            in: (
              k: string,
              v: string[]
            ) => Promise<{ error: { message: string } | null }>;
          };
        };
      }
    )
      .delete()
      .eq("preset_id", presetId)
      .in("org_id", toDelete)) as { error: { message: string } | null };
    if (error) throw new Error(`공유 대상 삭제 실패: ${error.message}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createStampbookPresetAction(
  formData: FormData
): Promise<void> {
  const partner = await requirePartner();
  if (partner.role === "VIEWER") {
    throw new Error("뷰어 권한으로는 프리셋을 만들 수 없어요");
  }

  const supabase = await createClient();
  const fields = parsePresetFields(formData);

  // 미션 소유권 검증
  if (fields.mission_ids.length > 0) {
    const ok = await verifyMissionsOwnedByPartner(
      supabase,
      fields.mission_ids,
      partner.id
    );
    if (!ok) {
      throw new Error("다른 지사의 미션을 프리셋에 담을 수 없어요");
    }
  }

  // SELECTED_ORGS 인데 선택된 기관이 다른 지사 소유이거나 존재하지 않으면 거부
  if (
    fields.visibility === "SELECTED_ORGS" &&
    fields.selected_org_ids.length > 0
  ) {
    const owned = await loadPartnerOwnedOrgIds(supabase, partner.id);
    for (const oid of fields.selected_org_ids) {
      if (!owned.has(oid)) {
        throw new Error("다른 지사의 기관은 공유 대상에 담을 수 없어요");
      }
    }
  }

  const row: Row = {
    partner_id: partner.id,
    name: fields.name,
    description: fields.description,
    slot_count: fields.slot_count,
    mission_ids: fields.mission_ids,
    cover_image_url: fields.cover_image_url,
    recommended_for_age: fields.recommended_for_age,
    is_published: false,
    visibility: fields.visibility,
    category: fields.category,
  };

  const { data, error } = await (
    supabase.from("partner_stampbook_presets" as never) as unknown as {
      insert: (r: Row) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .insert(row)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`프리셋 생성 실패: ${error?.message ?? "unknown"}`);
  }

  if (fields.visibility === "SELECTED_ORGS") {
    await reconcilePresetGrants(
      supabase,
      data.id,
      fields.selected_org_ids
    );
  }

  revalidatePath("/partner/stampbook-presets");
  redirect(`/partner/stampbook-presets/${data.id}/edit`);
}

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateStampbookPresetAction(
  id: string,
  formData: FormData
): Promise<void> {
  const partner = await requirePartner();
  if (partner.role === "VIEWER") {
    throw new Error("뷰어 권한으로는 프리셋을 수정할 수 없어요");
  }

  const supabase = await createClient();
  const existing = await loadPresetOwned(supabase, id, partner.id);
  if (!existing) throw new Error("프리셋을 찾을 수 없어요");

  const fields = parsePresetFields(formData);
  if (fields.mission_ids.length > 0) {
    const ok = await verifyMissionsOwnedByPartner(
      supabase,
      fields.mission_ids,
      partner.id
    );
    if (!ok) {
      throw new Error("다른 지사의 미션을 프리셋에 담을 수 없어요");
    }
  }

  if (
    fields.visibility === "SELECTED_ORGS" &&
    fields.selected_org_ids.length > 0
  ) {
    const owned = await loadPartnerOwnedOrgIds(supabase, partner.id);
    for (const oid of fields.selected_org_ids) {
      if (!owned.has(oid)) {
        throw new Error("다른 지사의 기관은 공유 대상에 담을 수 없어요");
      }
    }
  }

  const patch: Row = {
    name: fields.name,
    description: fields.description,
    slot_count: fields.slot_count,
    mission_ids: fields.mission_ids,
    cover_image_url: fields.cover_image_url,
    recommended_for_age: fields.recommended_for_age,
    visibility: fields.visibility,
    category: fields.category,
    updated_at: new Date().toISOString(),
  };

  const { error } = await (
    supabase.from("partner_stampbook_presets" as never) as unknown as {
      update: (r: Row) => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update(patch)
    .eq("id", id);

  if (error) throw new Error(`프리셋 저장 실패: ${error.message}`);

  // grants reconcile:
  //  - SELECTED_ORGS: 선택 목록으로 맞춤
  //  - 그 외(PRIVATE / ALL_ORGS): grants 전부 제거 (잔여 방지)
  await reconcilePresetGrants(
    supabase,
    id,
    fields.visibility === "SELECTED_ORGS" ? fields.selected_org_ids : []
  );

  revalidatePath("/partner/stampbook-presets");
  revalidatePath(`/partner/stampbook-presets/${id}/edit`);
}

/* -------------------------------------------------------------------------- */
/* Publish / Unpublish                                                        */
/* -------------------------------------------------------------------------- */

async function setPublished(id: string, published: boolean): Promise<void> {
  const partner = await requirePartner();
  if (partner.role === "VIEWER") {
    throw new Error("뷰어 권한으로는 상태를 변경할 수 없어요");
  }
  const supabase = await createClient();
  const existing = await loadPresetOwned(supabase, id, partner.id);
  if (!existing) throw new Error("프리셋을 찾을 수 없어요");

  if (published) {
    if (!existing.mission_ids || existing.mission_ids.length === 0) {
      throw new Error("미션을 1개 이상 담아야 공개할 수 있어요");
    }
  }

  const patch: Row = {
    is_published: published,
    updated_at: new Date().toISOString(),
  };

  const { error } = await (
    supabase.from("partner_stampbook_presets" as never) as unknown as {
      update: (r: Row) => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update(patch)
    .eq("id", id);

  if (error) throw new Error(`상태 변경 실패: ${error.message}`);

  revalidatePath("/partner/stampbook-presets");
  revalidatePath(`/partner/stampbook-presets/${id}/edit`);
}

export async function publishStampbookPresetAction(id: string): Promise<void> {
  await setPublished(id, true);
}

export async function unpublishStampbookPresetAction(
  id: string
): Promise<void> {
  await setPublished(id, false);
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteStampbookPresetAction(id: string): Promise<void> {
  const partner = await requirePartner();
  if (partner.role === "VIEWER") {
    throw new Error("뷰어 권한으로는 프리셋을 삭제할 수 없어요");
  }
  const supabase = await createClient();
  const existing = await loadPresetOwned(supabase, id, partner.id);
  if (!existing) throw new Error("프리셋을 찾을 수 없어요");

  const { error } = await (
    supabase.from("partner_stampbook_presets" as never) as unknown as {
      delete: () => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .delete()
    .eq("id", id);

  if (error) throw new Error(`삭제 실패: ${error.message}`);

  revalidatePath("/partner/stampbook-presets");
  redirect("/partner/stampbook-presets");
}

