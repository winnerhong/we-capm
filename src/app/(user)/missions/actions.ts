"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAppUser } from "@/lib/user-auth-guard";
import {
  loadBroadcastById,
  loadOrgMissionById,
  loadOrgQuestPackById,
  loadTreasureProgress,
  loadUserSubmissionForMission,
  sumAcornsForPack,
} from "@/lib/missions/queries";
import { computeTier } from "@/lib/missions/progress";
import {
  capAcornAmount,
  loadAcornCapContext,
} from "@/lib/missions/acorn-cap";
import type {
  BroadcastMissionConfig,
  FinalRewardMissionConfig,
  PhotoApprovalMissionConfig,
  PhotoMissionConfig,
  QrQuizMissionConfig,
  RadioMissionConfig,
  SubmissionStatus,
  TreasureMissionConfig,
  TreasureUnlockMethod,
} from "@/lib/missions/types";

type Row = Record<string, unknown>;

function asStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/* -------------------------------------------------------------------------- */
/* uploadMissionPhotoAction — 미션 제출 사진 업로드 (서비스 롤)                 */
/* -------------------------------------------------------------------------- */

const SUBMISSION_BUCKET = "submission-photos";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

/**
 * 토리로 참가자가 사진 미션에 사진을 업로드한다.
 *
 * 토리로 참가자는 Supabase Auth 가 아닌 campnic_user 쿠키 세션을 사용하므로
 * 클라이언트 storage RLS 를 통과할 수 없다. 인증은 requireAppUser() 로 검증하고
 * 실제 업로드는 service-role 클라이언트로 수행한다.
 *
 * 경로: missions/{org_mission_id}/{user_id}/{ts}-{rand}.{ext}
 */
export async function uploadMissionPhotoAction(
  orgMissionId: string,
  formData: FormData
): Promise<{ url: string; path: string }> {
  const user = await requireAppUser();
  if (!orgMissionId) throw new Error("미션을 찾을 수 없어요");

  const mission = await loadOrgMissionById(orgMissionId);
  if (!mission) throw new Error("미션을 찾을 수 없어요");
  if (mission.org_id !== user.orgId) {
    throw new Error("다른 기관의 미션에는 업로드할 수 없어요");
  }
  if (!mission.is_active) throw new Error("현재 진행할 수 없는 미션이에요");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("파일이 비어 있어요");
  if (file.size === 0) throw new Error("빈 파일이에요");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("사진은 5MB 이하만 업로드할 수 있어요");
  }
  const mime = file.type || "image/jpeg";
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("이미지 형식만 업로드할 수 있어요 (jpg/png/webp/heic)");
  }

  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/heic"
          ? "heic"
          : "jpg";
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `missions/${mission.id}/${user.id}/${Date.now()}-${rand}.${ext}`;

  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from(SUBMISSION_BUCKET)
    .upload(path, file, {
      contentType: mime,
      upsert: false,
    });
  if (upErr) {
    console.error("[uploadMissionPhoto] failed", { path, msg: upErr.message });
    throw new Error(`업로드 실패: ${upErr.message}`);
  }

  // 사설 버킷 — 서명 URL 발급 (24시간). 표시 측에서 만료 시 재요청 패턴.
  const { data: signed, error: signErr } = await admin.storage
    .from(SUBMISSION_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);
  if (signErr || !signed?.signedUrl) {
    console.error("[uploadMissionPhoto] sign failed", {
      path,
      msg: signErr?.message,
    });
    throw new Error("업로드는 됐지만 URL 발급에 실패했어요");
  }

  return { url: signed.signedUrl, path };
}

/* -------------------------------------------------------------------------- */
/* submitMissionAction                                                        */
/* -------------------------------------------------------------------------- */

export async function submitMissionAction(
  orgMissionId: string,
  payload: unknown
): Promise<{ redirectTo?: string }> {
  const user = await requireAppUser();
  if (!orgMissionId) throw new Error("미션을 찾을 수 없어요");

  const mission = await loadOrgMissionById(orgMissionId);
  if (!mission) throw new Error("미션을 찾을 수 없어요");
  if (mission.org_id !== user.orgId) {
    throw new Error("다른 기관의 미션은 제출할 수 없어요");
  }
  if (!mission.is_active) throw new Error("현재 진행할 수 없는 미션이에요");

  // 이미 승인/대기 상태인 제출이 있으면 재제출 금지
  // 단 BROADCAST 는 broadcast_id 단위로 멱등 → idempotency_key 로 중복 방지하고 여기서는 통과
  const existing = await loadUserSubmissionForMission(user.id, mission.id);
  if (
    mission.kind !== "BROADCAST" &&
    existing &&
    (existing.status === "AUTO_APPROVED" ||
      existing.status === "APPROVED" ||
      existing.status === "SUBMITTED" ||
      existing.status === "PENDING_REVIEW")
  ) {
    throw new Error("이미 제출된 미션이에요");
  }

  // Validate payload per kind + build idempotency key + per-kind payload_json
  const config = (mission.config_json ?? {}) as Record<string, unknown>;

  let idempotencyKey: string;
  let payloadJson: Record<string, unknown>;
  // 일부 kind 는 자체적으로 상태/도토리를 강제 오버라이드
  let forcedStatus: SubmissionStatus | null = null;
  let forcedAcorns: number | null | undefined = undefined;

  if (mission.kind === "PHOTO") {
    const p = payload as { photo_urls?: unknown; caption?: unknown };
    const urls = Array.isArray(p.photo_urls)
      ? p.photo_urls.filter((u): u is string => typeof u === "string" && u.length > 0)
      : [];
    if (urls.length === 0) throw new Error("사진을 첨부해 주세요");
    const photoCfg = config as Partial<PhotoMissionConfig>;
    const minPhotos = Math.max(1, photoCfg.min_photos ?? 1);
    if (urls.length < minPhotos) {
      throw new Error(`사진을 ${minPhotos}장 이상 올려주세요`);
    }
    const caption = asStr(p.caption);
    if (photoCfg.require_caption && caption.length === 0) {
      throw new Error("한 줄 소감을 입력해 주세요");
    }
    idempotencyKey = `${user.id}|${mission.id}|photo_${Date.now()}`;
    payloadJson = {
      photo_urls: urls,
      ...(caption ? { caption } : {}),
    };
  } else if (mission.kind === "QR_QUIZ") {
    const p = payload as {
      qr_scanned_token?: unknown;
      quiz_answer?: unknown;
    };
    const token = asStr(p.qr_scanned_token);
    if (!token) throw new Error("QR 코드를 입력해 주세요");
    const qrCfg = config as Partial<QrQuizMissionConfig>;
    const correctToken = asStr(qrCfg.qr_token);
    if (!correctToken || token !== correctToken) {
      throw new Error("QR 코드가 일치하지 않아요");
    }
    const answer = asStr(p.quiz_answer);
    if (qrCfg.quiz_type && qrCfg.quiz_type !== "NONE") {
      if (!answer) throw new Error("퀴즈 정답을 입력해 주세요");
      const correctAnswer = asStr(qrCfg.quiz_answer);
      if (!correctAnswer) throw new Error("이 퀴즈는 정답이 설정되지 않았어요");
      if (answer.toLowerCase() !== correctAnswer.toLowerCase()) {
        throw new Error("정답이 아니에요. 다시 시도해 주세요");
      }
    }
    idempotencyKey = `${user.id}|${mission.id}|${token}`;
    payloadJson = {
      qr_scanned_token: token,
      ...(answer ? { quiz_answer: answer } : {}),
    };
  } else if (mission.kind === "PHOTO_APPROVAL") {
    const p = payload as { photo_urls?: unknown; caption?: unknown };
    const urls = Array.isArray(p.photo_urls)
      ? p.photo_urls.filter(
          (u): u is string => typeof u === "string" && u.length > 0
        )
      : [];
    if (urls.length === 0) throw new Error("사진을 첨부해 주세요");
    const paCfg = config as Partial<PhotoApprovalMissionConfig>;
    const minPhotos = Math.max(1, paCfg.min_photos ?? 1);
    if (urls.length < minPhotos) {
      throw new Error(`사진을 ${minPhotos}장 이상 올려주세요`);
    }
    const caption = asStr(p.caption);
    idempotencyKey = `${user.id}|${mission.id}|photo_approval_${Date.now()}`;
    payloadJson = {
      photo_urls: urls,
      ...(caption ? { caption } : {}),
    };
    // PHOTO_APPROVAL 는 정의상 항상 PENDING_REVIEW — approval_mode 무시
    forcedStatus = "PENDING_REVIEW";
    forcedAcorns = null;
  } else if (mission.kind === "TREASURE") {
    const p = payload as {
      steps_cleared?: unknown;
      final_qr_token_scanned?: unknown;
    };
    const treasureCfg = config as Partial<TreasureMissionConfig>;
    const expectedToken = asStr(treasureCfg.final_qr_token);
    const scanned = asStr(p.final_qr_token_scanned);
    if (!expectedToken || scanned !== expectedToken) {
      throw new Error("최종 QR 코드가 일치하지 않아요");
    }
    const totalSteps = Array.isArray(treasureCfg.steps)
      ? treasureCfg.steps.length
      : 0;
    if (totalSteps === 0) {
      throw new Error("이 보물찾기는 아직 단계가 설정되지 않았어요");
    }
    // 서버 측 treasure_progress 재확인 (클라이언트 조작 방지)
    const progress = await loadTreasureProgress(user.id, mission.id);
    const unlockedSet = new Set(progress.map((r) => r.step_order));
    if (unlockedSet.size < totalSteps) {
      throw new Error(
        `아직 해제하지 못한 단계가 있어요 (${unlockedSet.size}/${totalSteps})`
      );
    }
    const stepsCleared = Array.isArray(p.steps_cleared)
      ? (p.steps_cleared as unknown[]).filter(
          (x): x is { step_order: number; method: string; at: string } =>
            !!x &&
            typeof x === "object" &&
            typeof (x as { step_order?: unknown }).step_order === "number" &&
            typeof (x as { method?: unknown }).method === "string" &&
            typeof (x as { at?: unknown }).at === "string"
        )
      : [];
    idempotencyKey = `${user.id}|${mission.id}|treasure_final`;
    payloadJson = {
      steps_cleared: stepsCleared,
      final_qr_token_scanned: scanned,
    };
    // TREASURE 는 즉시 도토리 지급 — 완주 자체가 보상
    forcedStatus = "AUTO_APPROVED";
    forcedAcorns = mission.acorns;
  } else if (mission.kind === "RADIO") {
    const p = payload as {
      song_title?: unknown;
      artist?: unknown;
      story_text?: unknown;
      child_name?: unknown;
    };
    const song = asStr(p.song_title);
    const story = asStr(p.story_text);
    if (!song) throw new Error("신청곡 제목을 입력해 주세요");
    if (!story) throw new Error("사연을 입력해 주세요");
    const radioCfg = config as Partial<RadioMissionConfig>;
    const maxLength = Math.max(20, Math.min(2000, radioCfg.max_length ?? 300));
    if (story.length > maxLength) {
      throw new Error(`사연은 ${maxLength}자 이내로 써주세요`);
    }
    const artistName = asStr(p.artist);
    const childName = asStr(p.child_name);
    idempotencyKey = `${user.id}|${mission.id}|radio_${Date.now()}`;
    payloadJson = {
      song_title: song,
      story_text: story,
      ...(artistName ? { artist: artistName } : {}),
      ...(childName ? { child_name: childName } : {}),
    };
    // RADIO 는 운영자 모더레이션 대기 — 도토리는 승인 후 지급
    forcedStatus = "PENDING_REVIEW";
    forcedAcorns = null;
  } else if (mission.kind === "COOP") {
    // COOP 는 전용 액션(confirmCoopSideAction / uploadCoopSharedPhotoAction)을 사용
    throw new Error(
      "협동 미션은 전용 액션을 사용해 주세요 (confirmCoopSideAction)"
    );
  } else if (mission.kind === "BROADCAST") {
    const p = payload as {
      broadcast_id?: unknown;
      content_type?: unknown;
      content?: unknown;
    };
    const broadcastId = asStr(p.broadcast_id);
    if (!broadcastId) throw new Error("돌발 미션 정보를 찾을 수 없어요");

    const broadcast = await loadBroadcastById(broadcastId);
    if (!broadcast) throw new Error("돌발 미션을 찾을 수 없어요");

    // 활성 상태 검증
    if (broadcast.cancelled_at) {
      throw new Error("취소된 돌발 미션이에요");
    }
    if (new Date(broadcast.expires_at).getTime() <= Date.now()) {
      throw new Error("돌발 미션 시간이 이미 종료됐어요");
    }
    if (broadcast.org_mission_id !== mission.id) {
      throw new Error("미션과 돌발 정보가 일치하지 않아요");
    }

    // target_scope 검증 — ORG/EVENT 는 기관 소속 확인, ALL 은 통과
    if (
      broadcast.target_scope === "ORG" &&
      broadcast.triggered_by_org_id !== user.orgId
    ) {
      throw new Error("이 기관의 돌발 미션이 아니에요");
    }
    if (
      broadcast.target_scope === "EVENT" &&
      broadcast.triggered_by_org_id !== user.orgId
    ) {
      throw new Error("이 기관의 돌발 미션이 아니에요");
    }

    // 콘텐츠 검증
    const ct =
      p.content_type === "PHOTO" || p.content_type === "TEXT"
        ? p.content_type
        : null;
    if (!ct) throw new Error("제출 종류를 확인해 주세요");

    const broadcastCfg = config as Partial<BroadcastMissionConfig>;
    if (broadcastCfg.submission_kind && broadcastCfg.submission_kind !== ct) {
      throw new Error(
        `이 돌발은 ${broadcastCfg.submission_kind === "PHOTO" ? "사진" : "텍스트"} 제출만 가능해요`
      );
    }

    const content = asStr(p.content);
    if (!content) throw new Error("내용을 입력해 주세요");
    if (ct === "TEXT" && content.length > 500) {
      throw new Error("텍스트는 500자 이내로 입력해 주세요");
    }
    if (ct === "PHOTO" && !/^https?:\/\//i.test(content)) {
      throw new Error("사진 URL이 올바르지 않아요");
    }

    idempotencyKey = `${user.id}|${mission.id}|bc_${broadcastId}`;
    payloadJson = {
      broadcast_id: broadcastId,
      content_type: ct,
      content,
    };
    // BROADCAST 는 즉시 도토리 지급
    forcedStatus = "AUTO_APPROVED";
    forcedAcorns = mission.acorns;
  } else if (mission.kind === "FINAL_REWARD") {
    throw new Error(
      "최종 보상은 교환권 발급을 통해 진행해 주세요"
    );
  } else {
    throw new Error("이 미션 종류는 아직 제출할 수 없어요");
  }

  // Determine initial status (forced > approval_mode)
  let status: SubmissionStatus;
  let awardedAcorns: number | null;
  if (forcedStatus) {
    status = forcedStatus;
    awardedAcorns = forcedAcorns ?? null;
  } else {
    switch (mission.approval_mode) {
      case "AUTO":
        status = "AUTO_APPROVED";
        awardedAcorns = mission.acorns;
        break;
      case "AUTO_24H":
        status = "SUBMITTED";
        awardedAcorns = null;
        break;
      case "MANUAL_TEACHER":
      case "PARTNER_REVIEW":
        status = "PENDING_REVIEW";
        awardedAcorns = null;
        break;
      default:
        status = "SUBMITTED";
        awardedAcorns = null;
    }
  }

  // 즉시 지급 path 에서만 상한 적용 — SUBMITTED/PENDING_REVIEW 는 승인 시점에 별도 처리
  let capMemoSuffix = "";
  if (
    status === "AUTO_APPROVED" &&
    awardedAcorns !== null &&
    awardedAcorns > 0
  ) {
    const ctx = await loadAcornCapContext(user.id, user.orgId);
    const { allowed, reason } = capAcornAmount(awardedAcorns, ctx);
    if (allowed !== awardedAcorns) {
      awardedAcorns = allowed; // 0 가능
      if (reason) capMemoSuffix = ` (${reason})`;
    }
  }

  const supabase = await createClient();

  // Insert submission
  const submissionRow: Row = {
    org_mission_id: mission.id,
    user_id: user.id,
    child_id: null,
    status,
    payload_json: payloadJson,
    awarded_acorns: awardedAcorns,
    idempotency_key: idempotencyKey,
  };

  const insertResp = (await (
    supabase.from("mission_submissions" as never) as unknown as {
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
    .insert(submissionRow)
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (insertResp.error || !insertResp.data) {
    console.error("[missions/submit] insert error", insertResp.error);
    throw new Error(
      `제출 실패: ${insertResp.error?.message ?? "unknown"}`
    );
  }

  const submissionId = insertResp.data.id;

  // RADIO: 모더레이션 큐에 자동 인큐
  if (mission.kind === "RADIO") {
    const queueResp = (await (
      supabase.from("mission_radio_queue" as never) as unknown as {
        insert: (r: Row) => Promise<{
          error: { message: string } | null;
        }>;
      }
    ).insert({
      submission_id: submissionId,
      org_id: mission.org_id,
      moderation: "PENDING",
    })) as { error: { message: string } | null };
    if (queueResp.error) {
      console.error("[missions/submit] radio queue insert error", queueResp.error);
      // 큐 삽입 실패해도 submission 은 남김 — 운영자가 수동으로 회복 가능
    }
  }

  // If auto-approved: award acorns (transaction + balance bump)
  // awardedAcorns 는 상한 클램프를 이미 거친 값. 0 이면 스탬프만 찍고 지급 생략(일일 상한 초과 등).
  if (status === "AUTO_APPROVED" && awardedAcorns && awardedAcorns > 0) {
    // 1) Insert user_acorn_transactions (idempotent via unique index on source_type/source_id)
    const txResp = (await (
      supabase.from("user_acorn_transactions" as never) as unknown as {
        insert: (r: Row) => Promise<{
          error: { message: string } | null;
        }>;
      }
    ).insert({
      user_id: user.id,
      amount: awardedAcorns,
      reason: "MISSION",
      source_type: "mission_submission",
      source_id: submissionId,
      memo: `${mission.title}${capMemoSuffix}`,
    })) as { error: { message: string } | null };

    if (txResp.error) {
      console.error("[missions/submit] tx insert error", txResp.error);
      // 실패해도 submission은 남김 — partial failure 허용
    } else {
      // 2) Bump app_users.acorn_balance
      const balResp = (await (
        supabase.from("app_users" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{
                data: { acorn_balance: number | null } | null;
              }>;
            };
          };
        }
      )
        .select("acorn_balance")
        .eq("id", user.id)
        .maybeSingle()) as {
        data: { acorn_balance: number | null } | null;
      };

      const current = balResp.data?.acorn_balance ?? 0;
      const nextBalance = current + awardedAcorns;

      await (
        supabase.from("app_users" as never) as unknown as {
          update: (p: Row) => {
            eq: (k: string, v: string) => Promise<{
              error: { message: string } | null;
            }>;
          };
        }
      )
        .update({ acorn_balance: nextBalance })
        .eq("id", user.id);
    }
  }

  // packId 결정 → redirect
  const packId = mission.quest_pack_id;
  const redirectTo = packId ? `/stampbook/${packId}` : "/stampbook";

  revalidatePath("/home");
  revalidatePath("/stampbook");
  if (packId) revalidatePath(`/stampbook/${packId}`);
  revalidatePath(`/missions/${mission.id}`);

  return { redirectTo };
}

/* -------------------------------------------------------------------------- */
/* unlockTreasureStepAction                                                   */
/* -------------------------------------------------------------------------- */

/**
 * 보물찾기 특정 단계를 해제한다.
 *  - AUTO : 이전 단계가 모두 해제된 상태에서만 허용
 *  - QR / ANSWER : answer 가 step.answer 와 일치해야 함
 *                  (ANSWER 는 trim + case-insensitive, QR 은 정확히 일치)
 *  - 이미 해제된 단계라면 조용히 return (멱등)
 */
export async function unlockTreasureStepAction(
  orgMissionId: string,
  stepOrder: number,
  method: TreasureUnlockMethod,
  answer?: string
): Promise<void> {
  const user = await requireAppUser();
  if (!orgMissionId) throw new Error("미션을 찾을 수 없어요");
  if (!Number.isInteger(stepOrder) || stepOrder < 1) {
    throw new Error("잘못된 단계 번호에요");
  }

  const mission = await loadOrgMissionById(orgMissionId);
  if (!mission) throw new Error("미션을 찾을 수 없어요");
  if (mission.org_id !== user.orgId) {
    throw new Error("다른 기관의 미션이에요");
  }
  if (mission.kind !== "TREASURE") {
    throw new Error("보물찾기 미션이 아니에요");
  }
  if (!mission.is_active) {
    throw new Error("현재 진행할 수 없는 미션이에요");
  }

  const cfg = (mission.config_json ?? {}) as Partial<TreasureMissionConfig>;
  const steps = Array.isArray(cfg.steps) ? cfg.steps : [];
  const step = steps.find((s) => s.order === stepOrder);
  if (!step) throw new Error("해당 단계를 찾을 수 없어요");

  // unlock_rule / method 일치 검증
  if (step.unlock_rule !== method) {
    throw new Error("이 단계는 다른 방식으로 해제해야 해요");
  }

  // 답 검증
  if (method === "QR") {
    const expected = (step.answer ?? "").trim();
    const got = (answer ?? "").trim();
    if (!expected || got !== expected) {
      throw new Error("이 단계의 QR 코드가 아니에요");
    }
  } else if (method === "ANSWER") {
    const expected = (step.answer ?? "").trim();
    const got = (answer ?? "").trim();
    if (!expected) {
      throw new Error("이 단계는 정답이 설정되지 않았어요");
    }
    if (got.toLowerCase() !== expected.toLowerCase()) {
      throw new Error("정답이 아니에요. 다시 시도해 주세요");
    }
  }
  // AUTO 는 별도 검증 없음 — 이전 단계 완료 조건만

  // 이전 단계가 모두 해제되어 있는지 (건너뛰기 방지)
  const progress = await loadTreasureProgress(user.id, mission.id);
  const unlockedSet = new Set(progress.map((r) => r.step_order));
  const sortedOrders = steps
    .map((s) => s.order)
    .sort((a, b) => a - b);
  for (const o of sortedOrders) {
    if (o >= stepOrder) break;
    if (!unlockedSet.has(o)) {
      throw new Error(`${o}단계를 먼저 풀어주세요`);
    }
  }

  // 이미 해제됐다면 멱등
  if (unlockedSet.has(stepOrder)) {
    revalidatePath(`/missions/${mission.id}`);
    return;
  }

  const supabase = await createClient();

  // INSERT (UNIQUE(org_mission_id, user_id, step_order) 로 중복 방지)
  const insertResp = (await (
    supabase.from("mission_treasure_progress" as never) as unknown as {
      insert: (r: Row) => Promise<{
        error: { message: string; code?: string } | null;
      }>;
    }
  ).insert({
    org_mission_id: mission.id,
    user_id: user.id,
    step_order: stepOrder,
    unlock_method: method,
  })) as { error: { message: string; code?: string } | null };

  if (insertResp.error) {
    // UNIQUE violation (23505) 은 동시성 충돌 — 무해하게 처리
    if (insertResp.error.code === "23505") {
      revalidatePath(`/missions/${mission.id}`);
      return;
    }
    console.error("[missions/unlock-treasure] error", insertResp.error);
    throw new Error(
      `단계 해제 실패: ${insertResp.error.message ?? "unknown"}`
    );
  }

  revalidatePath(`/missions/${mission.id}`);
}

/* -------------------------------------------------------------------------- */
/* issueFinalRewardAction                                                     */
/* -------------------------------------------------------------------------- */

function generateRedemptionToken(): string {
  // 'fr_' + 20자 hex
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `fr_${hex}`;
}

export async function issueFinalRewardAction(
  orgMissionId: string,
  packId: string
): Promise<{ redemptionId: string; qrToken: string }> {
  const user = await requireAppUser();
  if (!orgMissionId || !packId) throw new Error("잘못된 요청이에요");

  const [mission, pack] = await Promise.all([
    loadOrgMissionById(orgMissionId),
    loadOrgQuestPackById(packId),
  ]);

  if (!mission) throw new Error("미션을 찾을 수 없어요");
  if (mission.kind !== "FINAL_REWARD") {
    throw new Error("최종 보상 미션이 아니에요");
  }
  if (mission.org_id !== user.orgId) {
    throw new Error("다른 기관의 미션은 발급할 수 없어요");
  }
  if (!pack || pack.id !== mission.quest_pack_id) {
    throw new Error("스탬프북을 찾을 수 없어요");
  }
  if (pack.org_id !== user.orgId) {
    throw new Error("다른 기관의 스탬프북이에요");
  }

  const config = (mission.config_json ?? {}) as Partial<FinalRewardMissionConfig>;
  const tiers = Array.isArray(config.tiers) ? config.tiers : [];
  if (tiers.length === 0) throw new Error("보상 티어가 설정되지 않았어요");

  const totalAcorns = await sumAcornsForPack(user.id, packId);
  const tier = computeTier(tiers, totalAcorns);
  if (!tier) {
    throw new Error("아직 최저 티어 도토리에 도달하지 않았어요");
  }

  const ttlHours = Math.max(
    1,
    Math.min(24 * 30, config.redemption_ttl_hours ?? 24)
  );
  const expiresAt = new Date(
    Date.now() + ttlHours * 60 * 60 * 1000
  ).toISOString();

  const qrToken = generateRedemptionToken();

  const supabase = await createClient();

  const insertResp = (await (
    supabase.from("mission_final_redemptions" as never) as unknown as {
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
    .insert({
      user_id: user.id,
      quest_pack_id: packId,
      tier_label: tier.label,
      tier_threshold: tier.threshold,
      total_acorns_at_issue: totalAcorns,
      qr_token: qrToken,
      expires_at: expiresAt,
    } satisfies Row)
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (insertResp.error || !insertResp.data) {
    console.error("[missions/issue-reward] error", insertResp.error);
    throw new Error(
      `교환권 발급 실패: ${insertResp.error?.message ?? "unknown"}`
    );
  }

  revalidatePath(`/stampbook/${packId}`);
  revalidatePath(`/missions/${orgMissionId}`);

  return { redemptionId: insertResp.data.id, qrToken };
}
