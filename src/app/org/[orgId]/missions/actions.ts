"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadAvailableMissionsForOrg } from "@/lib/missions/queries";
import type {
  ApprovalMode,
  LayoutMode,
  OrgMissionRow,
  OrgQuestPackRow,
  PartnerMissionRow,
  PartnerMissionAssignmentRow,
  PartnerStampbookPresetRow,
  QuestPackStatus,
  StampIconSet,
  UnlockRule,
} from "@/lib/missions/types";

type Row = Record<string, unknown>;

const UNLOCK_RULES = new Set<UnlockRule>([
  "ALWAYS",
  "SEQUENTIAL",
  "TIER_GATE",
]);

const APPROVAL_MODES = new Set<ApprovalMode>([
  "AUTO",
  "MANUAL_TEACHER",
  "AUTO_24H",
  "PARTNER_REVIEW",
]);

const LAYOUT_MODES = new Set<LayoutMode>(["GRID", "LIST", "TRAIL_MAP"]);
const STAMP_ICON_SETS = new Set<StampIconSet>(["FOREST", "ANIMAL", "SEASON"]);

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

function floatOrNull(value: FormDataEntryValue | null): number | null {
  const s = str(value);
  if (s === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function toIsoOrNull(value: FormDataEntryValue | null): string | null {
  const s = str(value);
  if (s === "") return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function loadPartnerMissionRaw(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<PartnerMissionRow | null> {
  const resp = (await (
    supabase.from("partner_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: PartnerMissionRow | null;
          }>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as { data: PartnerMissionRow | null };
  return resp.data ?? null;
}

async function partnerMissionAssignedToOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  missionId: string,
  orgId: string
): Promise<boolean> {
  const resp = (await (
    supabase.from("partner_mission_assignments" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (
            k: string,
            v: string
          ) => Promise<{ data: PartnerMissionAssignmentRow[] | null }>;
        };
      };
    }
  )
    .select("*")
    .eq("mission_id", missionId)
    .eq("org_id", orgId)) as { data: PartnerMissionAssignmentRow[] | null };
  return (resp.data ?? []).length > 0;
}

async function loadOrgMissionOwned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  orgId: string
): Promise<OrgMissionRow | null> {
  const resp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: OrgMissionRow | null }>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as { data: OrgMissionRow | null };
  const row = resp.data ?? null;
  if (!row) return null;
  if (row.org_id !== orgId) return null;
  return row;
}

async function loadOrgQuestPackOwned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  orgId: string
): Promise<OrgQuestPackRow | null> {
  const resp = (await (
    supabase.from("org_quest_packs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: OrgQuestPackRow | null }>;
        };
      };
    }
  )
    .select("*")
    .eq("id", id)
    .maybeSingle()) as { data: OrgQuestPackRow | null };
  const row = resp.data ?? null;
  if (!row) return null;
  if (row.org_id !== orgId) return null;
  return row;
}

async function countMissionsInPack(
  supabase: Awaited<ReturnType<typeof createClient>>,
  packId: string
): Promise<number> {
  const resp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (
        c: string,
        opt?: { count?: "exact"; head?: boolean }
      ) => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ count: number | null }>;
      };
    }
  )
    .select("id", { count: "exact", head: true })
    .eq("quest_pack_id", packId)) as { count: number | null };
  return resp.count ?? 0;
}

/* -------------------------------------------------------------------------- */
/* Copy partner mission → org_missions                                        */
/* -------------------------------------------------------------------------- */

export async function copyToOrgAction(
  partnerMissionId: string,
  questPackId?: string
): Promise<void> {
  const session = await requireOrg();
  const supabase = await createClient();

  const partnerMission = await loadPartnerMissionRaw(supabase, partnerMissionId);
  if (!partnerMission) throw new Error("지사 미션을 찾을 수 없어요");

  if (partnerMission.status !== "PUBLISHED") {
    throw new Error("아직 게시되지 않은 미션은 복사할 수 없어요");
  }

  // visibility 검증
  if (partnerMission.visibility === "ALL") {
    // OK
  } else if (partnerMission.visibility === "SELECTED") {
    const assigned = await partnerMissionAssignedToOrg(
      supabase,
      partnerMissionId,
      session.orgId
    );
    if (!assigned) throw new Error("이 미션은 우리 기관에 배포되지 않았어요");
  } else {
    throw new Error("이 미션은 복사할 수 없어요");
  }

  // quest pack ownership
  let packForInsert: string | null = null;
  let nextOrder = 0;
  if (questPackId) {
    const pack = await loadOrgQuestPackOwned(
      supabase,
      questPackId,
      session.orgId
    );
    if (!pack) throw new Error("스탬프북을 찾을 수 없어요");
    packForInsert = pack.id;
    nextOrder = await countMissionsInPack(supabase, pack.id);
  }

  const cfg = (partnerMission.config_json ?? {}) as Record<string, unknown>;
  // deep copy via JSON
  const configCopy = JSON.parse(JSON.stringify(cfg)) as Record<string, unknown>;

  const row: Row = {
    org_id: session.orgId,
    quest_pack_id: packForInsert,
    source_mission_id: partnerMission.id,
    kind: partnerMission.kind,
    title: partnerMission.title,
    description: partnerMission.description,
    icon: partnerMission.icon,
    acorns: partnerMission.default_acorns,
    config_json: configCopy,
    display_order: nextOrder,
    unlock_rule: "ALWAYS" as UnlockRule,
    unlock_threshold: null,
    unlock_previous_id: null,
    approval_mode: "AUTO" as ApprovalMode,
    starts_at: null,
    ends_at: null,
    geofence_lat: null,
    geofence_lng: null,
    geofence_radius_m: null,
    is_active: true,
  };

  const { data, error } = await (
    supabase.from("org_missions" as never) as unknown as {
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
    throw new Error(`미션 복사 실패: ${error?.message ?? "unknown"}`);
  }

  revalidatePath(`/org/${session.orgId}/missions/catalog`);
  if (packForInsert) {
    revalidatePath(`/org/${session.orgId}/quest-packs/${packForInsert}/edit`);
  }
  redirect(`/org/${session.orgId}/missions/${data.id}/edit`);
}

/* -------------------------------------------------------------------------- */
/* Update org mission                                                         */
/* -------------------------------------------------------------------------- */

export async function updateOrgMissionAction(
  id: string,
  formData: FormData
): Promise<void> {
  const session = await requireOrg();
  const supabase = await createClient();

  const existing = await loadOrgMissionOwned(supabase, id, session.orgId);
  if (!existing) throw new Error("미션을 찾을 수 없어요");

  const title = str(formData.get("title"));
  if (!title) throw new Error("제목을 입력해 주세요");

  const description = strOrNull(formData.get("description"));
  const icon = strOrNull(formData.get("icon"));
  const acorns = Math.max(
    0,
    Math.min(100, intOrDefault(formData.get("acorns"), 0))
  );

  const unlockRuleRaw = str(formData.get("unlock_rule")) || "ALWAYS";
  if (!UNLOCK_RULES.has(unlockRuleRaw as UnlockRule)) {
    throw new Error("해금 규칙 값이 올바르지 않아요");
  }
  const unlock_rule = unlockRuleRaw as UnlockRule;

  let unlock_threshold: number | null = null;
  let unlock_previous_id: string | null = null;
  if (unlock_rule === "TIER_GATE") {
    const n = intOrDefault(formData.get("unlock_threshold"), 0);
    unlock_threshold = Math.max(0, n);
  } else if (unlock_rule === "SEQUENTIAL") {
    unlock_previous_id = strOrNull(formData.get("unlock_previous_id"));
  }

  const approvalModeRaw = str(formData.get("approval_mode")) || "AUTO";
  if (!APPROVAL_MODES.has(approvalModeRaw as ApprovalMode)) {
    throw new Error("승인 방식 값이 올바르지 않아요");
  }
  const approval_mode = approvalModeRaw as ApprovalMode;

  const starts_at = toIsoOrNull(formData.get("starts_at"));
  const ends_at = toIsoOrNull(formData.get("ends_at"));
  if (starts_at && ends_at && new Date(starts_at) > new Date(ends_at)) {
    throw new Error("시작 일시가 종료 일시보다 늦어요");
  }

  // geofence (optional)
  const geofence_lat = floatOrNull(formData.get("geofence_lat"));
  const geofence_lng = floatOrNull(formData.get("geofence_lng"));
  const geofence_radius_m = floatOrNull(formData.get("geofence_radius_m"));

  // is_active
  const isActiveRaw = str(formData.get("is_active"));
  const is_active = isActiveRaw === "" ? existing.is_active : isActiveRaw === "true";

  // config_json (kind-specific client-side sanitized JSON string)
  const configRaw = str(formData.get("config_json"));
  let config_json: Record<string, unknown> = (existing.config_json ??
    {}) as Record<string, unknown>;
  if (configRaw) {
    try {
      const parsed = JSON.parse(configRaw);
      if (parsed && typeof parsed === "object") {
        config_json = parsed as Record<string, unknown>;
      }
    } catch {
      throw new Error("설정 파싱에 실패했어요. 다시 시도해 주세요.");
    }
  }

  const patch: Row = {
    title,
    description,
    icon,
    acorns,
    config_json,
    unlock_rule,
    unlock_threshold,
    unlock_previous_id,
    approval_mode,
    starts_at,
    ends_at,
    geofence_lat,
    geofence_lng,
    geofence_radius_m,
    is_active,
    updated_at: new Date().toISOString(),
  };

  const { error } = await (
    supabase.from("org_missions" as never) as unknown as {
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

  if (error) throw new Error(`미션 저장 실패: ${error.message}`);

  revalidatePath(`/org/${session.orgId}/missions/${id}/edit`);
  if (existing.quest_pack_id) {
    revalidatePath(
      `/org/${session.orgId}/quest-packs/${existing.quest_pack_id}/edit`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Move mission display_order                                                 */
/* -------------------------------------------------------------------------- */

export async function moveMissionAction(
  id: string,
  direction: "UP" | "DOWN"
): Promise<void> {
  const session = await requireOrg();
  const supabase = await createClient();

  const existing = await loadOrgMissionOwned(supabase, id, session.orgId);
  if (!existing) throw new Error("미션을 찾을 수 없어요");
  if (!existing.quest_pack_id) {
    throw new Error("스탬프북에 담긴 미션이 아니에요");
  }

  // siblings sorted by display_order ASC
  const resp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: OrgMissionRow[] | null }>;
        };
      };
    }
  )
    .select("*")
    .eq("quest_pack_id", existing.quest_pack_id)
    .order("display_order", { ascending: true })) as {
    data: OrgMissionRow[] | null;
  };

  const list = resp.data ?? [];
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("미션 위치를 찾을 수 없어요");

  const neighborIdx = direction === "UP" ? idx - 1 : idx + 1;
  if (neighborIdx < 0 || neighborIdx >= list.length) return; // noop at edges

  const me = list[idx];
  const other = list[neighborIdx];

  const now = new Date().toISOString();

  // Swap display_order via two updates
  const { error: e1 } = await (
    supabase.from("org_missions" as never) as unknown as {
      update: (r: Row) => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({
      display_order: other.display_order,
      updated_at: now,
    })
    .eq("id", me.id);
  if (e1) throw new Error(`순서 변경 실패: ${e1.message}`);

  const { error: e2 } = await (
    supabase.from("org_missions" as never) as unknown as {
      update: (r: Row) => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({
      display_order: me.display_order,
      updated_at: now,
    })
    .eq("id", other.id);
  if (e2) throw new Error(`순서 변경 실패: ${e2.message}`);

  revalidatePath(
    `/org/${session.orgId}/quest-packs/${existing.quest_pack_id}/edit`
  );
}

/* -------------------------------------------------------------------------- */
/* Remove mission (hard delete for org-owned)                                 */
/* -------------------------------------------------------------------------- */

export async function removeMissionFromPackAction(id: string): Promise<void> {
  const session = await requireOrg();
  const supabase = await createClient();

  const existing = await loadOrgMissionOwned(supabase, id, session.orgId);
  if (!existing) throw new Error("미션을 찾을 수 없어요");

  const { error } = await (
    supabase.from("org_missions" as never) as unknown as {
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

  if (existing.quest_pack_id) {
    revalidatePath(
      `/org/${session.orgId}/quest-packs/${existing.quest_pack_id}/edit`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Quest pack CRUD                                                            */
/* -------------------------------------------------------------------------- */

function parsePackFormFields(formData: FormData): {
  name: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  layout_mode: LayoutMode;
  stamp_icon_set: StampIconSet;
  cover_image_url: string | null;
} {
  const name = str(formData.get("name"));
  if (!name) throw new Error("스탬프북 이름을 입력해 주세요");

  const description = strOrNull(formData.get("description"));
  const starts_at = toIsoOrNull(formData.get("starts_at"));
  const ends_at = toIsoOrNull(formData.get("ends_at"));
  if (starts_at && ends_at && new Date(starts_at) > new Date(ends_at)) {
    throw new Error("시작 일시가 종료 일시보다 늦어요");
  }

  const layoutRaw = str(formData.get("layout_mode")) || "GRID";
  if (!LAYOUT_MODES.has(layoutRaw as LayoutMode)) {
    throw new Error("레이아웃 값이 올바르지 않아요");
  }
  const layout_mode = layoutRaw as LayoutMode;

  const iconRaw = str(formData.get("stamp_icon_set")) || "FOREST";
  if (!STAMP_ICON_SETS.has(iconRaw as StampIconSet)) {
    throw new Error("스탬프 아이콘 세트 값이 올바르지 않아요");
  }
  const stamp_icon_set = iconRaw as StampIconSet;

  const cover_image_url = strOrNull(formData.get("cover_image_url"));

  return {
    name,
    description,
    starts_at,
    ends_at,
    layout_mode,
    stamp_icon_set,
    cover_image_url,
  };
}

export async function createQuestPackAction(
  orgId: string,
  formData: FormData
): Promise<void> {
  const session = await requireOrg();
  if (session.orgId !== orgId) {
    throw new Error("다른 기관의 스탬프북을 만들 수 없어요");
  }
  const supabase = await createClient();

  const fields = parsePackFormFields(formData);

  const row: Row = {
    org_id: session.orgId,
    name: fields.name,
    description: fields.description,
    trail_id: null,
    cover_image_url: fields.cover_image_url,
    layout_mode: fields.layout_mode,
    stamp_icon_set: fields.stamp_icon_set,
    completion_animation: "CELEBRATION",
    status: "DRAFT" as QuestPackStatus,
    starts_at: fields.starts_at,
    ends_at: fields.ends_at,
    tier_config: {},
  };

  const { data, error } = await (
    supabase.from("org_quest_packs" as never) as unknown as {
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
    throw new Error(`스탬프북 생성 실패: ${error?.message ?? "unknown"}`);
  }

  revalidatePath(`/org/${session.orgId}/quest-packs`);
  redirect(`/org/${session.orgId}/quest-packs/${data.id}/edit`);
}

export async function updateQuestPackAction(
  id: string,
  formData: FormData
): Promise<void> {
  const session = await requireOrg();
  const supabase = await createClient();

  const existing = await loadOrgQuestPackOwned(supabase, id, session.orgId);
  if (!existing) throw new Error("스탬프북을 찾을 수 없어요");

  const fields = parsePackFormFields(formData);

  const patch: Row = {
    name: fields.name,
    description: fields.description,
    starts_at: fields.starts_at,
    ends_at: fields.ends_at,
    layout_mode: fields.layout_mode,
    stamp_icon_set: fields.stamp_icon_set,
    cover_image_url: fields.cover_image_url,
    updated_at: new Date().toISOString(),
  };

  const { error } = await (
    supabase.from("org_quest_packs" as never) as unknown as {
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

  if (error) throw new Error(`스탬프북 저장 실패: ${error.message}`);

  revalidatePath(`/org/${session.orgId}/quest-packs`);
  revalidatePath(`/org/${session.orgId}/quest-packs/${id}/edit`);
}

async function setQuestPackStatus(
  id: string,
  status: QuestPackStatus
): Promise<void> {
  const session = await requireOrg();
  const supabase = await createClient();

  const existing = await loadOrgQuestPackOwned(supabase, id, session.orgId);
  if (!existing) throw new Error("스탬프북을 찾을 수 없어요");

  if (status === "LIVE") {
    if (!existing.name || existing.name.trim().length === 0) {
      throw new Error("이름을 먼저 입력해 주세요");
    }
    if (!existing.starts_at || !existing.ends_at) {
      throw new Error("시작·종료 일시를 먼저 설정해 주세요");
    }
    const missionCount = await countMissionsInPack(supabase, id);
    if (missionCount < 1) {
      throw new Error("최소 1개의 미션이 담겨 있어야 공개할 수 있어요");
    }
  }

  const patch: Row = {
    status,
    updated_at: new Date().toISOString(),
  };

  const { error } = await (
    supabase.from("org_quest_packs" as never) as unknown as {
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

  revalidatePath(`/org/${session.orgId}/quest-packs`);
  revalidatePath(`/org/${session.orgId}/quest-packs/${id}/edit`);
}

export async function publishQuestPackAction(id: string): Promise<void> {
  await setQuestPackStatus(id, "LIVE");
}

export async function endQuestPackAction(id: string): Promise<void> {
  await setQuestPackStatus(id, "ENDED");
}

export async function archiveQuestPackAction(id: string): Promise<void> {
  await setQuestPackStatus(id, "ARCHIVED");
}

export async function deleteQuestPackAction(id: string): Promise<void> {
  const session = await requireOrg();
  const supabase = await createClient();

  const existing = await loadOrgQuestPackOwned(supabase, id, session.orgId);
  if (!existing) throw new Error("스탬프북을 찾을 수 없어요");

  if (existing.status === "LIVE") {
    throw new Error(
      "공개중인 스탬프북은 바로 삭제할 수 없어요. 먼저 '종료' 또는 '보관'을 눌러 주세요."
    );
  }

  const { error } = await (
    supabase.from("org_quest_packs" as never) as unknown as {
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

  revalidatePath(`/org/${session.orgId}/quest-packs`);
}

/* -------------------------------------------------------------------------- */
/* Create a quest pack from a partner stampbook preset                        */
/* -------------------------------------------------------------------------- */

async function loadPresetByIdRaw(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
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
  return resp.data ?? null;
}

export async function createPackFromPresetAction(
  orgId: string,
  presetId: string
): Promise<void> {
  const session = await requireOrg();
  if (session.orgId !== orgId) {
    throw new Error("다른 기관의 스탬프북은 만들 수 없어요");
  }
  const supabase = await createClient();

  // 1) 프리셋 로드 — 공개 상태여야 함
  const preset = await loadPresetByIdRaw(supabase, presetId);
  if (!preset) throw new Error("프리셋을 찾을 수 없어요");
  if (!preset.is_published) {
    throw new Error("아직 공개되지 않은 프리셋이에요");
  }

  // 1-1) visibility + 소유권 검증
  //   - preset.partner_id === org.partner_id (같은 지사 산하 기관이어야 함)
  //   - visibility 가 PRIVATE 이면 거부
  //   - SELECTED_ORGS 이면 grants 에 이 기관이 있어야 함
  const orgResp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { partner_id: string } | null;
          }>;
        };
      };
    }
  )
    .select("partner_id")
    .eq("id", orgId)
    .maybeSingle()) as { data: { partner_id: string } | null };

  const orgPartnerId = orgResp.data?.partner_id;
  if (!orgPartnerId) throw new Error("기관 정보를 찾을 수 없어요");
  if (preset.partner_id !== orgPartnerId) {
    throw new Error("다른 지사의 프리셋은 사용할 수 없어요");
  }
  if (preset.visibility === "PRIVATE") {
    throw new Error("이 프리셋은 비공개 상태예요");
  }
  if (preset.visibility === "SELECTED_ORGS") {
    const grantResp = (await (
      supabase.from(
        "partner_stampbook_preset_org_grants" as never
      ) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{
                data: { preset_id: string } | null;
              }>;
            };
          };
        };
      }
    )
      .select("preset_id")
      .eq("preset_id", presetId)
      .eq("org_id", orgId)
      .maybeSingle()) as { data: { preset_id: string } | null };
    if (!grantResp.data) {
      throw new Error("이 기관에는 공유되지 않은 프리셋이에요");
    }
  }

  const missionIds = preset.mission_ids ?? [];
  if (missionIds.length === 0) {
    throw new Error("미션이 담기지 않은 프리셋이에요");
  }

  // 2) 기관에 배포된 미션 풀 조회 → 프리셋 mission_id 전부 포함인지 검증
  const availableMissions = await loadAvailableMissionsForOrg(orgId);
  const availableSet = new Set(availableMissions.map((m) => m.id));
  const missingIds = missionIds.filter((mid) => !availableSet.has(mid));
  if (missingIds.length > 0) {
    throw new Error(
      "이 프리셋의 일부 미션이 우리 기관에 배포되지 않았어요. 지사에 확인해 주세요."
    );
  }

  // 3) 팩 생성 (DRAFT)
  const koDate = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const packName = `${preset.name} (${koDate})`;

  const packRow: Record<string, unknown> = {
    org_id: session.orgId,
    name: packName,
    description: preset.description,
    trail_id: null,
    cover_image_url: preset.cover_image_url,
    layout_mode: "GRID" as LayoutMode,
    stamp_icon_set: "FOREST" as StampIconSet,
    completion_animation: "CELEBRATION",
    status: "DRAFT" as QuestPackStatus,
    starts_at: null,
    ends_at: null,
    tier_config: {},
  };

  const { data: packInserted, error: packErr } = await (
    supabase.from("org_quest_packs" as never) as unknown as {
      insert: (r: Record<string, unknown>) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .insert(packRow)
    .select("id")
    .single();

  if (packErr || !packInserted) {
    throw new Error(
      `스탬프북 생성 실패: ${packErr?.message ?? "unknown"}`
    );
  }
  const newPackId = packInserted.id;

  // 4) 각 partner_mission 을 org_missions 로 복사 (순서는 preset.mission_ids 기준)
  const missionMap = new Map<string, PartnerMissionRow>();
  for (const m of availableMissions) missionMap.set(m.id, m);

  for (let i = 0; i < missionIds.length; i++) {
    const mid = missionIds[i];
    const pm = missionMap.get(mid);
    if (!pm) continue; // 이론적으로 없음(위에서 검증)

    const configCopy = JSON.parse(
      JSON.stringify(pm.config_json ?? {})
    ) as Record<string, unknown>;

    const row: Record<string, unknown> = {
      org_id: session.orgId,
      quest_pack_id: newPackId,
      source_mission_id: pm.id,
      kind: pm.kind,
      title: pm.title,
      description: pm.description,
      icon: pm.icon,
      acorns: pm.default_acorns,
      config_json: configCopy,
      display_order: i,
      unlock_rule: "ALWAYS" as UnlockRule,
      unlock_threshold: null,
      unlock_previous_id: null,
      approval_mode: "AUTO" as ApprovalMode,
      starts_at: null,
      ends_at: null,
      geofence_lat: null,
      geofence_lng: null,
      geofence_radius_m: null,
      is_active: true,
    };

    const { error: insErr } = await (
      supabase.from("org_missions" as never) as unknown as {
        insert: (
          r: Record<string, unknown>
        ) => Promise<{ error: { message: string } | null }>;
      }
    ).insert(row);

    if (insErr) {
      throw new Error(
        `미션 복사 실패 (${pm.title}): ${insErr.message}`
      );
    }
  }

  revalidatePath(`/org/${session.orgId}/quest-packs`);
  revalidatePath(`/org/${session.orgId}/quest-packs/${newPackId}/edit`);
  redirect(`/org/${session.orgId}/quest-packs/${newPackId}/edit`);
}
