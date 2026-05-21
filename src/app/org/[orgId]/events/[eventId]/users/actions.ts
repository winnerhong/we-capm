"use server";

// 행사 전용 참가자 등록 — 보호자 + 자녀 upsert 후 즉시 org_event_participants 에 link.
// /org/[orgId]/users/{new,bulk-import}/actions.ts 의 redirect 패턴을 행사 페이지로 향하게 변형.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadOrgEventById } from "@/lib/org-events/queries";
import { normalizeUserPhone } from "@/lib/app-user/account";
import {
  upsertParticipantWithChildren,
  linkUsersToEvent,
} from "@/lib/app-user/upsert-with-children";

async function assertEventOwned(eventId: string, orgId: string) {
  const event = await loadOrgEventById(eventId);
  if (!event) throw new Error("행사를 찾을 수 없어요");
  if (event.org_id !== orgId) throw new Error("권한이 없어요");
}

/**
 * 행사 페이지에서 한 명 추가 — 보호자+자녀 upsert + event 연결 + redirect.
 *
 * partial-applied 형태로 form action 에 전달: action.bind(null, orgId, eventId)
 *
 * 에러 처리:
 *   - Next.js production 은 server action 에서 raw error 를 클라이언트로 직접
 *     넘기지 않고 generic "An error occurred in the Server Components render"
 *     메시지로 치환할 수 있음.
 *   - 진짜 원인을 잃지 않도록 본 함수에서 catch → console.error 로 풀 스택을
 *     찍고, message 를 그대로 보존해서 다시 throw. NEXT_REDIRECT 만 통과.
 */
export async function createSingleEventParticipantAction(
  orgId: string,
  eventId: string,
  formData: FormData
): Promise<void> {
  try {
    const session = await requireOrg();
    if (!orgId || orgId !== session.orgId) {
      throw new Error("이 기관의 참가자를 등록할 권한이 없습니다");
    }
    await assertEventOwned(eventId, orgId);

    const { userId, merged } = await upsertParticipantWithChildren(
      orgId,
      formData
    );

    await linkUsersToEvent(eventId, [userId]);

    revalidatePath(`/org/${orgId}/events/${eventId}`);
    redirect(
      `/org/${orgId}/events/${eventId}?tab=participants&imported=1${
        merged ? "&merged=1" : ""
      }`
    );
  } catch (err) {
    // NEXT_REDIRECT 는 정상 흐름 — 통과시켜야 redirect 가 동작.
    if (
      err instanceof Error &&
      (err.message === "NEXT_REDIRECT" ||
        err.message.startsWith("NEXT_REDIRECT"))
    ) {
      throw err;
    }
    // production digest 로 가려지지 않도록 풀 컨텍스트 로깅.
    console.error("[events/users/createSingleEventParticipant] error", {
      orgId,
      eventId,
      err,
      stack: err instanceof Error ? err.stack : undefined,
    });
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`참가자 등록 실패: ${msg}`);
  }
}

// 일괄 등록은 기존 bulkImportAppUsersAction 이 eventId 옵션을 받도록 확장됨.
// 행사 페이지의 form 은 .bind(null, orgId, eventId) 로 partial-apply 해서 사용.

/**
 * 여러 명을 한 번에 행사에 연결 — 멱등 (이미 연결된 사용자는 skip).
 * 일괄 처리: 사용자 목록 페이지에서 체크 → 행사 선택 → 일괄 연결.
 */
export async function linkUsersToEventAction(
  orgId: string,
  eventId: string,
  userIds: string[]
): Promise<{ ok: true; linked: number } | { ok: false; message: string }> {
  const session = await requireOrg();
  if (!orgId || orgId !== session.orgId) {
    return { ok: false, message: "이 기관에 등록할 권한이 없습니다" };
  }
  if (!eventId) return { ok: false, message: "행사가 없어요" };
  const ids = Array.from(new Set(userIds.filter((s) => !!s)));
  if (ids.length === 0) {
    return { ok: false, message: "선택된 참가자가 없어요" };
  }
  await assertEventOwned(eventId, orgId);
  await linkUsersToEvent(eventId, ids);
  revalidatePath(`/org/${orgId}/events/${eventId}`);
  revalidatePath(`/org/${orgId}/users`);
  return { ok: true, linked: ids.length };
}

/* -------------------------------------------------------------------------- */
/* 연락처 중복 조회 — 빠른 원생 추가에서 이미 등록된 사람인지 사전 확인.       */
/* -------------------------------------------------------------------------- */

export type ParticipantLookupResult =
  | { found: false }
  | {
      found: true;
      userId: string;
      parentName: string;
      /** 그 사람의 홈 기관(처음 등록한 기관) id. */
      homeOrgId: string;
      /** 홈 기관명. 현재 기관과 같으면 isSameOrg=true. */
      homeOrgName: string;
      isSameOrg: boolean;
      /** 원생(is_enrolled=true) 자녀 이름들. */
      childNames: string[];
    };

/**
 * 전화번호로 기존 참가자(app_user) 조회.
 *  - 같은 기관이든 다른 기관이든 찾으면 found:true.
 *  - 빠른 원생 추가 폼이 제출 전에 호출해 "이미 등록된 분" 패널을 띄움.
 */
export async function lookupParticipantByPhoneAction(
  orgId: string,
  phoneRaw: string
): Promise<ParticipantLookupResult> {
  const session = await requireOrg();
  if (!orgId || orgId !== session.orgId) {
    return { found: false };
  }
  const phone = normalizeUserPhone(phoneRaw ?? "");
  if (phone.length < 10 || phone.length > 11) return { found: false };

  const supabase = await createClient();
  type UserRow = {
    id: string;
    parent_name: string;
    org_id: string;
  };
  const userResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: UserRow | null;
            error: unknown;
          }>;
        };
      };
    }
  )
    .select("id, parent_name, org_id")
    .eq("phone", phone)
    .maybeSingle()) as { data: UserRow | null; error: unknown };

  const user = userResp.data;
  if (!user) return { found: false };

  // 홈 기관명
  const orgResp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { org_name: string } | null;
            error: unknown;
          }>;
        };
      };
    }
  )
    .select("org_name")
    .eq("id", user.org_id)
    .maybeSingle()) as {
    data: { org_name: string } | null;
    error: unknown;
  };

  // 원생 자녀 이름
  const childResp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: boolean) => Promise<{
            data: Array<{ name: string }> | null;
            error: unknown;
          }>;
        };
      };
    }
  )
    .select("name")
    .eq("user_id", user.id)
    .eq("is_enrolled", true)) as {
    data: Array<{ name: string }> | null;
    error: unknown;
  };

  return {
    found: true,
    userId: user.id,
    parentName: user.parent_name ?? "",
    homeOrgId: user.org_id,
    homeOrgName: orgResp.data?.org_name ?? "타 기관",
    isSameOrg: user.org_id === orgId,
    childNames: (childResp.data ?? [])
      .map((c) => (c.name ?? "").trim())
      .filter((n) => n.length > 0),
  };
}

/**
 * 이미 등록된 참가자를 여러 행사에 한 번에 연결 — 멱등.
 *  - 다른 기관 소속 참가자도 이 기관 행사에 연결 가능 (cross-org 참여).
 */
export async function linkParticipantToEventsAction(
  orgId: string,
  userId: string,
  eventIds: string[]
): Promise<{ ok: true; linked: number } | { ok: false; message: string }> {
  const session = await requireOrg();
  if (!orgId || orgId !== session.orgId) {
    return { ok: false, message: "이 기관에 등록할 권한이 없습니다" };
  }
  if (!userId) return { ok: false, message: "참가자가 없어요" };
  const ids = Array.from(new Set(eventIds.filter((s) => !!s)));
  if (ids.length === 0) {
    return { ok: false, message: "연결할 행사를 선택해 주세요" };
  }
  // 모든 행사가 이 기관 소유인지 검증
  for (const eid of ids) {
    await assertEventOwned(eid, orgId);
  }
  for (const eid of ids) {
    await linkUsersToEvent(eid, [userId]);
    revalidatePath(`/org/${orgId}/events/${eid}`);
  }
  return { ok: true, linked: ids.length };
}

/**
 * 행사 참가자에서 한 명만 제거 — org_event_participants 한 줄 삭제.
 * app_user / 자녀 / 도토리 / 다른 행사 데이터는 그대로.
 */
export async function removeUserFromEventAction(
  orgId: string,
  eventId: string,
  userId: string
): Promise<void> {
  const session = await requireOrg();
  if (!orgId || orgId !== session.orgId) {
    throw new Error("이 기관의 참가자를 관리할 권한이 없습니다");
  }
  if (!eventId) throw new Error("행사가 없어요");
  if (!userId) throw new Error("참가자가 없어요");
  await assertEventOwned(eventId, orgId);

  const supabase = await createClient();

  type SbErr = { message: string; code?: string } | null;

  const del = (await (
    supabase.from("org_event_participants" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId)) as { error: SbErr };

  if (del.error) {
    console.error("[event/users/remove]", del.error);
    throw new Error(`행사제외 실패: ${del.error.message}`);
  }

  revalidatePath(`/org/${orgId}/events/${eventId}`);
}
