"use server";

// Phase 3.E — 협동(COOP) 미션 서버 액션.
//
// 상태 머신:
//   WAITING → PAIRED            (joinCoopSession)
//   PAIRED  → A_DONE | B_DONE   (confirmCoopSide, 한쪽만 제출)
//   A_DONE  → COMPLETED         (confirmCoopSide, role='B')
//   B_DONE  → COMPLETED         (confirmCoopSide, role='A')
//   WAITING|PAIRED → CANCELLED  (cancelCoopSession, initiator 만)
//
// 도토리 지급은 COMPLETED 전이 시점에 양측에게 동시 지급한다.
// user_acorn_transactions 의 UNIQUE(source_type, source_id) 부분 인덱스로
// 23505 충돌 시 멱등 성공 처리 → 이중 크레딧 방지.

import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/lib/user-auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  loadActiveCoopSessionForUser,
  loadCoopSessionById,
  loadCoopSessionByPairCode,
  loadOrgMissionById,
} from "@/lib/missions/queries";
import type {
  CoopMissionConfig,
  CoopSessionState,
  MissionCoopSessionRow,
} from "@/lib/missions/types";

type Row = Record<string, unknown>;
type SbErr = { message: string; code?: string } | null;
type SbRespOne<T> = { data: T | null; error: SbErr };
type SbResp<T> = { data: T[] | null; error: SbErr };

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 6자 페어 코드 — 시각적 혼동 문자(I, O, 0, 1) 제거.
 */
function genPairCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function normalizePairCode(raw: string): string {
  return (raw ?? "").trim().toUpperCase();
}

function activeStateOrThrow(state: CoopSessionState): void {
  if (
    state === "COMPLETED" ||
    state === "EXPIRED" ||
    state === "CANCELLED"
  ) {
    throw new Error("이미 종료된 협동 세션이에요");
  }
}

/**
 * mission_submissions INSERT — idempotency_key UNIQUE 충돌(23505)은 멱등 성공.
 * 기존 row 가 있으면 해당 id 를 조회해서 반환.
 */
async function insertOrReuseCoopSubmission(
  supabase: SupabaseServerClient,
  params: {
    orgMissionId: string;
    userId: string;
    sessionId: string;
    pairCode: string;
    role: "A" | "B";
  }
): Promise<string> {
  const idempotencyKey = `coop_${params.sessionId}_${params.role}`;

  const insertResp = (await (
    supabase.from("mission_submissions" as never) as unknown as {
      insert: (r: Row) => {
        select: (c: string) => {
          single: () => Promise<SbRespOne<{ id: string }>>;
        };
      };
    }
  )
    .insert({
      org_mission_id: params.orgMissionId,
      user_id: params.userId,
      child_id: null,
      status: "AUTO_APPROVED",
      payload_json: {
        pair_code: params.pairCode,
        session_id: params.sessionId,
        role: params.role,
      },
      awarded_acorns: 0,
      idempotency_key: idempotencyKey,
    } satisfies Row)
    .select("id")
    .single()) as SbRespOne<{ id: string }>;

  if (insertResp.data?.id) return insertResp.data.id;

  // 23505 (idempotency_key 중복) — 기존 row id 재사용
  if (insertResp.error?.code === "23505") {
    const lookup = (await (
      supabase.from("mission_submissions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<SbRespOne<{ id: string }>>;
          };
        };
      }
    )
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle()) as SbRespOne<{ id: string }>;
    if (lookup.data?.id) return lookup.data.id;
  }

  console.error("[coop/insertOrReuseSubmission] error", {
    code: insertResp.error?.code,
  });
  throw new Error(`제출 실패: ${insertResp.error?.message ?? "unknown"}`);
}

/**
 * 완료 시점에 양측에 도토리 지급 (ledger + balance bump + submission.awarded_acorns 업데이트).
 * user_acorn_transactions 의 부분 UNIQUE 인덱스(source_type, source_id) 로 23505 멱등.
 */
async function awardCoopAcorns(
  supabase: SupabaseServerClient,
  params: {
    userId: string;
    amount: number;
    submissionId: string;
    memo: string;
  }
): Promise<void> {
  const { userId, amount, submissionId, memo } = params;
  if (!amount || amount <= 0) return;

  // 1) submission.awarded_acorns 업데이트 (0 → amount)
  await (
    supabase.from("mission_submissions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ awarded_acorns: amount })
    .eq("id", submissionId);

  // 2) ledger insert (23505 → idempotent)
  const txResp = (await (
    supabase.from("user_acorn_transactions" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: SbErr }>;
    }
  ).insert({
    user_id: userId,
    amount,
    reason: "MISSION",
    source_type: "mission_submission",
    source_id: submissionId,
    memo,
  } satisfies Row)) as { error: SbErr };

  if (txResp.error) {
    if (txResp.error.code === "23505") return; // 이미 크레딧 — balance 도 예전에 반영됨
    console.error("[coop/awardAcorns] ledger error", {
      code: txResp.error.code,
    });
    throw new Error(`도토리 지급 실패: ${txResp.error.message}`);
  }

  // 3) balance bump
  const balResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbRespOne<{ acorn_balance: number | null }>
          >;
        };
      };
    }
  )
    .select("acorn_balance")
    .eq("id", userId)
    .maybeSingle()) as SbRespOne<{ acorn_balance: number | null }>;

  const current = balResp.data?.acorn_balance ?? 0;
  const next = current + amount;

  const updResp = (await (
    supabase.from("app_users" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ acorn_balance: next })
    .eq("id", userId)) as { error: SbErr };

  if (updResp.error) {
    console.error("[coop/awardAcorns] balance error", {
      code: updResp.error.code,
    });
    // ledger 는 박혔지만 balance drift — 운영 reconcile 대상
  }
}

function revalidateAll(orgMissionId: string): void {
  revalidatePath(`/missions/${orgMissionId}`);
  revalidatePath("/home");
  revalidatePath("/stampbook");
}

/* -------------------------------------------------------------------------- */
/* 1) createCoopSessionAction                                                 */
/* -------------------------------------------------------------------------- */

export async function createCoopSessionAction(
  orgMissionId: string,
  childId?: string
): Promise<{ sessionId: string; pairCode: string }> {
  const user = await requireAppUser();
  if (!orgMissionId) throw new Error("미션을 찾을 수 없어요");

  const mission = await loadOrgMissionById(orgMissionId);
  if (!mission) throw new Error("미션을 찾을 수 없어요");
  if (mission.org_id !== user.orgId) {
    throw new Error("다른 기관의 미션은 이용할 수 없어요");
  }
  if (mission.kind !== "COOP") {
    throw new Error("협동 미션이 아니에요");
  }
  if (!mission.is_active) {
    throw new Error("현재 진행할 수 없는 미션이에요");
  }

  const cfg = (mission.config_json ?? {}) as Partial<CoopMissionConfig>;
  const matchWindowMin = Math.max(
    1,
    Math.min(60 * 6, cfg.match_window_min ?? 30)
  );

  // 이미 진행 중인 세션이 있으면 멱등 반환
  const existing = await loadActiveCoopSessionForUser(user.id, orgMissionId);
  if (existing) {
    return {
      sessionId: existing.id,
      pairCode: existing.pair_code,
    };
  }

  const supabase = await createClient();
  const expiresAt = new Date(
    Date.now() + matchWindowMin * 60 * 1000
  ).toISOString();

  // pair_code 유니크 충돌 시 최대 5회 재시도
  let lastErr: SbErr = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const pairCode = genPairCode();
    const insertResp = (await (
      supabase.from("mission_coop_sessions" as never) as unknown as {
        insert: (r: Row) => {
          select: (c: string) => {
            single: () => Promise<
              SbRespOne<{ id: string; pair_code: string }>
            >;
          };
        };
      }
    )
      .insert({
        org_mission_id: orgMissionId,
        pair_code: pairCode,
        initiator_user_id: user.id,
        initiator_child_id: childId ?? null,
        state: "WAITING",
        expires_at: expiresAt,
      } satisfies Row)
      .select("id, pair_code")
      .single()) as SbRespOne<{ id: string; pair_code: string }>;

    if (insertResp.data?.id) {
      revalidateAll(orgMissionId);
      return {
        sessionId: insertResp.data.id,
        pairCode: insertResp.data.pair_code,
      };
    }

    lastErr = insertResp.error;
    if (insertResp.error?.code !== "23505") {
      // UNIQUE 외 에러는 즉시 실패
      break;
    }
    // 23505 (pair_code 충돌) → 새 코드로 재시도
  }

  console.error("[coop/createSession] error", { code: lastErr?.code });
  throw new Error(
    `협동 세션 생성 실패: ${lastErr?.message ?? "페어 코드 충돌이 반복됐어요"}`
  );
}

/* -------------------------------------------------------------------------- */
/* 2) joinCoopSessionAction                                                   */
/* -------------------------------------------------------------------------- */

export async function joinCoopSessionAction(
  orgMissionId: string,
  pairCode: string,
  childId?: string
): Promise<{ sessionId: string }> {
  const user = await requireAppUser();
  if (!orgMissionId) throw new Error("미션을 찾을 수 없어요");

  const code = normalizePairCode(pairCode);
  if (!code || code.length < 4) {
    throw new Error("페어 코드를 입력해 주세요");
  }

  const session = await loadCoopSessionByPairCode(code);
  if (!session) {
    throw new Error("해당 페어 코드를 찾을 수 없어요");
  }
  if (session.org_mission_id !== orgMissionId) {
    throw new Error("이 미션의 페어 코드가 아니에요");
  }
  if (session.state !== "WAITING") {
    throw new Error("이미 매칭된 세션이에요");
  }
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    throw new Error("페어 코드 유효 시간이 지났어요");
  }
  if (session.initiator_user_id === user.id) {
    throw new Error("본인 코드에는 참여할 수 없어요");
  }
  if (session.partner_user_id) {
    throw new Error("이미 다른 짝꿍이 합류했어요");
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  // race-safe update: state='WAITING' 조건부 UPDATE, 영향 행 수로 경쟁 판정
  const resp = (await (
    supabase.from("mission_coop_sessions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            select: (c: string) => Promise<SbResp<{ id: string }>>;
          };
        };
      };
    }
  )
    .update({
      partner_user_id: user.id,
      partner_child_id: childId ?? null,
      state: "PAIRED",
      paired_at: nowIso,
    })
    .eq("id", session.id)
    .eq("state", "WAITING")
    .select("id")) as SbResp<{ id: string }>;

  const updated = resp.data ?? [];
  if (updated.length === 0) {
    throw new Error("이미 다른 짝꿍이 합류했어요");
  }

  revalidateAll(orgMissionId);
  return { sessionId: session.id };
}

/* -------------------------------------------------------------------------- */
/* 3) confirmCoopSideAction                                                   */
/* -------------------------------------------------------------------------- */

/**
 * 내부 버전 — user/session 검증은 외부에서 완료됐다고 가정.
 * uploadCoopSharedPhotoAction 에서도 재사용.
 */
async function performConfirmCoopSide(
  supabase: SupabaseServerClient,
  params: {
    session: MissionCoopSessionRow;
    role: "A" | "B";
    userId: string;
    orgMissionId: string;
  }
): Promise<void> {
  const { session, role, userId, orgMissionId } = params;

  // 이미 해당 side 가 완료된 경우 멱등
  if (role === "A" && session.state === "A_DONE") return;
  if (role === "B" && session.state === "B_DONE") return;
  if (session.state === "COMPLETED") return;

  activeStateOrThrow(session.state);
  if (session.state === "WAITING") {
    throw new Error("짝꿍이 아직 합류하지 않았어요");
  }
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    throw new Error("세션 유효 시간이 지났어요");
  }

  // 1) submission insert (멱등)
  const submissionId = await insertOrReuseCoopSubmission(supabase, {
    orgMissionId,
    userId,
    sessionId: session.id,
    pairCode: session.pair_code,
    role,
  });

  // 2) 새 상태 계산
  const otherDone =
    (role === "A" && session.state === "B_DONE") ||
    (role === "B" && session.state === "A_DONE");

  const newState: CoopSessionState = otherDone
    ? "COMPLETED"
    : role === "A"
      ? "A_DONE"
      : "B_DONE";

  const patch: Row = {
    state: newState,
    ...(role === "A"
      ? { initiator_submission_id: submissionId }
      : { partner_submission_id: submissionId }),
  };
  if (newState === "COMPLETED") {
    patch.completed_at = new Date().toISOString();
  }

  // race-safe: 이전 상태를 조건으로 UPDATE
  const updResp = (await (
    supabase.from("mission_coop_sessions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            select: (c: string) => Promise<SbResp<{ id: string }>>;
          };
        };
      };
    }
  )
    .update(patch)
    .eq("id", session.id)
    .eq("state", session.state)
    .select("id")) as SbResp<{ id: string }>;

  if ((updResp.data ?? []).length === 0) {
    // 경쟁: 다른 side 가 동시에 진행됨 — 세션 재로드 후 COMPLETED 처리 시도
    const fresh = await loadCoopSessionById(session.id);
    if (!fresh) throw new Error("세션이 사라졌어요");
    if (fresh.state === "COMPLETED") {
      // 이미 COMPLETED — awarding 은 아래에서 멱등 재실행
    } else if (
      (role === "A" && fresh.state === "A_DONE") ||
      (role === "B" && fresh.state === "B_DONE")
    ) {
      // 중복 confirm — 멱등
      revalidateAll(orgMissionId);
      return;
    } else {
      throw new Error("세션 상태가 변경됐어요. 다시 시도해 주세요");
    }
  }

  // 3) COMPLETED 전이 시 양측에 도토리 지급
  const finalSession =
    newState === "COMPLETED"
      ? await loadCoopSessionById(session.id)
      : null;

  if (newState === "COMPLETED" && finalSession) {
    const mission = await loadOrgMissionById(orgMissionId);
    const amount = mission?.acorns ?? 0;

    if (amount > 0) {
      const initiatorSubId = finalSession.initiator_submission_id;
      const partnerSubId = finalSession.partner_submission_id;

      if (initiatorSubId) {
        await awardCoopAcorns(supabase, {
          userId: finalSession.initiator_user_id,
          amount,
          submissionId: initiatorSubId,
          memo: `COOP:${mission?.title ?? ""}`,
        });
      }
      if (partnerSubId && finalSession.partner_user_id) {
        await awardCoopAcorns(supabase, {
          userId: finalSession.partner_user_id,
          amount,
          submissionId: partnerSubId,
          memo: `COOP:${mission?.title ?? ""}`,
        });
      }
    }
  }

  revalidateAll(orgMissionId);
}

export async function confirmCoopSideAction(
  sessionId: string,
  role: "A" | "B"
): Promise<void> {
  const user = await requireAppUser();
  if (!sessionId) throw new Error("세션을 찾을 수 없어요");
  if (role !== "A" && role !== "B") {
    throw new Error("잘못된 역할이에요");
  }

  const session = await loadCoopSessionById(sessionId);
  if (!session) throw new Error("세션을 찾을 수 없어요");

  if (role === "A" && session.initiator_user_id !== user.id) {
    throw new Error("이 세션의 initiator 가 아니에요");
  }
  if (role === "B") {
    if (!session.partner_user_id) {
      throw new Error("짝꿍이 아직 합류하지 않았어요");
    }
    if (session.partner_user_id !== user.id) {
      throw new Error("이 세션의 partner 가 아니에요");
    }
  }

  const supabase = await createClient();
  await performConfirmCoopSide(supabase, {
    session,
    role,
    userId: user.id,
    orgMissionId: session.org_mission_id,
  });
}

/* -------------------------------------------------------------------------- */
/* 4) uploadCoopSharedPhotoAction                                             */
/* -------------------------------------------------------------------------- */

export async function uploadCoopSharedPhotoAction(
  sessionId: string,
  photoUrl: string
): Promise<void> {
  const user = await requireAppUser();
  if (!sessionId) throw new Error("세션을 찾을 수 없어요");
  const url = (photoUrl ?? "").trim();
  if (!url) throw new Error("사진 URL이 비어 있어요");
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("사진 URL이 올바르지 않아요");
  }

  const session = await loadCoopSessionById(sessionId);
  if (!session) throw new Error("세션을 찾을 수 없어요");

  const isInitiator = session.initiator_user_id === user.id;
  const isPartner = session.partner_user_id === user.id;
  if (!isInitiator && !isPartner) {
    throw new Error("이 세션의 참여자가 아니에요");
  }

  const mission = await loadOrgMissionById(session.org_mission_id);
  if (!mission) throw new Error("미션을 찾을 수 없어요");
  const cfg = (mission.config_json ?? {}) as Partial<CoopMissionConfig>;
  if (cfg.completion_rule !== "SHARED_PHOTO") {
    throw new Error("이 미션은 사진 공유 미션이 아니에요");
  }

  activeStateOrThrow(session.state);
  if (session.state === "WAITING") {
    throw new Error("짝꿍이 아직 합류하지 않았어요");
  }

  const supabase = await createClient();

  // 1) shared_photo_url 기록
  const updResp = (await (
    supabase.from("mission_coop_sessions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ shared_photo_url: url })
    .eq("id", session.id)) as { error: SbErr };

  if (updResp.error) {
    throw new Error(`사진 저장 실패: ${updResp.error.message}`);
  }

  // 2) 업로더 측을 자동 confirm — partner 가 별도로 confirm 하면 COMPLETED
  const role: "A" | "B" = isInitiator ? "A" : "B";
  const fresh = await loadCoopSessionById(session.id);
  if (fresh) {
    await performConfirmCoopSide(supabase, {
      session: fresh,
      role,
      userId: user.id,
      orgMissionId: fresh.org_mission_id,
    });
  }

  revalidateAll(session.org_mission_id);
}

/* -------------------------------------------------------------------------- */
/* 5) cancelCoopSessionAction                                                 */
/* -------------------------------------------------------------------------- */

export async function cancelCoopSessionAction(
  sessionId: string
): Promise<void> {
  const user = await requireAppUser();
  if (!sessionId) throw new Error("세션을 찾을 수 없어요");

  const session = await loadCoopSessionById(sessionId);
  if (!session) throw new Error("세션을 찾을 수 없어요");
  if (session.initiator_user_id !== user.id) {
    throw new Error("세션을 만든 사람만 취소할 수 있어요");
  }

  if (session.state === "CANCELLED") {
    revalidateAll(session.org_mission_id);
    return; // idempotent
  }
  if (session.state !== "WAITING" && session.state !== "PAIRED") {
    throw new Error("이미 진행된 세션은 취소할 수 없어요");
  }

  const supabase = await createClient();
  const resp = (await (
    supabase.from("mission_coop_sessions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ state: "CANCELLED" })
    .eq("id", session.id)) as { error: SbErr };

  if (resp.error) {
    throw new Error(`세션 취소 실패: ${resp.error.message}`);
  }

  revalidateAll(session.org_mission_id);
}
