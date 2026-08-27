"use server";

// 행사 전용 참가자 등록 — 보호자 + 자녀 upsert 후 즉시 org_event_participants 에 link.
// /org/[orgId]/users/{new,bulk-import}/actions.ts 의 redirect 패턴을 행사 페이지로 향하게 변형.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadOrgEventById } from "@/lib/org-events/queries";
import { normalizeUserPhone } from "@/lib/app-user/account";
import { normalizePartyCounts } from "@/lib/org-events/application-core";
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

/**
 * 타 기관 계정을 **이 기관에서만** 내보낸다.
 *
 * 왜 필요한가:
 *   초대장으로 우리 행사에 온 보호자는 계정 주인이 다른 기관이다. 명단에서
 *   지우려고 영구삭제(🗑)를 누르면 "권한이 없어요" 로 막힌다 — 그 버튼은
 *   app_users 행을 지워서 그 사람의 **다른 기관 행사 기록·도토리까지** 날리기
 *   때문에 홈 기관만 쓸 수 있게 해둔 것이다. 그렇다고 행사제외(🚫)만으로는
 *   기관 명단에 계속 남는다. 그 사이를 메우는 동작이 이것이다.
 *
 * 지우는 범위 — 전부 "우리 기관" 것만:
 *   · app_user_orgs                    우리 기관 소속 한 줄
 *   · org_event_participants           우리 기관 행사 전부
 *   · org_event_participant_children   우리 기관 행사 전부
 *   · org_event_applications           우리 기관 신청서 (남으면 접수 탭에 계속 뜬다)
 *
 * 건드리지 않는 것:
 *   · app_users / app_children         계정과 자녀 (홈 기관 것이다)
 *   · 도토리 잔액·원장                  잔액을 깎으면 남의 기관 데이터를 손대는 셈
 *   · 타 기관 소속·행사 기록
 *
 * 홈 기관이 우리인 계정에는 쓰지 않는다 — 그건 영구삭제(🗑)가 정상 동작한다.
 */
export async function removeUserFromOrgAction(
  orgId: string,
  userId: string
): Promise<{ ok: true; removedEvents: number } | { ok: false; message: string }> {
  const session = await requireOrg();
  if (!orgId || orgId !== session.orgId) {
    return { ok: false, message: "이 기관의 참가자를 관리할 권한이 없습니다" };
  }
  if (!userId) return { ok: false, message: "참가자가 없어요" };

  const supabase = await createClient();
  type SbErr = { message: string; code?: string } | null;
  type SbResp<T> = { data: T[] | null; error: SbErr };

  // 홈 기관이 우리면 거부 — 소속만 지워도 app_users.org_id 가 우리를 가리켜
  // 명단에 다시 뜬다. 그 경우 필요한 건 영구삭제다.
  const userResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { id: string; org_id: string; parent_name: string } | null;
            error: SbErr;
          }>;
        };
      };
    }
  )
    .select("id, org_id, parent_name")
    .eq("id", userId)
    .maybeSingle()) as {
    data: { id: string; org_id: string; parent_name: string } | null;
    error: SbErr;
  };

  const user = userResp.data;
  if (!user) return { ok: false, message: "참가자를 찾을 수 없어요" };
  if (user.org_id === orgId) {
    return {
      ok: false,
      message:
        "우리 기관 소속 계정이에요. 명단에서 지우려면 영구 삭제를 사용해 주세요.",
    };
  }

  // 우리 기관 행사 전부
  const evResp = (await (
    supabase.from("org_events" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<SbResp<{ id: string }>>;
      };
    }
  )
    .select("id")
    .eq("org_id", orgId)) as SbResp<{ id: string }>;

  if (evResp.error) {
    console.error("[event/users/removeFromOrg] events", evResp.error);
    return { ok: false, message: "기관 행사를 불러오지 못했어요" };
  }
  const eventIds = (evResp.data ?? []).map((e) => e.id);

  if (eventIds.length > 0) {
    // 참가 아동 → 참가 → 신청서 순. 앞이 실패해도 뒤를 막지 않는다
    // (테이블이 아직 없는 배포 창이 있을 수 있다).
    const delIn = async (table: string, userKey = "user_id") => {
      const r = (await (
        supabase.from(table as never) as unknown as {
          delete: () => {
            in: (k: string, v: string[]) => {
              eq: (k: string, v: string) => Promise<{ error: SbErr }>;
            };
          };
        }
      )
        .delete()
        .in("event_id", eventIds)
        .eq(userKey, userId)) as { error: SbErr };
      if (r.error) {
        console.error(`[event/users/removeFromOrg] ${table}`, {
          code: r.error.code,
        });
      }
      return r.error;
    };

    await delIn("org_event_participant_children");
    const partErr = await delIn("org_event_participants");
    if (partErr) {
      return { ok: false, message: `행사 참가 해제 실패: ${partErr.message}` };
    }

    // 신청서는 phone 으로 걸려 있다 (계정이 없을 때도 받으므로).
    const phoneResp = (await (
      supabase.from("app_users" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { phone: string } | null;
              error: SbErr;
            }>;
          };
        };
      }
    )
      .select("phone")
      .eq("id", userId)
      .maybeSingle()) as {
      data: { phone: string } | null;
      error: SbErr;
    };
    const phone = (phoneResp.data?.phone ?? "").replace(/\D/g, "");
    if (phone) {
      const appErr = (await (
        supabase.from("org_event_applications" as never) as unknown as {
          delete: () => {
            in: (k: string, v: string[]) => {
              eq: (k: string, v: string) => Promise<{ error: SbErr }>;
            };
          };
        }
      )
        .delete()
        .in("event_id", eventIds)
        .eq("phone", phone)) as { error: SbErr };
      if (appErr.error) {
        console.error("[event/users/removeFromOrg] applications", {
          code: appErr.error.code,
        });
      }
    }
  }

  // 소속 해제 — 이게 빠져야 기관 명단에서 사라진다.
  const memErr = (await (
    supabase.from("app_user_orgs" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: SbErr }>;
        };
      };
    }
  )
    .delete()
    .eq("user_id", userId)
    .eq("org_id", orgId)) as { error: SbErr };

  if (memErr.error) {
    console.error("[event/users/removeFromOrg] membership", memErr.error);
    return { ok: false, message: `소속 해제 실패: ${memErr.error.message}` };
  }

  revalidatePath(`/org/${orgId}/users`);
  for (const eid of eventIds) {
    revalidatePath(`/org/${orgId}/events/${eid}`);
  }

  return { ok: true, removedEvents: eventIds.length };
}

/* ========================================================================== */
/* 참석 인원 직접 조정                                                         */
/* ========================================================================== */

/**
 * 참가자 탭의 [참석] 배지를 관리자가 직접 고친다.
 *
 * 왜 필요한가: 인원은 신청 이후에도 계속 바뀐다("한 명 더 가요"). 그때마다
 * 보호자에게 신청서를 다시 내게 하면 승인이 풀렸다 붙었다 하고, 기관은 그 사이
 * 간식·버스 수량을 확정하지 못한다. 전화 한 통으로 끝날 일은 기관이 바로 고칠
 * 수 있어야 한다.
 *
 * 신청서까지 함께 고치는 이유:
 *   정원 게이지(view_org_event_application_counts)는 **신청서의** party_size 합이다.
 *   참가자 행만 고치면 화면의 두 숫자가 갈라져, 관리자가 인원을 늘렸는데 정원은
 *   그대로인 상태가 된다. 접수를 거치지 않은 참가자는 신청서가 없으므로 그냥
 *   건너뛴다(그 경우 정원 집계에 애초에 안 잡힌다).
 */
export async function updateEventPartyCountsAction(
  orgId: string,
  eventId: string,
  userId: string,
  input: { childCount: number; adultCount: number; seniorCount: number }
): Promise<{ ok: true; partySize: number } | { ok: false; message: string }> {
  try {
    const session = await requireOrg();
    if (!orgId || orgId !== session.orgId) {
      return { ok: false, message: "이 기관의 참가자를 수정할 권한이 없어요" };
    }
    await assertEventOwned(eventId, orgId);
    if (!userId) return { ok: false, message: "참가자가 없어요" };

    const norm = normalizePartyCounts(input);
    if (!norm.ok) return { ok: false, message: norm.message };
    const { childCount, adultCount, seniorCount, partySize } = norm.value;

    const supabase = await createClient();
    type SbErr = { message: string; code?: string } | null;

    const partResp = (await (
      supabase.from("org_event_participants" as never) as unknown as {
        update: (p: unknown) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => Promise<{ error: SbErr }>;
          };
        };
      }
    )
      .update({
        party_size: partySize,
        child_count: childCount,
        adult_count: adultCount,
        senior_count: seniorCount,
      })
      .eq("event_id", eventId)
      .eq("user_id", userId)) as { error: SbErr };

    if (partResp.error) {
      console.error("[event/party] 참가자 갱신 실패", partResp.error);
      return {
        ok: false,
        message: `참석 인원 저장 실패: ${partResp.error.message}`,
      };
    }

    // 승인된 신청서가 있으면 같은 값으로 맞춘다 — 없으면(직접 등록분) 건너뛴다.
    const appResp = (await (
      supabase.from("org_event_applications" as never) as unknown as {
        update: (p: unknown) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => Promise<{ error: SbErr }>;
            };
          };
        };
      }
    )
      .update({
        party_size: partySize,
        child_count: childCount,
        adult_count: adultCount,
        senior_count: seniorCount,
      })
      .eq("event_id", eventId)
      .eq("approved_user_id", userId)
      .eq("status", "APPROVED")) as { error: SbErr };

    if (appResp.error) {
      // 신청서 쪽이 실패해도 참가자 값은 이미 맞다. 정원 집계만 잠시 어긋난다.
      console.error("[event/party] 신청서 동기화 실패", appResp.error);
    }

    revalidatePath(`/org/${orgId}/events/${eventId}`);
    return { ok: true, partySize };
  } catch (err) {
    console.error("[event/party] threw", err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : "저장에 실패했어요",
    };
  }
}
