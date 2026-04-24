"use server";

// 기관 행사(Event) server actions — requireOrg 가드 + assertEventOwned 소유 검증.
//
// 규칙:
//  - throw 는 에러 메시지 한국어.
//  - M:N 전체 교체 (setEventXxxAction) 는 DELETE → INSERT 2-step.
//    트랜잭션을 걸 수 없으므로 부분 실패 시 junction 이 비워질 수 있음 — 호출부는
//    재시도 가능하게 설계할 것.
//  - revalidatePath 는 목록(/org/[orgId]/events) + 상세(/org/[orgId]/events/[eventId]).

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadOrgEventById } from "./queries";
import type { OrgEventStatus } from "./types";
import { isOrgEventStatus } from "./types";

type Row = Record<string, unknown>;
type SbErr = { message: string; code?: string } | null;
type SbRespOne<T> = { data: T | null; error: SbErr };

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 행사 소유권 검증 — event.org_id 가 현재 세션의 orgId 와 일치해야 함.
 * 없으면 throw. 반환값은 OrgEventRow (호출부가 재사용 가능).
 */
async function assertEventOwned(
  eventId: string,
  orgId: string
): Promise<void> {
  const ev = await loadOrgEventById(eventId);
  if (!ev) throw new Error("행사를 찾을 수 없어요");
  if (ev.org_id !== orgId) {
    throw new Error("이 행사에 대한 권한이 없어요");
  }
}

function revalidateEvents(orgId: string, eventId?: string): void {
  revalidatePath(`/org/${orgId}/events`);
  if (eventId) {
    revalidatePath(`/org/${orgId}/events/${eventId}`);
  }
}

function clampString(
  raw: string | null | undefined,
  max: number
): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * ISO 문자열 파싱 검증 — 빈 값/"null"/파싱 실패 시 null.
 */
function parseIsoOrNull(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === "null") return null;
  const t = Date.parse(trimmed);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

/**
 * formData 에서 행사 필드 뽑기 — 공통 파서.
 *
 * allow_self_register:
 *  - 체크박스 value = "on" / "true" / "1" 모두 true 로 해석.
 *  - key 자체가 없으면 null (update payload 에서 제외 — 기존 값 보존).
 */
function extractEventFields(formData: FormData): {
  name: string | null;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  cover_image_url: string | null;
  status: OrgEventStatus | null;
  allow_self_register: boolean | null;
} {
  const rawStatus = String(formData.get("status") ?? "").trim();
  const rawSelfReg = formData.get("allow_self_register");
  let allowSelfRegister: boolean | null = null;
  if (rawSelfReg !== null) {
    const v = String(rawSelfReg).trim().toLowerCase();
    allowSelfRegister = v === "on" || v === "true" || v === "1";
  }
  return {
    name: clampString(String(formData.get("name") ?? ""), 100),
    description: clampString(String(formData.get("description") ?? ""), 2000),
    starts_at: parseIsoOrNull(
      formData.get("starts_at") ? String(formData.get("starts_at")) : null
    ),
    ends_at: parseIsoOrNull(
      formData.get("ends_at") ? String(formData.get("ends_at")) : null
    ),
    cover_image_url: clampString(
      String(formData.get("cover_image_url") ?? ""),
      500
    ),
    status: isOrgEventStatus(rawStatus) ? rawStatus : null,
    allow_self_register: allowSelfRegister,
  };
}

/* ========================================================================== */
/* CRUD                                                                       */
/* ========================================================================== */

/**
 * 행사 생성 — DRAFT 로 시작. 반환값으로 eventId 넘겨 호출부가 상세로 이동.
 */
export async function createOrgEventAction(
  formData: FormData
): Promise<{ ok: true; eventId: string } | { ok: false; message: string }> {
  const org = await requireOrg();

  const fields = extractEventFields(formData);
  if (!fields.name) {
    return { ok: false, message: "행사 이름을 입력해 주세요" };
  }

  // starts_at > ends_at 방지 (둘 다 있을 때만)
  if (fields.starts_at && fields.ends_at) {
    if (Date.parse(fields.starts_at) > Date.parse(fields.ends_at)) {
      return { ok: false, message: "종료 일시가 시작 일시보다 빨라요" };
    }
  }

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_events" as never) as unknown as {
      insert: (r: Row) => {
        select: (c: string) => {
          maybeSingle: () => Promise<SbRespOne<{ id: string }>>;
        };
      };
    }
  )
    .insert({
      org_id: org.orgId,
      name: fields.name,
      description: fields.description,
      starts_at: fields.starts_at,
      ends_at: fields.ends_at,
      cover_image_url: fields.cover_image_url,
      status: "DRAFT",
    } satisfies Row)
    .select("id")
    .maybeSingle()) as SbRespOne<{ id: string }>;

  if (resp.error || !resp.data?.id) {
    console.error("[org-events/create] error", {
      code: resp.error?.code,
    });
    return { ok: false, message: "행사 생성에 실패했어요" };
  }

  revalidateEvents(org.orgId, resp.data.id);
  return { ok: true, eventId: resp.data.id };
}

/**
 * 행사 수정 — formData 에 들어온 필드만 업데이트. name 은 비우면 에러.
 */
export async function updateOrgEventAction(
  eventId: string,
  formData: FormData
): Promise<void> {
  const org = await requireOrg();
  if (!eventId) throw new Error("행사를 찾을 수 없어요");

  await assertEventOwned(eventId, org.orgId);

  const fields = extractEventFields(formData);
  if (!fields.name) throw new Error("행사 이름을 입력해 주세요");

  if (fields.starts_at && fields.ends_at) {
    if (Date.parse(fields.starts_at) > Date.parse(fields.ends_at)) {
      throw new Error("종료 일시가 시작 일시보다 빨라요");
    }
  }

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_events" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      name: fields.name,
      description: fields.description,
      starts_at: fields.starts_at,
      ends_at: fields.ends_at,
      cover_image_url: fields.cover_image_url,
      ...(fields.status ? { status: fields.status } : {}),
      ...(fields.allow_self_register !== null
        ? { allow_self_register: fields.allow_self_register }
        : {}),
    } satisfies Row)
    .eq("id", eventId)) as { error: SbErr };

  if (resp.error) {
    console.error("[org-events/update] error", { code: resp.error.code });
    throw new Error("행사 수정에 실패했어요");
  }

  revalidateEvents(org.orgId, eventId);
}

/**
 * 초대링크 수신자의 자가 가입(allow_self_register) 토글.
 *  - 체크하면 미등록 번호로도 /api/auth/user-login 에서 신규 app_users 생성 가능.
 *  - 행사가 LIVE 여야 실제로 동작 (핸들러에서 이중 체크).
 */
export async function updateEventSelfRegisterAction(
  eventId: string,
  enabled: boolean
): Promise<void> {
  const org = await requireOrg();
  if (!eventId) throw new Error("행사를 찾을 수 없어요");

  await assertEventOwned(eventId, org.orgId);

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_events" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ allow_self_register: enabled } satisfies Row)
    .eq("id", eventId)) as { error: SbErr };

  if (resp.error) {
    console.error("[org-events/updateSelfRegister] error", {
      code: resp.error.code,
    });
    throw new Error("자가 가입 설정 변경에 실패했어요");
  }

  revalidateEvents(org.orgId, eventId);
}

/**
 * 행사 상태 변경 — DRAFT → LIVE → ENDED → ARCHIVED (자유 전환, 검증은 enum만).
 */
export async function updateOrgEventStatusAction(
  eventId: string,
  next: OrgEventStatus
): Promise<void> {
  const org = await requireOrg();
  if (!eventId) throw new Error("행사를 찾을 수 없어요");
  if (!isOrgEventStatus(next)) {
    throw new Error("잘못된 상태값이에요");
  }

  await assertEventOwned(eventId, org.orgId);

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_events" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ status: next } satisfies Row)
    .eq("id", eventId)) as { error: SbErr };

  if (resp.error) {
    console.error("[org-events/updateStatus] error", {
      code: resp.error.code,
      next,
    });
    throw new Error("상태 변경에 실패했어요");
  }

  revalidateEvents(org.orgId, eventId);
}

/**
 * 행사 삭제 — hard delete. junction 은 FK ON DELETE CASCADE 로 정리됨.
 */
export async function deleteOrgEventAction(eventId: string): Promise<void> {
  const org = await requireOrg();
  if (!eventId) throw new Error("행사를 찾을 수 없어요");

  await assertEventOwned(eventId, org.orgId);

  const supabase = await createClient();
  const resp = (await (
    supabase.from("org_events" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .delete()
    .eq("id", eventId)) as { error: SbErr };

  if (resp.error) {
    console.error("[org-events/delete] error", { code: resp.error.code });
    throw new Error("행사 삭제에 실패했어요");
  }

  // 상세 페이지는 사라졌으므로 목록만 revalidate.
  revalidateEvents(org.orgId);
}

/* ========================================================================== */
/* 리소스 연결 — M:N 전체 교체 패턴                                            */
/* ========================================================================== */

/**
 * ID 배열 정규화 — 중복 제거 + 빈 문자열 제거.
 */
function normalizeIds(ids: string[] | undefined | null): string[] {
  if (!ids || !Array.isArray(ids)) return [];
  const set = new Set<string>();
  for (const id of ids) {
    const s = String(id ?? "").trim();
    if (s) set.add(s);
  }
  return Array.from(set);
}

/**
 * 행사에 스탬프북 연결 — 전체 교체. sort_order 는 배열 순서 그대로.
 */
export async function setEventQuestPacksAction(
  eventId: string,
  questPackIds: string[]
): Promise<void> {
  const org = await requireOrg();
  if (!eventId) throw new Error("행사를 찾을 수 없어요");

  await assertEventOwned(eventId, org.orgId);

  const ids = normalizeIds(questPackIds);
  const supabase = await createClient();

  // 1) 기존 junction 전체 삭제
  const delResp = (await (
    supabase.from("org_event_quest_packs" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .delete()
    .eq("event_id", eventId)) as { error: SbErr };

  if (delResp.error) {
    console.error("[org-events/setQuestPacks] delete error", {
      code: delResp.error.code,
    });
    throw new Error("스탬프북 연결 초기화에 실패했어요");
  }

  // 2) 새 IDs 로 INSERT (있을 때만)
  if (ids.length > 0) {
    const rows: Row[] = ids.map((quest_pack_id, idx) => ({
      event_id: eventId,
      quest_pack_id,
      sort_order: idx,
    }));

    const insResp = (await (
      supabase.from("org_event_quest_packs" as never) as unknown as {
        insert: (r: Row[]) => Promise<{ error: SbErr }>;
      }
    ).insert(rows)) as { error: SbErr };

    if (insResp.error) {
      console.error("[org-events/setQuestPacks] insert error", {
        code: insResp.error.code,
      });
      throw new Error("스탬프북 연결에 실패했어요");
    }
  }

  revalidateEvents(org.orgId, eventId);
}

/**
 * 행사에 참가자 연결 — 전체 교체.
 */
export async function setEventParticipantsAction(
  eventId: string,
  userIds: string[]
): Promise<void> {
  const org = await requireOrg();
  if (!eventId) throw new Error("행사를 찾을 수 없어요");

  await assertEventOwned(eventId, org.orgId);

  const ids = normalizeIds(userIds);
  const supabase = await createClient();

  const delResp = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .delete()
    .eq("event_id", eventId)) as { error: SbErr };

  if (delResp.error) {
    console.error("[org-events/setParticipants] delete error", {
      code: delResp.error.code,
    });
    throw new Error("참가자 연결 초기화에 실패했어요");
  }

  if (ids.length > 0) {
    const rows: Row[] = ids.map((user_id) => ({
      event_id: eventId,
      user_id,
    }));

    const insResp = (await (
      supabase.from("org_event_participants" as never) as unknown as {
        insert: (r: Row[]) => Promise<{ error: SbErr }>;
      }
    ).insert(rows)) as { error: SbErr };

    if (insResp.error) {
      console.error("[org-events/setParticipants] insert error", {
        code: insResp.error.code,
      });
      throw new Error("참가자 연결에 실패했어요");
    }
  }

  revalidateEvents(org.orgId, eventId);
}

/**
 * 행사에 프로그램 연결 — 전체 교체.
 */
export async function setEventProgramsAction(
  eventId: string,
  programIds: string[]
): Promise<void> {
  const org = await requireOrg();
  if (!eventId) throw new Error("행사를 찾을 수 없어요");

  await assertEventOwned(eventId, org.orgId);

  const ids = normalizeIds(programIds);
  const supabase = await createClient();

  const delResp = (await (
    supabase.from("org_event_programs" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .delete()
    .eq("event_id", eventId)) as { error: SbErr };

  if (delResp.error) {
    console.error("[org-events/setPrograms] delete error", {
      code: delResp.error.code,
    });
    throw new Error("프로그램 연결 초기화에 실패했어요");
  }

  if (ids.length > 0) {
    const rows: Row[] = ids.map((org_program_id) => ({
      event_id: eventId,
      org_program_id,
    }));

    const insResp = (await (
      supabase.from("org_event_programs" as never) as unknown as {
        insert: (r: Row[]) => Promise<{ error: SbErr }>;
      }
    ).insert(rows)) as { error: SbErr };

    if (insResp.error) {
      console.error("[org-events/setPrograms] insert error", {
        code: insResp.error.code,
      });
      throw new Error("프로그램 연결에 실패했어요");
    }
  }

  revalidateEvents(org.orgId, eventId);
}

/**
 * 행사에 숲길 연결 — 전체 교체.
 */
export async function setEventTrailsAction(
  eventId: string,
  trailIds: string[]
): Promise<void> {
  const org = await requireOrg();
  if (!eventId) throw new Error("행사를 찾을 수 없어요");

  await assertEventOwned(eventId, org.orgId);

  const ids = normalizeIds(trailIds);
  const supabase = await createClient();

  const delResp = (await (
    supabase.from("org_event_trails" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .delete()
    .eq("event_id", eventId)) as { error: SbErr };

  if (delResp.error) {
    console.error("[org-events/setTrails] delete error", {
      code: delResp.error.code,
    });
    throw new Error("숲길 연결 초기화에 실패했어요");
  }

  if (ids.length > 0) {
    const rows: Row[] = ids.map((trail_id) => ({
      event_id: eventId,
      trail_id,
    }));

    const insResp = (await (
      supabase.from("org_event_trails" as never) as unknown as {
        insert: (r: Row[]) => Promise<{ error: SbErr }>;
      }
    ).insert(rows)) as { error: SbErr };

    if (insResp.error) {
      console.error("[org-events/setTrails] insert error", {
        code: insResp.error.code,
      });
      throw new Error("숲길 연결에 실패했어요");
    }
  }

  revalidateEvents(org.orgId, eventId);
}

/* ========================================================================== */
/* 토리FM — 1:N 관계 (tori_fm_sessions.event_id)                              */
/* ========================================================================== */

/**
 * FM 세션을 이 행사에 연결 — tori_fm_sessions.event_id = eventId.
 *
 * org_id 동시 검증으로 타 기관 세션은 건드릴 수 없음. 다른 행사에 이미 연결된
 * 세션도 덮어쓰지 않도록 event_id IS NULL 조건을 추가해도 되지만, 본 액션은
 * UI 에서 "미연결 섹션"에만 버튼을 노출하므로 해당 검증은 UI 책임.
 */
export async function linkFmSessionToEventAction(
  eventId: string,
  sessionId: string
): Promise<void> {
  const org = await requireOrg();
  if (!eventId) throw new Error("행사를 찾을 수 없어요");
  if (!sessionId) throw new Error("FM 세션을 찾을 수 없어요");

  await assertEventOwned(eventId, org.orgId);

  const supabase = await createClient();
  const resp = (await (
    supabase.from("tori_fm_sessions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .update({ event_id: eventId } satisfies Row)
    .eq("id", sessionId)
    .eq("org_id", org.orgId)) as { error: SbErr };

  if (resp.error) {
    console.error("[org-events/linkFm] error", { code: resp.error.code });
    throw new Error(`FM 세션 연결에 실패했어요: ${resp.error.message}`);
  }

  revalidateEvents(org.orgId, eventId);
}

/**
 * FM 세션 연결 해제 — event_id = NULL.
 * LIVE 중인 세션도 해제 가능하지만 UI 에서 confirm() 경고를 권장.
 */
export async function unlinkFmSessionFromEventAction(
  eventId: string,
  sessionId: string
): Promise<void> {
  const org = await requireOrg();
  if (!eventId) throw new Error("행사를 찾을 수 없어요");
  if (!sessionId) throw new Error("FM 세션을 찾을 수 없어요");

  await assertEventOwned(eventId, org.orgId);

  const supabase = await createClient();
  const resp = (await (
    supabase.from("tori_fm_sessions" as never) as unknown as {
      update: (p: Row) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .update({ event_id: null } satisfies Row)
    .eq("id", sessionId)
    .eq("org_id", org.orgId)) as { error: SbErr };

  if (resp.error) {
    console.error("[org-events/unlinkFm] error", { code: resp.error.code });
    throw new Error(`FM 세션 해제에 실패했어요: ${resp.error.message}`);
  }

  revalidateEvents(org.orgId, eventId);
}
