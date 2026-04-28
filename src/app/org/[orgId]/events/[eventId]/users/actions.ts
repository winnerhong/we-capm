"use server";

// 행사 전용 참가자 등록 — 보호자 + 자녀 upsert 후 즉시 org_event_participants 에 link.
// /org/[orgId]/users/{new,bulk-import}/actions.ts 의 redirect 패턴을 행사 페이지로 향하게 변형.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadOrgEventById } from "@/lib/org-events/queries";
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
 */
export async function createSingleEventParticipantAction(
  orgId: string,
  eventId: string,
  formData: FormData
): Promise<void> {
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
