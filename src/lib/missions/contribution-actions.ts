"use server";

/**
 * Phase 4 — 역반영(Contribution) 루프 서버 액션.
 *
 * 흐름:
 *   기관(org)이 자기 org_mission 을 편집하다가 좋은 개선사항을 발견 →
 *   지사(partner)에게 제안(propose) → 지사가 검토 후 accept/reject →
 *   accept 시 partner_missions 의 새 버전(parent_version_id 연결)으로 승격.
 *
 * 상태 머신:
 *   PROPOSED → ACCEPTED | REJECTED | WITHDRAWN
 *   (이미 ACCEPTED/REJECTED/WITHDRAWN 은 재변경 불가)
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  loadContributionById,
  loadOrgMissionById,
  loadPartnerMissionById,
} from "@/lib/missions/queries";
import type {
  ContributionStatus,
  MissionContributionRow,
  OrgMissionRow,
  PartnerMissionRow,
} from "@/lib/missions/types";

type Row = Record<string, unknown>;
type SbErr = { message: string; code?: string } | null;
type SbRespOne<T> = { data: T | null; error: SbErr };

type ContributableField = "title" | "description" | "acorns" | "config_json";
const VALID_FIELDS: ContributableField[] = [
  "title",
  "description",
  "acorns",
  "config_json",
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 선택된 필드만 org_mission 과 partner_mission 의 값을 비교해서 diff 생성.
 * 실제로 값이 다를 때만 해당 키를 포함한다.
 */
function buildProposedDiff(
  orgMission: OrgMissionRow,
  partnerMission: PartnerMissionRow,
  fields: ContributableField[]
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};

  if (fields.includes("title")) {
    const from = partnerMission.title ?? "";
    const to = orgMission.title ?? "";
    if (from !== to) diff.title = { from, to };
  }

  if (fields.includes("description")) {
    const from = partnerMission.description ?? "";
    const to = orgMission.description ?? "";
    if (from !== to) diff.description = { from, to };
  }

  if (fields.includes("acorns")) {
    const from = partnerMission.default_acorns ?? 0;
    const to = orgMission.acorns ?? 0;
    if (from !== to) diff.acorns = { from, to };
  }

  if (fields.includes("config_json")) {
    const from = partnerMission.config_json ?? {};
    const to = orgMission.config_json ?? {};
    // 얕은 JSON 비교 (순서 의존) — 문자열화해 equality 체크
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      diff.config_json = { from, to };
    }
  }

  return diff;
}

async function loadExistingProposed(
  sourceOrgMissionId: string,
  targetPartnerMissionId: string
): Promise<MissionContributionRow | null> {
  const supabase = await createClient();
  const resp = (await (
    supabase.from("mission_contributions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<SbRespOne<MissionContributionRow>>;
            };
          };
        };
      };
    }
  )
    .select("*")
    .eq("source_org_mission_id", sourceOrgMissionId)
    .eq("target_partner_mission_id", targetPartnerMissionId)
    .eq("status", "PROPOSED")
    .maybeSingle()) as SbRespOne<MissionContributionRow>;

  return resp.data ?? null;
}

/* -------------------------------------------------------------------------- */
/* 1) proposeContributionAction — 기관이 지사에게 개선사항 제안                 */
/* -------------------------------------------------------------------------- */

export async function proposeContributionAction(
  sourceOrgMissionId: string,
  formData: FormData
): Promise<void> {
  const org = await requireOrg();
  if (!sourceOrgMissionId) throw new Error("미션 ID가 비어 있어요");

  const orgMission = await loadOrgMissionById(sourceOrgMissionId);
  if (!orgMission) throw new Error("미션을 찾을 수 없어요");
  if (orgMission.org_id !== org.orgId) {
    throw new Error("다른 기관의 미션은 제안할 수 없어요");
  }
  if (!orgMission.source_mission_id) {
    throw new Error("원본 가이드가 없는 미션은 지사에게 제안할 수 없어요");
  }

  const partnerMission = await loadPartnerMissionById(orgMission.source_mission_id);
  if (!partnerMission) throw new Error("원본 가이드를 찾을 수 없어요");

  // 파싱
  const proposalNote = String(formData.get("proposal_note") ?? "").trim();
  if (!proposalNote) {
    throw new Error("어떤 점이 좋아졌는지 적어 주세요");
  }
  if (proposalNote.length > 2000) {
    throw new Error("설명이 너무 길어요 (2000자 이하)");
  }

  const rawFields = formData.getAll("changed_fields").map((v) => String(v));
  const changedFields = rawFields.filter((f): f is ContributableField =>
    (VALID_FIELDS as string[]).includes(f)
  );
  if (changedFields.length === 0) {
    throw new Error("변경한 항목을 최소 1개 선택해 주세요");
  }

  const proposedDiff = buildProposedDiff(
    orgMission,
    partnerMission,
    changedFields
  );
  if (Object.keys(proposedDiff).length === 0) {
    throw new Error(
      "선택한 항목이 원본 가이드와 동일해요 — 바뀐 내용이 있어야 제안할 수 있어요"
    );
  }

  const supabase = await createClient();
  const existing = await loadExistingProposed(
    sourceOrgMissionId,
    partnerMission.id
  );

  if (existing) {
    // 멱등 업데이트
    const upd = (await (
      supabase.from("mission_contributions" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({
        proposed_diff: proposedDiff,
        proposal_note: proposalNote,
      })
      .eq("id", existing.id)) as { error: SbErr };

    if (upd.error) {
      throw new Error(`제안 업데이트 실패: ${upd.error.message}`);
    }
  } else {
    const ins = (await (
      supabase.from("mission_contributions" as never) as unknown as {
        insert: (r: Row) => Promise<{ error: SbErr }>;
      }
    ).insert({
      source_org_mission_id: sourceOrgMissionId,
      target_partner_mission_id: partnerMission.id,
      proposed_diff: proposedDiff,
      proposal_note: proposalNote,
      proposed_by_org_id: org.orgId,
      status: "PROPOSED",
    } satisfies Row)) as { error: SbErr };

    if (ins.error) {
      throw new Error(`제안 실패: ${ins.error.message}`);
    }
  }

  revalidatePath(`/org/${org.orgId}/missions/${sourceOrgMissionId}/edit`);
  revalidatePath("/partner/missions/contributions");
  revalidatePath("/partner/missions");

  redirect(
    `/org/${org.orgId}/missions/${sourceOrgMissionId}/edit?proposed=1`
  );
}

/* -------------------------------------------------------------------------- */
/* 2) acceptContributionAction — 지사가 제안을 수용, 새 partner_mission 버전 생성 */
/* -------------------------------------------------------------------------- */

export async function acceptContributionAction(
  contributionId: string,
  reviewNote?: string
): Promise<void> {
  const partner = await requirePartner();
  if (partner.role !== "OWNER" && partner.role !== "MANAGER") {
    throw new Error("권한이 없어요 (OWNER/MANAGER만 가능)");
  }
  if (!contributionId) throw new Error("contributionId가 비어 있어요");

  const contribution = await loadContributionById(contributionId);
  if (!contribution) throw new Error("제안을 찾을 수 없어요");
  if (contribution.status !== "PROPOSED") {
    throw new Error("이미 처리된 제안이에요");
  }

  const targetMission = await loadPartnerMissionById(
    contribution.target_partner_mission_id
  );
  if (!targetMission) throw new Error("대상 미션을 찾을 수 없어요");
  if (targetMission.partner_id !== partner.id) {
    throw new Error("다른 지사의 미션은 수용할 수 없어요");
  }

  // diff 적용
  const diff = (contribution.proposed_diff ?? {}) as Record<
    string,
    { from: unknown; to: unknown }
  >;

  const newTitle =
    diff.title && typeof diff.title.to === "string"
      ? (diff.title.to as string)
      : targetMission.title;
  const newDescription =
    diff.description
      ? (diff.description.to as string | null)
      : targetMission.description;
  const newAcorns =
    diff.acorns && typeof diff.acorns.to === "number"
      ? (diff.acorns.to as number)
      : targetMission.default_acorns;
  const newConfig =
    diff.config_json && typeof diff.config_json.to === "object"
      ? (diff.config_json.to as Record<string, unknown>)
      : targetMission.config_json;

  const supabase = await createClient();

  // 새 partner_missions 행 — DRAFT 로 삽입, parent_version_id 는 현재 승격 원본.
  const insertResp = (await (
    supabase.from("partner_missions" as never) as unknown as {
      insert: (r: Row) => {
        select: (c: string) => {
          single: () => Promise<SbRespOne<{ id: string }>>;
        };
      };
    }
  )
    .insert({
      partner_id: targetMission.partner_id,
      kind: targetMission.kind,
      title: newTitle,
      description: newDescription,
      icon: targetMission.icon,
      default_acorns: newAcorns,
      config_json: newConfig,
      version: targetMission.version + 1,
      parent_version_id: targetMission.id,
      status: "DRAFT",
      visibility: "DRAFT",
    } satisfies Row)
    .select("id")
    .single()) as SbRespOne<{ id: string }>;

  if (insertResp.error || !insertResp.data) {
    throw new Error(
      `새 미션 버전 생성 실패: ${insertResp.error?.message ?? "unknown"}`
    );
  }

  const newMissionId = insertResp.data.id;
  const nowIso = new Date().toISOString();

  const updResp = (await (
    supabase.from("mission_contributions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      status: "ACCEPTED",
      reviewed_by: partner.name,
      reviewed_at: nowIso,
      review_note: (reviewNote ?? "").trim() || null,
      accepted_version_id: newMissionId,
    })
    .eq("id", contributionId)) as { error: SbErr };

  if (updResp.error) {
    throw new Error(`수용 처리 실패: ${updResp.error.message}`);
  }

  revalidatePath("/partner/missions/contributions");
  revalidatePath("/partner/missions");
  revalidatePath(`/partner/missions/${newMissionId}/edit`);
  revalidatePath(`/org/${contribution.proposed_by_org_id}`);
}

/* -------------------------------------------------------------------------- */
/* 3) rejectContributionAction — 지사가 제안을 반려                              */
/* -------------------------------------------------------------------------- */

export async function rejectContributionAction(
  contributionId: string,
  reviewNote: string
): Promise<void> {
  const partner = await requirePartner();
  if (partner.role !== "OWNER" && partner.role !== "MANAGER") {
    throw new Error("권한이 없어요 (OWNER/MANAGER만 가능)");
  }
  if (!contributionId) throw new Error("contributionId가 비어 있어요");

  const trimmedNote = (reviewNote ?? "").trim();
  if (!trimmedNote) {
    throw new Error("반려 사유를 적어 주세요");
  }
  if (trimmedNote.length > 2000) {
    throw new Error("반려 사유가 너무 길어요 (2000자 이하)");
  }

  const contribution = await loadContributionById(contributionId);
  if (!contribution) throw new Error("제안을 찾을 수 없어요");
  if (contribution.status !== "PROPOSED") {
    throw new Error("이미 처리된 제안이에요");
  }

  const targetMission = await loadPartnerMissionById(
    contribution.target_partner_mission_id
  );
  if (!targetMission) throw new Error("대상 미션을 찾을 수 없어요");
  if (targetMission.partner_id !== partner.id) {
    throw new Error("다른 지사의 미션은 반려할 수 없어요");
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const resp = (await (
    supabase.from("mission_contributions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      status: "REJECTED",
      reviewed_by: partner.name,
      reviewed_at: nowIso,
      review_note: trimmedNote,
    })
    .eq("id", contributionId)) as { error: SbErr };

  if (resp.error) {
    throw new Error(`반려 실패: ${resp.error.message}`);
  }

  revalidatePath("/partner/missions/contributions");
  revalidatePath("/partner/missions");
  revalidatePath(`/org/${contribution.proposed_by_org_id}`);
}

/* -------------------------------------------------------------------------- */
/* 4) withdrawContributionAction — 기관이 본인 제안 회수                         */
/* -------------------------------------------------------------------------- */

export async function withdrawContributionAction(
  contributionId: string
): Promise<void> {
  const org = await requireOrg();
  if (!contributionId) throw new Error("contributionId가 비어 있어요");

  const contribution = await loadContributionById(contributionId);
  if (!contribution) throw new Error("제안을 찾을 수 없어요");
  if (contribution.proposed_by_org_id !== org.orgId) {
    throw new Error("다른 기관의 제안은 회수할 수 없어요");
  }
  if (contribution.status !== "PROPOSED") {
    throw new Error("이미 처리된 제안은 회수할 수 없어요");
  }

  const supabase = await createClient();

  const resp = (await (
    supabase.from("mission_contributions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ status: "WITHDRAWN" satisfies ContributionStatus })
    .eq("id", contributionId)) as { error: SbErr };

  if (resp.error) {
    throw new Error(`회수 실패: ${resp.error.message}`);
  }

  revalidatePath(
    `/org/${org.orgId}/missions/${contribution.source_org_mission_id}/edit`
  );
  revalidatePath("/partner/missions/contributions");
}
