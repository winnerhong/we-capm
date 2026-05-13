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
import type { OrgEventStatus, ParkingItem } from "./types";
import { isOrgEventStatus, MAX_PARKING_ITEMS } from "./types";

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
  revalidatePath(`/org/${orgId}/invitations`);
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
/**
 * datetime-local 입력 또는 ISO 문자열을 KST 기준 UTC ISO 로 정규화.
 *
 * 중요: timezone 표기가 없는 datetime-local 값("2026-05-16T13:00") 은
 * 기본 Date.parse 가 "서버의 로컬 시간" 으로 해석한다. Vercel(UTC) 에서는
 * 13:00 UTC = 22:00 KST 로 저장되어 사용자가 입력한 13:00 KST 와 9시간 어긋남.
 *
 * 해결: timezone 표기가 없으면 +09:00 (KST) 으로 가정한 뒤 ISO 화.
 */
function parseIsoOrNull(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === "null") return null;

  // datetime-local 형식("YYYY-MM-DDTHH:MM" 또는 "YYYY-MM-DDTHH:MM:SS") 이고
  // timezone 마커(Z 또는 +HH:MM / -HH:MM) 가 없으면 KST 로 가정.
  const looksLocal =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(trimmed);
  const candidate = looksLocal ? `${trimmed.length === 16 ? `${trimmed}:00` : trimmed}+09:00` : trimmed;

  const t = Date.parse(candidate);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

/**
 * 주차장 JSON 문자열 파싱 — 폼에서 input name="invitation_parkings_json" 으로 들어옴.
 *  - 이름·주소가 모두 비어 있는 행은 제거
 *  - 이름·주소 각 100자 클램프
 *  - MAX_PARKING_ITEMS 까지만 잘라서 저장
 */
function parseParkingsJson(raw: unknown): ParkingItem[] {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row): ParkingItem | null => {
        if (!row || typeof row !== "object") return null;
        const o = row as Record<string, unknown>;
        const name = clampString(String(o.name ?? ""), 100);
        const address = clampString(String(o.address ?? ""), 200);
        const imageRaw = clampString(String(o.image_url ?? ""), 500);
        if (!name && !address) return null;
        const item: ParkingItem = { name: name ?? "", address: address ?? "" };
        if (imageRaw) item.image_url = imageRaw;
        return item;
      })
      .filter((v): v is ParkingItem => v !== null)
      .slice(0, MAX_PARKING_ITEMS);
  } catch {
    return [];
  }
}

/**
 * formData 에서 행사 필드 뽑기 — 공통 파서.
 *
 * allow_self_register:
 *  - 체크박스 value = "on" / "true" / "1" 모두 true 로 해석.
 *  - key 자체가 없으면 null (update payload 에서 제외 — 기존 값 보존).
 *
 * invitation_parkings:
 *  - input name="invitation_parkings_json" 에 JSON 문자열로 들어옴.
 *  - 동적 추가/제거 UI 가 클라이언트에서 직렬화해서 보냄.
 */
function extractEventFields(formData: FormData): {
  name: string | null;
  description: string | null;
  // undefined = form 에서 키 자체를 안 보냄 → "변경 의도 없음, 기존 값 보존"
  // null     = 명시적으로 비움
  // string   = 새 값
  starts_at: string | null | undefined;
  ends_at: string | null | undefined;
  cover_image_url: string | null;
  status: OrgEventStatus | null;
  allow_self_register: boolean | null;
  invitation_message: string | null;
  invitation_body: string | null;
  invitation_location: string | null;
  invitation_address: string | null;
  invitation_location_image_url: string | null;
  invitation_dress_code: string | null;
  invitation_parkings: ParkingItem[];
  invitation_host: string | null;
  invitation_organizer: string | null;
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
    // form 에 키 자체가 없으면 undefined (변경 안 함). 키가 있으면 parse.
    starts_at:
      formData.get("starts_at") === null
        ? undefined
        : parseIsoOrNull(String(formData.get("starts_at"))),
    ends_at:
      formData.get("ends_at") === null
        ? undefined
        : parseIsoOrNull(String(formData.get("ends_at"))),
    cover_image_url: clampString(
      String(formData.get("cover_image_url") ?? ""),
      500
    ),
    status: isOrgEventStatus(rawStatus) ? rawStatus : null,
    allow_self_register: allowSelfRegister,
    invitation_message: clampString(
      String(formData.get("invitation_message") ?? ""),
      500
    ),
    invitation_body: clampString(
      String(formData.get("invitation_body") ?? ""),
      3000
    ),
    invitation_location: clampString(
      String(formData.get("invitation_location") ?? ""),
      200
    ),
    invitation_address: clampString(
      String(formData.get("invitation_address") ?? ""),
      300
    ),
    invitation_location_image_url: clampString(
      String(formData.get("invitation_location_image_url") ?? ""),
      500
    ),
    invitation_dress_code: clampString(
      String(formData.get("invitation_dress_code") ?? ""),
      500
    ),
    invitation_parkings: parseParkingsJson(formData.get("invitation_parkings_json")),
    invitation_host: clampString(
      String(formData.get("invitation_host") ?? ""),
      100
    ),
    invitation_organizer: clampString(
      String(formData.get("invitation_organizer") ?? ""),
      200
    ),
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
      // 신규 생성은 폼이 항상 starts_at 을 보내므로 undefined → null fallback.
      starts_at: fields.starts_at ?? null,
      ends_at: fields.ends_at ?? null,
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

  // 🕒 진단 로그 — 시각 필드가 update 되는 모든 호출을 추적.
  // 누가 어떤 값으로 starts_at 을 갱신하는지 Vercel 로그에서 확인.
  if (fields.starts_at !== undefined || fields.ends_at !== undefined) {
    const before = await loadOrgEventById(eventId);
    console.log("[org-events/update] time fields touched", {
      eventId,
      from: { starts: before?.starts_at, ends: before?.ends_at },
      to: { starts: fields.starts_at, ends: fields.ends_at },
      stack: new Error().stack?.split("\n").slice(2, 6).join(" | "),
    });
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
      // undefined = form 에서 안 보냄 → spread 에서 제외 → DB 값 보존.
      ...(fields.starts_at !== undefined ? { starts_at: fields.starts_at } : {}),
      ...(fields.ends_at !== undefined ? { ends_at: fields.ends_at } : {}),
      cover_image_url: fields.cover_image_url,
      ...(fields.status ? { status: fields.status } : {}),
      ...(fields.allow_self_register !== null
        ? { allow_self_register: fields.allow_self_register }
        : {}),
      invitation_message: fields.invitation_message,
      invitation_body: fields.invitation_body,
      invitation_location: fields.invitation_location,
      invitation_address: fields.invitation_address,
      invitation_location_image_url: fields.invitation_location_image_url,
      invitation_dress_code: fields.invitation_dress_code,
      invitation_parkings:
        fields.invitation_parkings.length > 0
          ? fields.invitation_parkings
          : null,
      invitation_host: fields.invitation_host,
      invitation_organizer: fields.invitation_organizer,
    } satisfies Row)
    .eq("id", eventId)) as { error: SbErr };

  if (resp.error) {
    console.error("[org-events/update] error", { code: resp.error.code });
    throw new Error("행사 수정에 실패했어요");
  }

  revalidateEvents(org.orgId, eventId);
}

/**
 * 초대장 발행 / 발행취소 — invitation_published_at 토글.
 * publish=true 면 현재 시각 기록, false 면 NULL.
 */
export async function setInvitationPublishedAction(
  eventId: string,
  publish: boolean
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
    .update({
      invitation_published_at: publish ? new Date().toISOString() : null,
    } satisfies Row)
    .eq("id", eventId)) as { error: SbErr };

  if (resp.error) {
    console.error("[org-events/setInvitationPublished] error", {
      code: resp.error.code,
    });
    throw new Error("초대장 발행 상태 변경 실패");
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

/**
 * 행사에서 스탬프북 한 개만 제거 — junction 한 줄만 삭제.
 * 스탬프북 자체는 보존(보존된 채로 다른 행사에 다시 연결 가능).
 */
export async function removeQuestPackFromEventAction(
  eventId: string,
  questPackId: string
): Promise<void> {
  const org = await requireOrg();
  if (!eventId) throw new Error("행사가 없어요");
  if (!questPackId) throw new Error("스탬프북이 없어요");
  await assertEventOwned(eventId, org.orgId);

  const supabase = await createClient();
  const del = (await (
    supabase.from("org_event_quest_packs" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .delete()
    .eq("event_id", eventId)
    .eq("quest_pack_id", questPackId)) as { error: SbErr };
  if (del.error) {
    console.error("[org-events/removeQuestPack]", del.error);
    throw new Error(`행사제외 실패: ${del.error.message}`);
  }
  revalidateEvents(org.orgId, eventId);
}

/**
 * 행사에서 프로그램 한 개만 제거.
 */
export async function removeProgramFromEventAction(
  eventId: string,
  programId: string
): Promise<void> {
  const org = await requireOrg();
  if (!eventId) throw new Error("행사가 없어요");
  if (!programId) throw new Error("프로그램이 없어요");
  await assertEventOwned(eventId, org.orgId);

  const supabase = await createClient();
  const del = (await (
    supabase.from("org_event_programs" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .delete()
    .eq("event_id", eventId)
    .eq("org_program_id", programId)) as { error: SbErr };
  if (del.error) {
    console.error("[org-events/removeProgram]", del.error);
    throw new Error(`행사제외 실패: ${del.error.message}`);
  }
  revalidateEvents(org.orgId, eventId);
}

/**
 * 행사에서 숲길 한 개만 제거.
 */
export async function removeTrailFromEventAction(
  eventId: string,
  trailId: string
): Promise<void> {
  const org = await requireOrg();
  if (!eventId) throw new Error("행사가 없어요");
  if (!trailId) throw new Error("숲길이 없어요");
  await assertEventOwned(eventId, org.orgId);

  const supabase = await createClient();
  const del = (await (
    supabase.from("org_event_trails" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .delete()
    .eq("event_id", eventId)
    .eq("trail_id", trailId)) as { error: SbErr };
  if (del.error) {
    console.error("[org-events/removeTrail]", del.error);
    throw new Error(`행사제외 실패: ${del.error.message}`);
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
