"use server";

// Phase 2.E — 실제 구현.
// 승인/반려/라디오 모더레이션/FM 세션 제어 로직.
//
// 트랜잭션 설계:
//   PostgREST 단일 SQL 트랜잭션이 없으므로 순차 쿼리로 구성.
//   - 도토리 지급(ledger)은 UNIQUE(source_type='mission_submission', source_id)
//     부분 인덱스로 23505 충돌 시 멱등 성공 처리 → 이중 크레딧 방지.
//   - submission 상태 변경이 먼저 실패하면 ledger/balance 건드리지 않음.
//   - ledger 성공 후 balance update 가 실패하면 drift 가능 — admin reconcile 대상.

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  loadFmSessionById,
  loadOrgMissionById,
} from "@/lib/missions/queries";
import { approveSubmissionCore } from "@/lib/missions/review-core";
import { dispatchNotify } from "@/lib/notify/dispatch";
import type {
  MissionRadioQueueRow,
  MissionSubmissionRow,
} from "@/lib/missions/types";

type Row = Record<string, unknown>;
type SbErr = { message: string; code?: string } | null;
type SbRespOne<T> = { data: T | null; error: SbErr };

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

async function loadSubmissionById(
  supabase: SupabaseServerClient,
  submissionId: string
): Promise<MissionSubmissionRow | null> {
  const resp = (await (
    supabase.from("mission_submissions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<MissionSubmissionRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", submissionId)
    .maybeSingle()) as SbRespOne<MissionSubmissionRow>;

  return resp.data ?? null;
}

async function loadRadioQueueById(
  supabase: SupabaseServerClient,
  queueId: string
): Promise<MissionRadioQueueRow | null> {
  const resp = (await (
    supabase.from("mission_radio_queue" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<MissionRadioQueueRow>>;
        };
      };
    }
  )
    .select("*")
    .eq("id", queueId)
    .maybeSingle()) as SbRespOne<MissionRadioQueueRow>;

  return resp.data ?? null;
}

async function updateSubmissionStatus(
  supabase: SupabaseServerClient,
  submissionId: string,
  patch: Row
): Promise<SbErr> {
  const resp = (await (
    supabase.from("mission_submissions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update(patch)
    .eq("id", submissionId)) as { error: SbErr };
  return resp.error;
}

/* -------------------------------------------------------------------------- */
/* 1) approveSubmissionAction                                                 */
/* -------------------------------------------------------------------------- */

export async function approveSubmissionAction(
  submissionId: string
): Promise<void> {
  const org = await requireOrg();
  const result = await approveSubmissionCore({
    submissionId,
    reviewedBy: org.managerId,
    expectedOrgId: org.orgId,
  });

  // 승인이 실제로 이번에 발생한 경우에만 알림 발송 (idempotent re-approve 스킵).
  // 외부 API(SMS) 실패가 승인 처리 자체를 막지 않도록 try/catch 로 완전히 격리.
  if (result.ok && !result.alreadyApproved && !result.skipped) {
    try {
      const supabase = await createClient();
      const submission = await loadSubmissionById(supabase, submissionId);
      if (submission) {
        const mission = await loadOrgMissionById(submission.org_mission_id);
        const missionTitle = mission?.title ?? "미션";
        const awarded = result.acorns ?? 0;
        await dispatchNotify(supabase as unknown as SupabaseClient, {
          userId: submission.user_id,
          kind: "MISSION_APPROVED",
          type: "mission_approved",
          title: "스탬프가 승인됐어요",
          message:
            awarded > 0
              ? `"${missionTitle}"에서 도토리 ${awarded}개를 얻었어요!`
              : `"${missionTitle}" 스탬프가 승인됐어요!`,
          channels: ["inapp", "sms"],
        });
      }
    } catch (e) {
      console.error("[review-actions/approve] notify dispatch failed (non-fatal)", {
        msg: e instanceof Error ? e.message : String(e),
      });
    }
  }

  revalidatePath(`/org/${org.orgId}/missions/review`);
  revalidatePath(`/org/${org.orgId}/missions/radio`);
  revalidatePath("/stampbook");
  revalidatePath("/home");
}

/* -------------------------------------------------------------------------- */
/* 2) rejectSubmissionAction                                                  */
/* -------------------------------------------------------------------------- */

export async function rejectSubmissionAction(
  submissionId: string,
  reason: string
): Promise<void> {
  const org = await requireOrg();
  if (!submissionId) throw new Error("submissionId가 비어 있어요");
  const trimmed = (reason ?? "").trim();
  if (!trimmed) throw new Error("반려 사유를 입력해 주세요");

  const supabase = await createClient();
  const submission = await loadSubmissionById(supabase, submissionId);
  if (!submission) throw new Error("제출을 찾을 수 없어요");

  const mission = await loadOrgMissionById(submission.org_mission_id);
  if (!mission) throw new Error("연결된 미션을 찾을 수 없어요");
  if (mission.org_id !== org.orgId) {
    throw new Error("다른 기관의 제출이에요");
  }

  if (submission.status === "REJECTED") {
    revalidatePath(`/org/${org.orgId}/missions/review`);
    return; // idempotent
  }
  if (
    submission.status !== "SUBMITTED" &&
    submission.status !== "PENDING_REVIEW"
  ) {
    throw new Error("이미 처리된 제출이에요");
  }

  const updErr = await updateSubmissionStatus(supabase, submissionId, {
    status: "REJECTED",
    reject_reason: trimmed,
    reviewed_at: new Date().toISOString(),
    reviewed_by: org.managerId,
  });
  if (updErr) throw new Error(`반려 실패: ${updErr.message}`);

  revalidatePath(`/org/${org.orgId}/missions/review`);
}

/* -------------------------------------------------------------------------- */
/* 3) approveRadioAction                                                      */
/* -------------------------------------------------------------------------- */

export async function approveRadioAction(queueId: string): Promise<void> {
  const org = await requireOrg();
  if (!queueId) throw new Error("queueId가 비어 있어요");

  const supabase = await createClient();
  const queue = await loadRadioQueueById(supabase, queueId);
  if (!queue) throw new Error("라디오 큐를 찾을 수 없어요");
  if (queue.org_id !== org.orgId) {
    throw new Error("다른 기관의 라디오 큐에요");
  }

  const updResp = (await (
    supabase.from("mission_radio_queue" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      moderation: "APPROVED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", queueId)) as { error: SbErr };

  if (updResp.error) {
    throw new Error(`라디오 승인 실패: ${updResp.error.message}`);
  }

  // 연결된 submission 을 APPROVED 로 전환 + 도토리 지급 (멱등)
  try {
    await approveSubmissionCore({
      submissionId: queue.submission_id,
      reviewedBy: org.managerId,
      expectedOrgId: org.orgId,
    });
  } catch (e) {
    console.error("[review-actions/approveRadio] submission approve failed", {
      msg: e instanceof Error ? e.message : String(e),
    });
    // 큐는 이미 APPROVED — 로그만 남기고 진행
  }

  revalidatePath(`/org/${org.orgId}/missions/radio`);
  revalidatePath(`/org/${org.orgId}/missions/review`);
  revalidatePath(`/org/${org.orgId}/tori-fm`);
}

/* -------------------------------------------------------------------------- */
/* 4) hideRadioAction                                                         */
/* -------------------------------------------------------------------------- */

export async function hideRadioAction(queueId: string): Promise<void> {
  const org = await requireOrg();
  if (!queueId) throw new Error("queueId가 비어 있어요");

  const supabase = await createClient();
  const queue = await loadRadioQueueById(supabase, queueId);
  if (!queue) throw new Error("라디오 큐를 찾을 수 없어요");
  if (queue.org_id !== org.orgId) {
    throw new Error("다른 기관의 라디오 큐에요");
  }

  const patch: Row = {
    moderation: "HIDDEN",
    updated_at: new Date().toISOString(),
  };
  if (queue.fm_session_id) {
    patch.fm_session_id = null;
    patch.position = null;
  }

  const resp = (await (
    supabase.from("mission_radio_queue" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update(patch)
    .eq("id", queueId)) as { error: SbErr };

  if (resp.error) throw new Error(`숨김 실패: ${resp.error.message}`);

  // 재생 중인 큐였다면 세션 current_queue_id 도 해제
  if (queue.fm_session_id) {
    await (
      supabase.from("tori_fm_sessions" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => Promise<{ error: SbErr }>;
          };
        };
      }
    )
      .update({
        current_queue_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", queue.fm_session_id)
      .eq("current_queue_id", queueId);
  }

  revalidatePath(`/org/${org.orgId}/missions/radio`);
  revalidatePath(`/org/${org.orgId}/tori-fm`);
}

/* -------------------------------------------------------------------------- */
/* 5) revertRadioAction                                                       */
/* -------------------------------------------------------------------------- */

export async function revertRadioAction(queueId: string): Promise<void> {
  const org = await requireOrg();
  if (!queueId) throw new Error("queueId가 비어 있어요");

  const supabase = await createClient();
  const queue = await loadRadioQueueById(supabase, queueId);
  if (!queue) throw new Error("라디오 큐를 찾을 수 없어요");
  if (queue.org_id !== org.orgId) {
    throw new Error("다른 기관의 라디오 큐에요");
  }

  const resp = (await (
    supabase.from("mission_radio_queue" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      moderation: "PENDING",
      fm_session_id: null,
      position: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", queueId)) as { error: SbErr };

  if (resp.error) throw new Error(`되돌리기 실패: ${resp.error.message}`);

  revalidatePath(`/org/${org.orgId}/missions/radio`);
  revalidatePath(`/org/${org.orgId}/tori-fm`);
}

/* -------------------------------------------------------------------------- */
/* 6) createFmSessionAction                                                   */
/* -------------------------------------------------------------------------- */

export async function createFmSessionAction(
  orgId: string,
  formData: FormData
): Promise<void> {
  const org = await requireOrg();
  if (orgId !== org.orgId) {
    throw new Error("다른 기관의 세션은 만들 수 없어요");
  }

  const name = String(formData.get("name") ?? "").trim();
  const scheduledStartRaw = String(formData.get("scheduled_start") ?? "").trim();
  const scheduledEndRaw = String(formData.get("scheduled_end") ?? "").trim();
  const eventIdRaw = String(formData.get("event_id") ?? "").trim();

  if (!name) throw new Error("세션 이름을 입력해 주세요");
  if (!scheduledStartRaw || !scheduledEndRaw) {
    throw new Error("시작·종료 일시를 모두 입력해 주세요");
  }

  // datetime-local(YYYY-MM-DDTHH:mm) → 로컬타임으로 파싱 → ISO.
  const start = new Date(scheduledStartRaw);
  const end = new Date(scheduledEndRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("일시 형식이 올바르지 않아요");
  }
  if (end.getTime() <= start.getTime()) {
    throw new Error("종료 일시는 시작 일시보다 뒤여야 해요");
  }

  const supabase = await createClient();

  const row: Row = {
    org_id: org.orgId,
    name,
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
    is_live: false,
    event_id: eventIdRaw || null,
  };

  const resp = (await (
    supabase.from("tori_fm_sessions" as never) as unknown as {
      insert: (r: Row) => Promise<{ error: SbErr }>;
    }
  ).insert(row)) as { error: SbErr };

  if (resp.error) throw new Error(`세션 생성 실패: ${resp.error.message}`);

  revalidatePath(`/org/${org.orgId}/tori-fm`);
}

/* -------------------------------------------------------------------------- */
/* 7) startFmBroadcastAction                                                  */
/* -------------------------------------------------------------------------- */

export async function startFmBroadcastAction(
  sessionId: string
): Promise<void> {
  const org = await requireOrg();
  if (!sessionId) throw new Error("sessionId가 비어 있어요");

  const session = await loadFmSessionById(sessionId);
  if (!session) throw new Error("FM 세션을 찾을 수 없어요");
  if (session.org_id !== org.orgId) {
    throw new Error("다른 기관의 세션이에요");
  }

  const supabase = await createClient();

  // 동일 org 의 다른 LIVE 세션이 있으면 먼저 중단
  const otherLiveResp = (await (
    supabase.from("tori_fm_sessions" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: boolean) => {
            neq: (k: string, v: string) => Promise<{
              data: Array<{ id: string }> | null;
              error: SbErr;
            }>;
          };
        };
      };
    }
  )
    .select("id")
    .eq("org_id", org.orgId)
    .eq("is_live", true)
    .neq("id", sessionId)) as {
    data: Array<{ id: string }> | null;
    error: SbErr;
  };

  const otherLive = otherLiveResp.data ?? [];
  if (otherLive.length > 0) {
    const nowIso = new Date().toISOString();
    for (const r of otherLive) {
      await (
        supabase.from("tori_fm_sessions" as never) as unknown as {
          update: (p: Row) => {
            eq: (k: string, v: string) => Promise<{ error: SbErr }>;
          };
        }
      )
        .update({
          is_live: false,
          ended_at: nowIso,
          current_queue_id: null,
          updated_at: nowIso,
        })
        .eq("id", r.id);
    }
  }

  const startedAt = session.started_at ?? new Date().toISOString();
  const updResp = (await (
    supabase.from("tori_fm_sessions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      is_live: true,
      started_at: startedAt,
      ended_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)) as { error: SbErr };

  if (updResp.error) {
    throw new Error(`방송 시작 실패: ${updResp.error.message}`);
  }

  revalidatePath(`/org/${org.orgId}/tori-fm`);
  revalidatePath(`/screen/tori-fm/${org.orgId}`);
  revalidatePath("/tori-fm");
}

/* -------------------------------------------------------------------------- */
/* 8) stopFmBroadcastAction                                                   */
/* -------------------------------------------------------------------------- */

export async function stopFmBroadcastAction(
  sessionId: string
): Promise<void> {
  const org = await requireOrg();
  if (!sessionId) throw new Error("sessionId가 비어 있어요");

  const session = await loadFmSessionById(sessionId);
  if (!session) throw new Error("FM 세션을 찾을 수 없어요");
  if (session.org_id !== org.orgId) {
    throw new Error("다른 기관의 세션이에요");
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const updResp = (await (
    supabase.from("tori_fm_sessions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      is_live: false,
      ended_at: nowIso,
      current_queue_id: null,
      updated_at: nowIso,
    })
    .eq("id", sessionId)) as { error: SbErr };

  if (updResp.error) {
    throw new Error(`방송 종료 실패: ${updResp.error.message}`);
  }

  revalidatePath(`/org/${org.orgId}/tori-fm`);
  revalidatePath(`/screen/tori-fm/${org.orgId}`);
  revalidatePath("/tori-fm");
}

/* -------------------------------------------------------------------------- */
/* 9) setCurrentQueueAction                                                   */
/* -------------------------------------------------------------------------- */

export async function setCurrentQueueAction(
  sessionId: string,
  queueId: string
): Promise<void> {
  const org = await requireOrg();
  if (!sessionId || !queueId) throw new Error("파라미터가 비어 있어요");

  const session = await loadFmSessionById(sessionId);
  if (!session) throw new Error("FM 세션을 찾을 수 없어요");
  if (session.org_id !== org.orgId) {
    throw new Error("다른 기관의 세션이에요");
  }

  const supabase = await createClient();
  const queue = await loadRadioQueueById(supabase, queueId);
  if (!queue) throw new Error("라디오 큐를 찾을 수 없어요");
  if (queue.org_id !== org.orgId) {
    throw new Error("다른 기관의 라디오 큐에요");
  }
  if (queue.moderation !== "APPROVED") {
    throw new Error("승인된 큐만 재생할 수 있어요");
  }

  const nowIso = new Date().toISOString();

  // 1) 이전 current_queue_id 를 played 표시 (이미 played 면 건드리지 않음)
  const prior = session.current_queue_id;
  if (prior && prior !== queueId) {
    await (
      supabase.from("mission_radio_queue" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => {
            is: (k: string, v: null) => Promise<{ error: SbErr }>;
          };
        };
      }
    )
      .update({ played_at: nowIso, updated_at: nowIso })
      .eq("id", prior)
      .is("played_at", null);
  }

  // 2) 세션에 편성되지 않은 큐면 fm_session_id + position 할당
  if (queue.fm_session_id !== sessionId) {
    const maxResp = (await (
      supabase.from("mission_radio_queue" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean; nullsFirst?: boolean }
            ) => {
              limit: (n: number) => Promise<{
                data: Array<{ position: number | null }> | null;
              }>;
            };
          };
        };
      }
    )
      .select("position")
      .eq("fm_session_id", sessionId)
      .order("position", { ascending: false, nullsFirst: false })
      .limit(1)) as {
      data: Array<{ position: number | null }> | null;
    };

    const maxPos = maxResp.data?.[0]?.position ?? 0;
    const newPosition = maxPos + 1;

    const assignResp = (await (
      supabase.from("mission_radio_queue" as never) as unknown as {
        update: (p: Row) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      }
    )
      .update({
        fm_session_id: sessionId,
        position: newPosition,
        updated_at: nowIso,
      })
      .eq("id", queueId)) as { error: SbErr };

    if (assignResp.error) {
      throw new Error(`큐 편성 실패: ${assignResp.error.message}`);
    }
  }

  // 3) 세션 current_queue_id 교체
  const updResp = (await (
    supabase.from("tori_fm_sessions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      current_queue_id: queueId,
      updated_at: nowIso,
    })
    .eq("id", sessionId)) as { error: SbErr };

  if (updResp.error) {
    throw new Error(`재생 설정 실패: ${updResp.error.message}`);
  }

  revalidatePath(`/org/${org.orgId}/tori-fm`);
  revalidatePath(`/screen/tori-fm/${org.orgId}`);
  revalidatePath("/tori-fm");
}

/* -------------------------------------------------------------------------- */
/* 10) updateFmSessionAction                                                  */
/* -------------------------------------------------------------------------- */

export async function updateFmSessionAction(
  sessionId: string,
  formData: FormData
): Promise<void> {
  const org = await requireOrg();
  if (!sessionId) throw new Error("sessionId가 비어 있어요");

  const session = await loadFmSessionById(sessionId);
  if (!session) throw new Error("FM 세션을 찾을 수 없어요");
  if (session.org_id !== org.orgId) {
    throw new Error("다른 기관의 세션이에요");
  }

  const name = String(formData.get("name") ?? "").trim();
  const scheduledStartRaw = String(formData.get("scheduled_start") ?? "").trim();
  const scheduledEndRaw = String(formData.get("scheduled_end") ?? "").trim();

  if (!name) throw new Error("세션 이름을 입력해 주세요");
  if (!scheduledStartRaw || !scheduledEndRaw) {
    throw new Error("시작·종료 일시를 모두 입력해 주세요");
  }

  const start = new Date(scheduledStartRaw);
  const end = new Date(scheduledEndRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("일시 형식이 올바르지 않아요");
  }
  if (end.getTime() <= start.getTime()) {
    throw new Error("종료 일시는 시작 일시보다 뒤여야 해요");
  }

  // LIVE 중인 세션은 일정 변경 거부 (운영 혼란 방지)
  if (session.is_live) {
    throw new Error("진행 중인 세션은 일정을 바꿀 수 없어요. 먼저 종료해 주세요.");
  }

  const supabase = await createClient();

  const resp = (await (
    supabase.from("tori_fm_sessions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      name,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)) as { error: SbErr };

  if (resp.error) throw new Error(`세션 수정 실패: ${resp.error.message}`);

  revalidatePath(`/org/${org.orgId}/tori-fm`);
  revalidatePath(`/org/${org.orgId}/tori-fm/${sessionId}`);
}

/* -------------------------------------------------------------------------- */
/* 11) assignQueueToSessionAction                                             */
/* -------------------------------------------------------------------------- */

export async function assignQueueToSessionAction(
  sessionId: string,
  queueId: string
): Promise<void> {
  const org = await requireOrg();
  if (!sessionId || !queueId) throw new Error("파라미터가 비어 있어요");

  const session = await loadFmSessionById(sessionId);
  if (!session) throw new Error("FM 세션을 찾을 수 없어요");
  if (session.org_id !== org.orgId) throw new Error("다른 기관의 세션이에요");

  const supabase = await createClient();
  const queue = await loadRadioQueueById(supabase, queueId);
  if (!queue) throw new Error("라디오 큐를 찾을 수 없어요");
  if (queue.org_id !== org.orgId) throw new Error("다른 기관의 라디오 큐에요");
  if (queue.moderation !== "APPROVED") {
    throw new Error("승인된 큐만 편성할 수 있어요");
  }
  if (queue.fm_session_id && queue.fm_session_id !== sessionId) {
    throw new Error("이미 다른 세션에 편성된 큐에요. 먼저 해제해 주세요.");
  }
  if (queue.fm_session_id === sessionId) {
    // idempotent
    revalidatePath(`/org/${org.orgId}/tori-fm/${sessionId}`);
    return;
  }

  // max position 찾기
  const maxResp = (await (
    supabase.from("mission_radio_queue" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean; nullsFirst?: boolean }
          ) => {
            limit: (n: number) => Promise<{
              data: Array<{ position: number | null }> | null;
            }>;
          };
        };
      };
    }
  )
    .select("position")
    .eq("fm_session_id", sessionId)
    .order("position", { ascending: false, nullsFirst: false })
    .limit(1)) as {
    data: Array<{ position: number | null }> | null;
  };

  const maxPos = maxResp.data?.[0]?.position ?? 0;
  const newPosition = maxPos + 1;

  const nowIso = new Date().toISOString();
  const resp = (await (
    supabase.from("mission_radio_queue" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      fm_session_id: sessionId,
      position: newPosition,
      updated_at: nowIso,
    })
    .eq("id", queueId)) as { error: SbErr };

  if (resp.error) throw new Error(`편성 실패: ${resp.error.message}`);

  revalidatePath(`/org/${org.orgId}/tori-fm`);
  revalidatePath(`/org/${org.orgId}/tori-fm/${sessionId}`);
}

/* -------------------------------------------------------------------------- */
/* 12) unassignQueueFromSessionAction                                         */
/* -------------------------------------------------------------------------- */

export async function unassignQueueFromSessionAction(
  sessionId: string,
  queueId: string
): Promise<void> {
  const org = await requireOrg();
  if (!sessionId || !queueId) throw new Error("파라미터가 비어 있어요");

  const session = await loadFmSessionById(sessionId);
  if (!session) throw new Error("FM 세션을 찾을 수 없어요");
  if (session.org_id !== org.orgId) throw new Error("다른 기관의 세션이에요");

  if (session.current_queue_id === queueId) {
    throw new Error("지금 재생 중인 큐는 편성 해제할 수 없어요. 먼저 다른 큐로 바꿔 주세요.");
  }

  const supabase = await createClient();
  const queue = await loadRadioQueueById(supabase, queueId);
  if (!queue) throw new Error("라디오 큐를 찾을 수 없어요");
  if (queue.org_id !== org.orgId) throw new Error("다른 기관의 라디오 큐에요");
  if (queue.fm_session_id !== sessionId) {
    // idempotent — 이미 해제된 상태
    revalidatePath(`/org/${org.orgId}/tori-fm/${sessionId}`);
    return;
  }

  const nowIso = new Date().toISOString();
  const resp = (await (
    supabase.from("mission_radio_queue" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      fm_session_id: null,
      position: null,
      updated_at: nowIso,
    })
    .eq("id", queueId)) as { error: SbErr };

  if (resp.error) throw new Error(`편성 해제 실패: ${resp.error.message}`);

  revalidatePath(`/org/${org.orgId}/tori-fm`);
  revalidatePath(`/org/${org.orgId}/tori-fm/${sessionId}`);
}
