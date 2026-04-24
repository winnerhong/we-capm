"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/auth-guard";
import {
  MISSION_KIND_META,
  type MissionKind,
  type MissionStatus,
  type MissionVisibility,
  type PartnerMissionRow,
} from "@/lib/missions/types";

type Row = Record<string, unknown>;

const VALID_KINDS: MissionKind[] = [
  "PHOTO",
  "QR_QUIZ",
  "PHOTO_APPROVAL",
  "COOP",
  "BROADCAST",
  "TREASURE",
  "RADIO",
  "FINAL_REWARD",
];

const SUPPORTED_KINDS: MissionKind[] = [
  "PHOTO",
  "QR_QUIZ",
  "PHOTO_APPROVAL",
  "COOP",
  "BROADCAST",
  "TREASURE",
  "RADIO",
  "FINAL_REWARD",
];

const VISIBILITY_SET = new Set<MissionVisibility>([
  "DRAFT",
  "ALL",
  "SELECTED",
  "ARCHIVED",
]);

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

async function loadMissionOwned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  missionId: string,
  partnerId: string
): Promise<PartnerMissionRow | null> {
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: PartnerMissionRow | null }>;
        };
      };
    };
  };
  const { data } = await sb
    .from("partner_missions")
    .select("*")
    .eq("id", missionId)
    .maybeSingle();
  if (!data) return null;
  if (data.partner_id !== partnerId) return null;
  return data;
}

// ---------- Config validation / sanitization ----------

function sanitizePhotoConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const min = typeof r.min_photos === "number" ? r.min_photos : 1;
  const prompt = typeof r.prompt === "string" ? r.prompt : "";
  const requireCaption = Boolean(r.require_caption);
  const geo = r.geofence as Record<string, unknown> | null | undefined;
  let geofence: { lat: number; lng: number; radius_m: number } | undefined;
  if (
    geo &&
    typeof geo === "object" &&
    typeof geo.lat === "number" &&
    typeof geo.lng === "number" &&
    typeof geo.radius_m === "number"
  ) {
    geofence = {
      lat: geo.lat,
      lng: geo.lng,
      radius_m: geo.radius_m,
    };
  }
  const out: Record<string, unknown> = {
    min_photos: Math.min(5, Math.max(1, min)),
    prompt,
    require_caption: requireCaption,
  };
  if (geofence) out.geofence = geofence;
  return out;
}

function sanitizeQrQuizConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const qr_token = typeof r.qr_token === "string" ? r.qr_token : "";
  const qr_single_use =
    typeof r.qr_single_use === "boolean" ? r.qr_single_use : true;
  const quiz_type_raw = typeof r.quiz_type === "string" ? r.quiz_type : "NONE";
  const quiz_type =
    quiz_type_raw === "MCQ" || quiz_type_raw === "SHORT"
      ? quiz_type_raw
      : "NONE";
  const quiz_text =
    typeof r.quiz_text === "string" ? r.quiz_text : undefined;
  const quiz_answer =
    typeof r.quiz_answer === "string" ? r.quiz_answer : undefined;
  const hint = typeof r.hint === "string" ? r.hint : undefined;
  let quiz_choices:
    | Array<{ id: string; label: string }>
    | undefined;
  if (Array.isArray(r.quiz_choices)) {
    quiz_choices = r.quiz_choices.flatMap((c) => {
      if (!c || typeof c !== "object") return [];
      const o = c as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.label !== "string") return [];
      return [{ id: o.id, label: o.label }];
    });
  }
  const out: Record<string, unknown> = {
    qr_token,
    qr_single_use,
    quiz_type,
  };
  if (quiz_text !== undefined) out.quiz_text = quiz_text;
  if (quiz_choices !== undefined) out.quiz_choices = quiz_choices;
  if (quiz_answer !== undefined) out.quiz_answer = quiz_answer;
  if (hint !== undefined) out.hint = hint;
  return out;
}

function sanitizeFinalRewardConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  let tiers: Array<{
    threshold: number;
    label: string;
    reward_desc: string;
    icon?: string;
  }> = [];
  if (Array.isArray(r.tiers)) {
    tiers = r.tiers.flatMap((t) => {
      if (!t || typeof t !== "object") return [];
      const o = t as Record<string, unknown>;
      if (
        typeof o.threshold !== "number" ||
        typeof o.label !== "string" ||
        typeof o.reward_desc !== "string"
      )
        return [];
      return [
        {
          threshold: o.threshold,
          label: o.label,
          reward_desc: o.reward_desc,
          icon: typeof o.icon === "string" ? o.icon : undefined,
        },
      ];
    });
    // 정렬은 threshold ASC
    tiers.sort((a, b) => a.threshold - b.threshold);
  }
  const ttl =
    typeof r.redemption_ttl_hours === "number" ? r.redemption_ttl_hours : 24;
  const scopeRaw = typeof r.scope === "string" ? r.scope : "QUEST_PACK";
  const scope = scopeRaw === "ALL_PACKS" ? "ALL_PACKS" : "QUEST_PACK";
  return {
    tiers,
    redemption_ttl_hours: Math.max(1, Math.min(24 * 30, ttl)),
    scope,
  };
}

function sanitizePhotoApprovalConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const prompt = typeof r.prompt === "string" ? r.prompt : "";
  const minRaw = typeof r.min_photos === "number" ? r.min_photos : 1;
  const min_photos = Math.min(5, Math.max(1, Math.floor(minRaw)));
  const slaRaw = typeof r.sla_hours === "number" ? r.sla_hours : 24;
  const sla_hours = Math.min(72, Math.max(1, Math.floor(slaRaw)));
  let reject_reasons: string[] = [];
  if (Array.isArray(r.reject_reasons)) {
    reject_reasons = r.reject_reasons.flatMap((x) =>
      typeof x === "string" && x.trim() ? [x.trim()] : []
    );
  }
  return {
    prompt,
    min_photos,
    sla_hours,
    reject_reasons,
  };
}

function sanitizeTreasureConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  let steps: Array<{
    order: number;
    hint_text: string;
    unlock_rule: "AUTO" | "QR" | "ANSWER";
    answer?: string;
  }> = [];
  if (Array.isArray(r.steps)) {
    steps = r.steps.flatMap((s, idx) => {
      if (!s || typeof s !== "object") return [];
      const o = s as Record<string, unknown>;
      const hint_text = typeof o.hint_text === "string" ? o.hint_text : "";
      const ruleRaw =
        typeof o.unlock_rule === "string" ? o.unlock_rule : "AUTO";
      const unlock_rule: "AUTO" | "QR" | "ANSWER" =
        ruleRaw === "QR" || ruleRaw === "ANSWER" ? ruleRaw : "AUTO";
      const order =
        typeof o.order === "number" && Number.isFinite(o.order)
          ? Math.floor(o.order)
          : idx + 1;
      const entry: {
        order: number;
        hint_text: string;
        unlock_rule: "AUTO" | "QR" | "ANSWER";
        answer?: string;
      } = { order, hint_text, unlock_rule };
      if (unlock_rule !== "AUTO" && typeof o.answer === "string") {
        entry.answer = o.answer;
      }
      return [entry];
    });
    // 재정렬 — 현재 배열 순서 기반으로 order 재부여
    steps = steps.map((s, idx) => ({ ...s, order: idx + 1 }));
  }
  const final_qr_token =
    typeof r.final_qr_token === "string" ? r.final_qr_token : "";
  return { steps, final_qr_token };
}

function sanitizeCoopConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const gsRaw = typeof r.group_size === "number" ? r.group_size : 2;
  const group_size = Math.min(6, Math.max(2, Math.floor(gsRaw)));
  const mwRaw =
    typeof r.match_window_min === "number" ? r.match_window_min : 30;
  const match_window_min = Math.min(120, Math.max(5, Math.floor(mwRaw)));
  const ruleRaw =
    typeof r.completion_rule === "string" ? r.completion_rule : "BOTH_CONFIRM";
  const completion_rule: "BOTH_CONFIRM" | "SHARED_PHOTO" =
    ruleRaw === "SHARED_PHOTO" ? "SHARED_PHOTO" : "BOTH_CONFIRM";
  return { group_size, match_window_min, completion_rule };
}

function sanitizeBroadcastConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const durRaw = typeof r.duration_sec === "number" ? r.duration_sec : 300;
  const duration_sec = Math.min(3600, Math.max(30, Math.floor(durRaw)));
  const prompt = typeof r.prompt === "string" ? r.prompt : "";
  const kindRaw =
    typeof r.submission_kind === "string" ? r.submission_kind : "PHOTO";
  const submission_kind: "PHOTO" | "TEXT" =
    kindRaw === "TEXT" ? "TEXT" : "PHOTO";
  return { duration_sec, prompt, submission_kind };
}

function sanitizeRadioConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const prompt_song =
    typeof r.prompt_song === "string" ? r.prompt_song : "";
  const prompt_story =
    typeof r.prompt_story === "string" ? r.prompt_story : "";
  const mlRaw = typeof r.max_length === "number" ? r.max_length : 500;
  const max_length = Math.min(2000, Math.max(50, Math.floor(mlRaw)));
  return { prompt_song, prompt_story, max_length };
}

function sanitizeConfigByKind(
  kind: MissionKind,
  raw: unknown
): Record<string, unknown> {
  switch (kind) {
    case "PHOTO":
      return sanitizePhotoConfig(raw);
    case "QR_QUIZ":
      return sanitizeQrQuizConfig(raw);
    case "FINAL_REWARD":
      return sanitizeFinalRewardConfig(raw);
    case "PHOTO_APPROVAL":
      return sanitizePhotoApprovalConfig(raw);
    case "TREASURE":
      return sanitizeTreasureConfig(raw);
    case "RADIO":
      return sanitizeRadioConfig(raw);
    case "COOP":
      return sanitizeCoopConfig(raw);
    case "BROADCAST":
      return sanitizeBroadcastConfig(raw);
    default:
      return raw && typeof raw === "object"
        ? (raw as Record<string, unknown>)
        : {};
  }
}

function validateConfigForPublish(
  kind: MissionKind,
  config: Record<string, unknown>
): string | null {
  if (kind === "PHOTO") {
    const prompt = config.prompt;
    if (typeof prompt !== "string" || prompt.trim().length < 2) {
      return "사진 미션 안내 문구(prompt)를 입력해 주세요";
    }
    return null;
  }
  if (kind === "QR_QUIZ") {
    const token = config.qr_token;
    if (typeof token !== "string" || token.length < 4) {
      return "QR 토큰을 먼저 생성해 주세요";
    }
    const quizType = config.quiz_type;
    if (quizType === "MCQ") {
      const choices = config.quiz_choices;
      if (!Array.isArray(choices) || choices.length < 2) {
        return "객관식 퀴즈는 최소 2개의 보기가 필요해요";
      }
      if (
        typeof config.quiz_answer !== "string" ||
        config.quiz_answer.length === 0
      ) {
        return "정답을 선택해 주세요";
      }
    } else if (quizType === "SHORT") {
      if (
        typeof config.quiz_answer !== "string" ||
        config.quiz_answer.trim().length === 0
      ) {
        return "단답형 정답을 입력해 주세요";
      }
    }
    return null;
  }
  if (kind === "FINAL_REWARD") {
    const tiers = config.tiers;
    if (!Array.isArray(tiers) || tiers.length === 0) {
      return "최소 1개의 보상 티어가 필요해요";
    }
    return null;
  }
  if (kind === "PHOTO_APPROVAL") {
    const prompt = config.prompt;
    if (typeof prompt !== "string" || prompt.trim().length < 2) {
      return "자연물 찾기 안내 문구(prompt)를 입력해 주세요";
    }
    return null;
  }
  if (kind === "TREASURE") {
    const steps = config.steps;
    if (!Array.isArray(steps) || steps.length < 2) {
      return "보물찾기는 최소 2단계가 필요해요";
    }
    const token = config.final_qr_token;
    if (typeof token !== "string" || token.trim().length === 0) {
      return "최종 QR 토큰을 생성해 주세요";
    }
    return null;
  }
  if (kind === "RADIO") {
    const song = config.prompt_song;
    const story = config.prompt_story;
    if (typeof song !== "string" || song.trim().length === 0) {
      return "신청곡 안내 문구를 입력해 주세요";
    }
    if (typeof story !== "string" || story.trim().length === 0) {
      return "사연 안내 문구를 입력해 주세요";
    }
    return null;
  }
  if (kind === "COOP") {
    const rule = config.completion_rule;
    if (rule !== "BOTH_CONFIRM" && rule !== "SHARED_PHOTO") {
      return "협동 미션 완성 조건을 선택해 주세요";
    }
    return null;
  }
  if (kind === "BROADCAST") {
    const prompt = config.prompt;
    if (typeof prompt !== "string" || prompt.trim().length < 4) {
      return "방송 문구(prompt)를 최소 4자 이상 입력해 주세요";
    }
    return null;
  }
  return null;
}

// ---------- Actions ----------

export async function createDraftMissionAction(kindStr: string): Promise<void> {
  const partner = await requirePartner();

  if (!VALID_KINDS.includes(kindStr as MissionKind)) {
    throw new Error("지원하지 않는 미션 종류입니다");
  }
  const kind = kindStr as MissionKind;

  if (!SUPPORTED_KINDS.includes(kind)) {
    throw new Error(
      `${MISSION_KIND_META[kind].label} 은(는) Phase 3에서 만들어요`
    );
  }

  const supabase = await createClient();
  const meta = MISSION_KIND_META[kind];

  const row: Row = {
    partner_id: partner.id,
    kind,
    title: `${meta.label} (초안)`,
    description: null,
    icon: meta.icon,
    default_acorns: meta.defaultAcorns,
    config_json: {},
    version: 1,
    parent_version_id: null,
    status: "DRAFT" as MissionStatus,
    visibility: "DRAFT" as MissionVisibility,
  };

  const { data, error } = await (
    supabase.from("partner_missions" as never) as unknown as {
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
    console.error("[partner/missions/create] error", error);
    throw new Error(`미션 생성 실패: ${error?.message ?? "unknown"}`);
  }

  revalidatePath("/partner/missions");
  redirect(`/partner/missions/${data.id}/edit`);
}

export async function updatePartnerMissionAction(
  id: string,
  formData: FormData
): Promise<void> {
  const partner = await requirePartner();
  const supabase = await createClient();

  const existing = await loadMissionOwned(supabase, id, partner.id);
  if (!existing) throw new Error("미션을 찾을 수 없어요");

  const title = str(formData.get("title"));
  if (!title) throw new Error("제목을 입력해 주세요");

  const description = strOrNull(formData.get("description"));
  const icon = strOrNull(formData.get("icon"));
  const default_acorns = Math.max(
    0,
    Math.min(100, intOrDefault(formData.get("default_acorns"), 0))
  );

  const visibilityRaw = str(formData.get("visibility")) || "DRAFT";
  if (!VISIBILITY_SET.has(visibilityRaw as MissionVisibility)) {
    throw new Error("공개 범위 값이 올바르지 않아요");
  }
  const visibility = visibilityRaw as MissionVisibility;

  const configRaw = str(formData.get("config_json"));
  let parsedConfig: unknown = {};
  if (configRaw) {
    try {
      parsedConfig = JSON.parse(configRaw);
    } catch {
      throw new Error("설정(config) 파싱에 실패했어요. 다시 시도해 주세요.");
    }
  }
  const config_json = sanitizeConfigByKind(existing.kind, parsedConfig);

  // visibility 변경 시 status도 맞춰 조정
  let status: MissionStatus = existing.status;
  if (visibility === "ARCHIVED") status = "ARCHIVED";
  else if (visibility === "DRAFT") status = "DRAFT";
  else status = existing.status === "ARCHIVED" ? "DRAFT" : existing.status;

  const patch: Row = {
    title,
    description,
    icon,
    default_acorns,
    visibility,
    status,
    config_json,
    updated_at: new Date().toISOString(),
  };

  const { error } = await (
    supabase.from("partner_missions" as never) as unknown as {
      update: (r: Row) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update(patch)
    .eq("id", id);

  if (error) throw new Error(`미션 저장 실패: ${error.message}`);

  revalidatePath("/partner/missions");
  revalidatePath(`/partner/missions/${id}/edit`);
}

export async function publishMissionAction(id: string): Promise<void> {
  const partner = await requirePartner();
  const supabase = await createClient();

  const existing = await loadMissionOwned(supabase, id, partner.id);
  if (!existing) throw new Error("미션을 찾을 수 없어요");

  if (!existing.title || existing.title.trim().length === 0) {
    throw new Error("제목을 먼저 저장해 주세요");
  }

  const err = validateConfigForPublish(
    existing.kind,
    (existing.config_json ?? {}) as Record<string, unknown>
  );
  if (err) throw new Error(err);

  const nextVisibility: MissionVisibility =
    existing.visibility === "DRAFT" ? "ALL" : existing.visibility;

  const patch: Row = {
    status: "PUBLISHED" as MissionStatus,
    visibility: nextVisibility,
    updated_at: new Date().toISOString(),
  };

  const { error } = await (
    supabase.from("partner_missions" as never) as unknown as {
      update: (r: Row) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update(patch)
    .eq("id", id);

  if (error) throw new Error(`게시 실패: ${error.message}`);

  revalidatePath("/partner/missions");
  revalidatePath(`/partner/missions/${id}/edit`);
}

export async function archiveMissionAction(id: string): Promise<void> {
  const partner = await requirePartner();
  const supabase = await createClient();

  const existing = await loadMissionOwned(supabase, id, partner.id);
  if (!existing) throw new Error("미션을 찾을 수 없어요");

  const patch: Row = {
    status: "ARCHIVED" as MissionStatus,
    visibility: "ARCHIVED" as MissionVisibility,
    updated_at: new Date().toISOString(),
  };

  const { error } = await (
    supabase.from("partner_missions" as never) as unknown as {
      update: (r: Row) => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update(patch)
    .eq("id", id);

  if (error) throw new Error(`보관 실패: ${error.message}`);

  revalidatePath("/partner/missions");
  revalidatePath(`/partner/missions/${id}/edit`);
}

export async function deleteMissionAction(id: string): Promise<void> {
  const partner = await requirePartner();
  const supabase = await createClient();

  const existing = await loadMissionOwned(supabase, id, partner.id);
  if (!existing) throw new Error("미션을 찾을 수 없어요");

  // 참조 체크: org_missions.source_mission_id 사용 중이면 거부
  const refResp = (await (
    supabase.from("org_missions" as never) as unknown as {
      select: (
        c: string,
        opt?: { count?: "exact"; head?: boolean }
      ) => {
        eq: (
          k: string,
          v: string
        ) => Promise<{
          count: number | null;
          error: { message: string } | null;
        }>;
      };
    }
  )
    .select("id", { count: "exact", head: true })
    .eq("source_mission_id", id)) as {
    count: number | null;
    error: { message: string } | null;
  };

  if (refResp.count && refResp.count > 0) {
    throw new Error("사용 중인 미션은 삭제할 수 없어요. 보관 처리해 주세요.");
  }

  const { error } = await (
    supabase.from("partner_missions" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .delete()
    .eq("id", id);

  if (error) throw new Error(`삭제 실패: ${error.message}`);

  revalidatePath("/partner/missions");
  redirect("/partner/missions");
}
