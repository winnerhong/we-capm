"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import { generateQrCode } from "@/lib/trails/qr-code";

// ---------- helpers ----------

function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function strOrNull(value: FormDataEntryValue | null): string | null {
  const s = str(value);
  return s === "" ? null : s;
}

function numOrNull(value: FormDataEntryValue | null): number | null {
  const s = str(value);
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(value: FormDataEntryValue | null): number | null {
  const s = str(value);
  if (s === "") return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function intOrDefault(value: FormDataEntryValue | null, dflt: number): number {
  const n = intOrNull(value);
  return n === null ? dflt : n;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\-가-힣]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const suffix = Math.random().toString(36).slice(2, 7);
  return base ? `${base}-${suffix}` : `trail-${suffix}`;
}

type Row = Record<string, unknown>;

function buildMissionConfig(
  missionType: string,
  formData: FormData
): Record<string, unknown> {
  switch (missionType) {
    case "PHOTO":
      return {
        min_photos: intOrDefault(formData.get("cfg_min_photos"), 1),
      };
    case "QUIZ":
      return {
        question: str(formData.get("cfg_question")),
        answer: str(formData.get("cfg_answer")),
      };
    case "LOCATION":
      return {
        radius_m: intOrDefault(formData.get("cfg_radius_m"), 30),
      };
    case "CHECKIN":
    default:
      return {};
  }
}

async function recountSlots(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trailId: string
): Promise<number> {
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (
        c: string,
        opt?: { count?: "exact"; head?: boolean }
      ) => {
        eq: (k: string, v: string) => Promise<{
          count: number | null;
          data: unknown[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { count } = await client
    .from("partner_trail_stops")
    .select("id", { count: "exact", head: true })
    .eq("trail_id", trailId);

  const total = count ?? 0;
  await (supabase.from("partner_trails" as never) as unknown as {
    update: (patch: Row) => {
      eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
    };
  })
    .update({ total_slots: total, updated_at: new Date().toISOString() })
    .eq("id", trailId);

  return total;
}

async function loadTrailOwned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trailId: string,
  partnerId: string
): Promise<Row | null> {
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: Row | null }>;
        };
      };
    };
  };
  const { data } = await client
    .from("partner_trails")
    .select("*")
    .eq("id", trailId)
    .maybeSingle();
  if (!data) return null;
  if (data.partner_id !== partnerId) return null;
  return data;
}

// ---------- Trail actions ----------

export async function createTrailAction(formData: FormData) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const name = str(formData.get("name"));
  if (!name) throw new Error("숲길 이름을 입력해 주세요");

  const description = strOrNull(formData.get("description"));
  const difficulty = str(formData.get("difficulty")) || "EASY";
  if (difficulty.length < 1 || difficulty.length > 40) {
    throw new Error("난이도 값이 올바르지 않아요");
  }
  const estimated_minutes = intOrNull(formData.get("estimated_minutes"));
  const distance_km = numOrNull(formData.get("distance_km"));
  const cover_image_url = strOrNull(formData.get("cover_image_url"));

  const venue_name = strOrNull(formData.get("venue_name"));
  const venue_address = strOrNull(formData.get("venue_address"));
  const external_link = strOrNull(formData.get("external_link"));
  const notes = strOrNull(formData.get("notes"));
  const images = formData
    .getAll("images")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const row: Row = {
    partner_id: partner.id,
    name,
    description,
    cover_image_url,
    difficulty,
    estimated_minutes,
    distance_km,
    total_slots: 0,
    theme: {},
    is_public: false,
    slug: slugify(name),
    view_count: 0,
    completion_count: 0,
    status: "DRAFT",
    venue_name,
    venue_address,
    external_link,
    notes,
    images,
  };

  const { data, error } = await (
    supabase.from("partner_trails" as never) as unknown as {
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
    console.error("[trails/create] error", error);
    throw new Error(`숲길 생성 실패: ${error?.message ?? "unknown"}`);
  }

  revalidatePath("/partner/trails");
  redirect(`/partner/trails/${data.id}`);
}

const VISIBILITY_SET = new Set<string>(["DRAFT", "ALL", "SELECTED", "ARCHIVED"]);

function statusFromVisibility(
  visibility: string
): "DRAFT" | "PUBLISHED" | "ARCHIVED" {
  switch (visibility) {
    case "ALL":
    case "SELECTED":
      return "PUBLISHED";
    case "ARCHIVED":
      return "ARCHIVED";
    case "DRAFT":
    default:
      return "DRAFT";
  }
}

export async function updateTrailAction(id: string, formData: FormData) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const existing = await loadTrailOwned(supabase, id, partner.id);
  if (!existing) throw new Error("숲길을 찾을 수 없어요");

  const name = str(formData.get("name"));
  if (!name) throw new Error("숲길 이름을 입력해 주세요");

  const difficulty = str(formData.get("difficulty")) || "EASY";
  if (difficulty.length < 1 || difficulty.length > 40) {
    throw new Error("난이도 값이 올바르지 않아요");
  }

  const images = formData
    .getAll("images")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const patch: Row = {
    name,
    description: strOrNull(formData.get("description")),
    difficulty,
    estimated_minutes: intOrNull(formData.get("estimated_minutes")),
    distance_km: numOrNull(formData.get("distance_km")),
    cover_image_url: strOrNull(formData.get("cover_image_url")),
    venue_name: strOrNull(formData.get("venue_name")),
    venue_address: strOrNull(formData.get("venue_address")),
    external_link: strOrNull(formData.get("external_link")),
    notes: strOrNull(formData.get("notes")),
    images,
    updated_at: new Date().toISOString(),
  };

  // optional visibility (폼에서 hidden input으로 전달될 때만 반영)
  const visibilityRaw = strOrNull(formData.get("visibility"));
  if (visibilityRaw && VISIBILITY_SET.has(visibilityRaw)) {
    const nextStatus = statusFromVisibility(visibilityRaw);
    patch.visibility = visibilityRaw;
    patch.status = nextStatus;
    patch.is_public = nextStatus === "PUBLISHED";
  }

  const { error } = await (
    supabase.from("partner_trails" as never) as unknown as {
      update: (r: Row) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update(patch)
    .eq("id", id);

  if (error) throw new Error(`숲길 수정 실패: ${error.message}`);

  revalidatePath("/partner/trails");
  revalidatePath(`/partner/trails/${id}`);
}

export async function updateTrailVisibilityAction(
  id: string,
  visibility: string
) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const existing = await loadTrailOwned(supabase, id, partner.id);
  if (!existing) throw new Error("숲길을 찾을 수 없어요");

  if (!VISIBILITY_SET.has(visibility)) {
    throw new Error("공개 범위 값이 올바르지 않아요");
  }

  const nextStatus = statusFromVisibility(visibility);
  const patch: Row = {
    visibility,
    status: nextStatus,
    is_public: nextStatus === "PUBLISHED",
    updated_at: new Date().toISOString(),
  };

  const { error } = await (
    supabase.from("partner_trails" as never) as unknown as {
      update: (r: Row) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update(patch)
    .eq("id", id);

  if (error) throw new Error(`공개 범위 변경 실패: ${error.message}`);

  // SELECTED가 아닌 경우 assignments 제거 (ALL/DRAFT/ARCHIVED는 junction 불필요)
  if (visibility !== "SELECTED") {
    const { error: delErr } = await (
      supabase.from("partner_trail_assignments" as never) as unknown as {
        delete: () => {
          eq: (k: string, v: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      }
    )
      .delete()
      .eq("trail_id", id);
    if (delErr) {
      console.error("[trails/visibility] cleanup assignments error", delErr);
    }
  }

  revalidatePath("/partner/trails");
  revalidatePath(`/partner/trails/${id}`);
}

export async function setTrailAssignmentsAction(
  trailId: string,
  orgIds: string[]
) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const existing = await loadTrailOwned(supabase, trailId, partner.id);
  if (!existing) throw new Error("숲길을 찾을 수 없어요");

  const sb = supabase as unknown as {
    from: (t: string) => {
      delete: () => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
      insert: (
        rows: Row[]
      ) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { error: delErr } = await sb
    .from("partner_trail_assignments")
    .delete()
    .eq("trail_id", trailId);
  if (delErr) throw new Error(`할당 초기화 실패: ${delErr.message}`);

  const uniqueOrgIds = Array.from(
    new Set(orgIds.map((s) => String(s).trim()).filter(Boolean))
  );

  if (uniqueOrgIds.length > 0) {
    const rows: Row[] = uniqueOrgIds.map((org_id) => ({
      trail_id: trailId,
      org_id,
      assigned_by: partner.id,
    }));
    const { error: insErr } = await sb
      .from("partner_trail_assignments")
      .insert(rows);
    if (insErr) throw new Error(`할당 저장 실패: ${insErr.message}`);
  }

  revalidatePath("/partner/trails");
  revalidatePath(`/partner/trails/${trailId}`);
}

export async function updateTrailStatusAction(
  id: string,
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const existing = await loadTrailOwned(supabase, id, partner.id);
  if (!existing) throw new Error("숲길을 찾을 수 없어요");

  if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
    throw new Error("상태 값이 올바르지 않아요");
  }

  const patch: Row = {
    status,
    is_public: status === "PUBLISHED",
    updated_at: new Date().toISOString(),
  };

  const { error } = await (
    supabase.from("partner_trails" as never) as unknown as {
      update: (r: Row) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update(patch)
    .eq("id", id);

  if (error) throw new Error(`상태 변경 실패: ${error.message}`);

  revalidatePath("/partner/trails");
  revalidatePath(`/partner/trails/${id}`);
}

export async function deleteTrailAction(id: string) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const existing = await loadTrailOwned(supabase, id, partner.id);
  if (!existing) throw new Error("숲길을 찾을 수 없어요");

  const { error } = await (
    supabase.from("partner_trails" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .delete()
    .eq("id", id);

  if (error) throw new Error(`숲길 삭제 실패: ${error.message}`);

  revalidatePath("/partner/trails");
  redirect("/partner/trails");
}

export async function duplicateTrailAction(id: string) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const existing = await loadTrailOwned(supabase, id, partner.id);
  if (!existing) throw new Error("숲길을 찾을 수 없어요");

  const name = `복사본 ${String(existing.name ?? "숲길")}`;
  const newRow: Row = {
    partner_id: partner.id,
    name,
    description: existing.description,
    cover_image_url: existing.cover_image_url,
    difficulty: existing.difficulty,
    estimated_minutes: existing.estimated_minutes,
    distance_km: existing.distance_km,
    total_slots: 0,
    theme: existing.theme ?? {},
    is_public: false,
    slug: slugify(name),
    view_count: 0,
    completion_count: 0,
    status: "DRAFT",
  };

  const { data: newTrail, error: insertErr } = await (
    supabase.from("partner_trails" as never) as unknown as {
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
    .insert(newRow)
    .select("id")
    .single();

  if (insertErr || !newTrail) {
    throw new Error(`숲길 복제 실패: ${insertErr?.message ?? "unknown"}`);
  }

  // Copy stops (regenerate qr_code)
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => {
          order: (c: string, o: { ascending: boolean }) => Promise<{
            data: Row[] | null;
          }>;
        };
      };
    };
  };
  const { data: stops } = await client
    .from("partner_trail_stops")
    .select("*")
    .eq("trail_id", id)
    .order("order", { ascending: true });

  const srcStops = stops ?? [];
  if (srcStops.length > 0) {
    const cloned = srcStops.map((s) => ({
      trail_id: newTrail.id,
      order: s.order,
      name: s.name,
      description: s.description,
      location_hint: s.location_hint,
      lat: s.lat,
      lng: s.lng,
      photo_url: s.photo_url,
      qr_code: generateQrCode(),
      mission_type: s.mission_type,
      mission_config: s.mission_config ?? {},
      reward_points: s.reward_points ?? 10,
      is_active: s.is_active ?? true,
    }));
    const { error: stopsErr } = await (
      supabase.from("partner_trail_stops" as never) as unknown as {
        insert: (rows: Row[]) => Promise<{
          error: { message: string } | null;
        }>;
      }
    ).insert(cloned);
    if (stopsErr) {
      console.error("[trails/duplicate] stops insert error", stopsErr);
    }

    await (
      supabase.from("partner_trails" as never) as unknown as {
        update: (r: Row) => {
          eq: (k: string, v: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      }
    )
      .update({ total_slots: cloned.length })
      .eq("id", newTrail.id);
  }

  revalidatePath("/partner/trails");
  redirect(`/partner/trails/${newTrail.id}`);
}

// ---------- Stop actions ----------

export async function addStopAction(trailId: string, formData: FormData) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const trail = await loadTrailOwned(supabase, trailId, partner.id);
  if (!trail) throw new Error("숲길을 찾을 수 없어요");

  const name = str(formData.get("name"));
  if (!name) throw new Error("지점 이름을 입력해 주세요");

  const mission_type = str(formData.get("mission_type")) || "CHECKIN";
  if (!["PHOTO", "QUIZ", "LOCATION", "CHECKIN"].includes(mission_type)) {
    throw new Error("미션 타입 값이 올바르지 않아요");
  }

  // parse mission_config: either from discrete cfg_* fields or raw JSON string
  let mission_config: Record<string, unknown> = buildMissionConfig(
    mission_type,
    formData
  );
  const rawCfg = strOrNull(formData.get("mission_config"));
  if (rawCfg) {
    try {
      const parsed = JSON.parse(rawCfg);
      if (parsed && typeof parsed === "object") {
        mission_config = { ...mission_config, ...parsed };
      }
    } catch {
      // ignore parse error, use discrete fields
    }
  }

  const reward_points = intOrDefault(formData.get("reward_points"), 10);
  const order =
    intOrNull(formData.get("order")) ??
    (typeof trail.total_slots === "number" ? trail.total_slots : 0) + 1;

  const row: Row = {
    trail_id: trailId,
    order,
    name,
    description: strOrNull(formData.get("description")),
    location_hint: strOrNull(formData.get("location_hint")),
    lat: numOrNull(formData.get("lat")),
    lng: numOrNull(formData.get("lng")),
    photo_url: strOrNull(formData.get("photo_url")),
    qr_code: generateQrCode(),
    mission_type,
    mission_config,
    reward_points,
    is_active: true,
  };

  const { error } = await (
    supabase.from("partner_trail_stops" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: { message: string } | null }>;
    }
  ).insert(row);

  if (error) throw new Error(`지점 추가 실패: ${error.message}`);

  await recountSlots(supabase, trailId);

  revalidatePath(`/partner/trails/${trailId}`);
  revalidatePath(`/partner/trails/${trailId}/qr`);
}

export async function updateStopAction(
  stopId: string,
  trailId: string,
  formData: FormData
) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const trail = await loadTrailOwned(supabase, trailId, partner.id);
  if (!trail) throw new Error("숲길을 찾을 수 없어요");

  const name = str(formData.get("name"));
  if (!name) throw new Error("지점 이름을 입력해 주세요");

  const mission_type = str(formData.get("mission_type")) || "CHECKIN";
  if (!["PHOTO", "QUIZ", "LOCATION", "CHECKIN"].includes(mission_type)) {
    throw new Error("미션 타입 값이 올바르지 않아요");
  }

  let mission_config: Record<string, unknown> = buildMissionConfig(
    mission_type,
    formData
  );
  const rawCfg = strOrNull(formData.get("mission_config"));
  if (rawCfg) {
    try {
      const parsed = JSON.parse(rawCfg);
      if (parsed && typeof parsed === "object") {
        mission_config = { ...mission_config, ...parsed };
      }
    } catch {
      // ignore
    }
  }

  const patch: Row = {
    name,
    description: strOrNull(formData.get("description")),
    location_hint: strOrNull(formData.get("location_hint")),
    lat: numOrNull(formData.get("lat")),
    lng: numOrNull(formData.get("lng")),
    photo_url: strOrNull(formData.get("photo_url")),
    mission_type,
    mission_config,
    reward_points: intOrDefault(formData.get("reward_points"), 10),
    order: intOrNull(formData.get("order")) ?? undefined,
  };

  const { error } = await (
    supabase.from("partner_trail_stops" as never) as unknown as {
      update: (r: Row) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update(patch)
    .eq("id", stopId);

  if (error) throw new Error(`지점 수정 실패: ${error.message}`);

  revalidatePath(`/partner/trails/${trailId}`);
  revalidatePath(`/partner/trails/${trailId}/qr`);
  redirect(`/partner/trails/${trailId}`);
}

export async function deleteStopAction(stopId: string, trailId: string) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const trail = await loadTrailOwned(supabase, trailId, partner.id);
  if (!trail) throw new Error("숲길을 찾을 수 없어요");

  const { error } = await (
    supabase.from("partner_trail_stops" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .delete()
    .eq("id", stopId);

  if (error) throw new Error(`지점 삭제 실패: ${error.message}`);

  await recountSlots(supabase, trailId);

  revalidatePath(`/partner/trails/${trailId}`);
  revalidatePath(`/partner/trails/${trailId}/qr`);
}

export async function reorderStopsAction(
  trailId: string,
  orderedIds: string[]
) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const trail = await loadTrailOwned(supabase, trailId, partner.id);
  if (!trail) throw new Error("숲길을 찾을 수 없어요");

  // 2-pass to avoid UNIQUE(trail_id, order) collision:
  // first push to negative, then assign final order.
  const api = supabase.from("partner_trail_stops" as never) as unknown as {
    update: (r: Row) => {
      eq: (k: string, v: string) => Promise<{
        error: { message: string } | null;
      }>;
    };
  };

  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    const { error } = await api.update({ order: -(i + 1) }).eq("id", id);
    if (error) throw new Error(`순서 변경 실패(1): ${error.message}`);
  }
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    const { error } = await api.update({ order: i + 1 }).eq("id", id);
    if (error) throw new Error(`순서 변경 실패(2): ${error.message}`);
  }

  revalidatePath(`/partner/trails/${trailId}`);
}

export async function regenerateStopQrAction(
  stopId: string,
  trailId: string
) {
  const partner = await requirePartner();
  const supabase = await createClient();

  const trail = await loadTrailOwned(supabase, trailId, partner.id);
  if (!trail) throw new Error("숲길을 찾을 수 없어요");

  const newQr = generateQrCode();
  const { error } = await (
    supabase.from("partner_trail_stops" as never) as unknown as {
      update: (r: Row) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update({ qr_code: newQr })
    .eq("id", stopId);

  if (error) throw new Error(`QR 재발급 실패: ${error.message}`);

  revalidatePath(`/partner/trails/${trailId}`);
  revalidatePath(`/partner/trails/${trailId}/qr`);
}
