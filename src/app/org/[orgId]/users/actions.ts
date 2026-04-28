"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-auth-guard";

export type UserStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";
export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT";

const ATTENDANCE_SET = new Set<AttendanceStatus>([
  "PRESENT",
  "LATE",
  "ABSENT",
]);

type SbErr = { message: string } | null;
type SbOne<T> = { data: T | null; error: SbErr };

const STATUS_SET = new Set<UserStatus>(["ACTIVE", "SUSPENDED", "CLOSED"]);

async function getOwnedUser(userId: string): Promise<{
  id: string;
  org_id: string;
  parent_name: string;
}> {
  const session = await requireOrg();
  if (!userId) throw new Error("참가자 ID가 없어요");

  const supabase = await createClient();

  const resp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbOne<{ id: string; org_id: string; parent_name: string }>
          >;
        };
      };
    }
  )
    .select("id, org_id, parent_name")
    .eq("id", userId)
    .maybeSingle()) as SbOne<{
    id: string;
    org_id: string;
    parent_name: string;
  }>;

  const user = resp.data;
  if (!user) throw new Error("참가자를 찾을 수 없어요");
  if (user.org_id !== session.orgId) {
    throw new Error("이 참가자를 관리할 권한이 없어요");
  }
  return user;
}

/** 참가자 상태 변경 (ACTIVE/SUSPENDED/CLOSED) — 소유권 검증 필수 */
export async function updateAppUserStatusAction(
  userId: string,
  next: UserStatus
): Promise<void> {
  if (!STATUS_SET.has(next)) {
    throw new Error("올바르지 않은 상태값이에요");
  }

  const user = await getOwnedUser(userId);
  const supabase = await createClient();

  const upd = (await (
    supabase.from("app_users" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ status: next })
    .eq("id", userId)) as { error: SbErr };

  if (upd.error) {
    throw new Error(`상태 변경 실패: ${upd.error.message}`);
  }

  revalidatePath(`/org/${user.org_id}/users`);
  revalidatePath(`/org/${user.org_id}/users/${userId}`);
  revalidatePath(`/org/${user.org_id}/users/${userId}/edit`);
}

/**
 * 참가자 **완전 삭제** — app_users 행을 실제로 DELETE.
 * FK CASCADE 로 app_children, mission_submissions, fm 채팅/리액션 등
 * 연결된 데이터도 함께 정리됨.
 */
export async function deleteAppUserAction(userId: string): Promise<void> {
  const user = await getOwnedUser(userId);
  const supabase = await createClient();

  const del = (await (
    supabase.from("app_users" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .delete()
    .eq("id", userId)) as { error: SbErr };

  if (del.error) {
    throw new Error(`참가자 삭제 실패: ${del.error.message}`);
  }

  revalidatePath(`/org/${user.org_id}/users`);
}

/** 참가자 기본 정보 업데이트 (parent_name, status) */
export async function updateAppUserAction(
  userId: string,
  formData: FormData
): Promise<void> {
  const user = await getOwnedUser(userId);

  const parentName = String(formData.get("parent_name") ?? "").trim();
  if (!parentName) throw new Error("보호자 이름을 입력해 주세요");

  const statusRaw = String(formData.get("status") ?? "").trim();
  if (!STATUS_SET.has(statusRaw as UserStatus)) {
    throw new Error("올바르지 않은 상태값이에요");
  }
  const status = statusRaw as UserStatus;

  const supabase = await createClient();

  const upd = (await (
    supabase.from("app_users" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ parent_name: parentName, status })
    .eq("id", userId)) as { error: SbErr };

  if (upd.error) {
    throw new Error(`참가자 수정 실패: ${upd.error.message}`);
  }

  revalidatePath(`/org/${user.org_id}/users`);
  revalidatePath(`/org/${user.org_id}/users/${userId}`);
  revalidatePath(`/org/${user.org_id}/users/${userId}/edit`);
  redirect(`/org/${user.org_id}/users/${userId}?saved=1`);
}

/** 자녀 추가 */
export async function addChildAction(
  userId: string,
  formData: FormData
): Promise<void> {
  const user = await getOwnedUser(userId);

  const name = String(formData.get("child_name") ?? "").trim();
  if (!name) throw new Error("자녀 이름을 입력해 주세요");

  const birthRaw = String(formData.get("child_birth") ?? "").trim();
  const birth = /^\d{4}-\d{2}-\d{2}$/.test(birthRaw) ? birthRaw : null;

  const supabase = await createClient();

  // 중복 이름 체크
  const dup = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<SbOne<{ id: string }>>;
          };
        };
      };
    }
  )
    .select("id")
    .eq("user_id", userId)
    .eq("name", name)
    .maybeSingle()) as SbOne<{ id: string }>;

  if (dup.data) {
    throw new Error("이미 같은 이름의 자녀가 있어요");
  }

  const ins = (await (
    supabase.from("app_children" as never) as unknown as {
      insert: (p: unknown) => Promise<{ error: SbErr }>;
    }
  ).insert({
    user_id: userId,
    name,
    birth_date: birth,
  })) as { error: SbErr };

  if (ins.error) {
    throw new Error(`자녀 추가 실패: ${ins.error.message}`);
  }

  revalidatePath(`/org/${user.org_id}/users/${userId}`);
  revalidatePath(`/org/${user.org_id}/users/${userId}/edit`);
}

/** 자녀 삭제 */
export async function deleteChildAction(childId: string): Promise<void> {
  const session = await requireOrg();
  if (!childId) throw new Error("자녀 ID가 없어요");

  const supabase = await createClient();

  // 자녀 → 보호자 → 기관 검증
  const childResp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<
            SbOne<{ id: string; user_id: string }>
          >;
        };
      };
    }
  )
    .select("id, user_id")
    .eq("id", childId)
    .maybeSingle()) as SbOne<{ id: string; user_id: string }>;

  const child = childResp.data;
  if (!child) throw new Error("자녀를 찾을 수 없어요");

  const userResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbOne<{ id: string; org_id: string }>>;
        };
      };
    }
  )
    .select("id, org_id")
    .eq("id", child.user_id)
    .maybeSingle()) as SbOne<{ id: string; org_id: string }>;

  const user = userResp.data;
  if (!user) throw new Error("해당 참가자를 찾을 수 없어요");
  if (user.org_id !== session.orgId) {
    throw new Error("이 자녀를 삭제할 권한이 없어요");
  }

  const del = (await (
    supabase.from("app_children" as never) as unknown as {
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .delete()
    .eq("id", childId)) as { error: SbErr };

  if (del.error) {
    throw new Error(`자녀 삭제 실패: ${del.error.message}`);
  }

  revalidatePath(`/org/${session.orgId}/users/${child.user_id}`);
  revalidatePath(`/org/${session.orgId}/users/${child.user_id}/edit`);
}

/**
 * 자녀 생년월일 수정. 빈 문자열이면 null 로 저장 (생년월일 미입력).
 * YYYY-MM-DD 형식만 허용.
 */
export async function updateChildBirthDateAction(
  childId: string,
  birthDate: string | null
): Promise<void> {
  const session = await requireOrg();
  if (!childId) throw new Error("자녀 ID가 없어요");

  const supabase = await createClient();

  // 자녀 → 보호자 → 기관 소유 검증
  const childResp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbOne<{ id: string; user_id: string }>>;
        };
      };
    }
  )
    .select("id, user_id")
    .eq("id", childId)
    .maybeSingle()) as SbOne<{ id: string; user_id: string }>;

  const child = childResp.data;
  if (!child) throw new Error("자녀를 찾을 수 없어요");

  const userResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbOne<{ id: string; org_id: string }>>;
        };
      };
    }
  )
    .select("id, org_id")
    .eq("id", child.user_id)
    .maybeSingle()) as SbOne<{ id: string; org_id: string }>;

  const user = userResp.data;
  if (!user || user.org_id !== session.orgId) {
    throw new Error("이 자녀를 수정할 권한이 없어요");
  }

  // 정규화: 빈 문자열/공백은 null. YYYY-MM-DD 만 허용.
  let normalized: string | null = null;
  if (birthDate && birthDate.trim().length > 0) {
    const trimmed = birthDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new Error("생년월일은 YYYY-MM-DD 형식이어야 해요");
    }
    normalized = trimmed;
  }

  const upd = (await (
    supabase.from("app_children" as never) as unknown as {
      update: (p: { birth_date: string | null }) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ birth_date: normalized })
    .eq("id", childId)) as { error: SbErr };

  if (upd.error) {
    throw new Error(`생년월일 수정 실패: ${upd.error.message}`);
  }

  revalidatePath(`/org/${session.orgId}/users/${child.user_id}`);
  revalidatePath(`/org/${session.orgId}/users/${child.user_id}/edit`);
}

/**
 * 자녀의 원생/형제자매 여부 토글. 해당 기관 소속 자녀에 대해서만 가능.
 */
export async function toggleChildEnrolledAction(
  childId: string,
  nextEnrolled: boolean
): Promise<void> {
  const session = await requireOrg();
  if (!childId) throw new Error("자녀 ID가 없어요");

  const supabase = await createClient();

  // 자녀 → 보호자 → 기관 검증
  const childResp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbOne<{ id: string; user_id: string }>>;
        };
      };
    }
  )
    .select("id, user_id")
    .eq("id", childId)
    .maybeSingle()) as SbOne<{ id: string; user_id: string }>;

  const child = childResp.data;
  if (!child) throw new Error("자녀를 찾을 수 없어요");

  const userResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbOne<{ id: string; org_id: string }>>;
        };
      };
    }
  )
    .select("id, org_id")
    .eq("id", child.user_id)
    .maybeSingle()) as SbOne<{ id: string; org_id: string }>;

  const user = userResp.data;
  if (!user || user.org_id !== session.orgId) {
    throw new Error("이 자녀를 수정할 권한이 없어요");
  }

  const upd = (await (
    supabase.from("app_children" as never) as unknown as {
      update: (p: { is_enrolled: boolean }) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ is_enrolled: nextEnrolled })
    .eq("id", childId)) as { error: SbErr };

  if (upd.error) {
    throw new Error(`원생 여부 변경 실패: ${upd.error.message}`);
  }

  revalidatePath(`/org/${session.orgId}/users/${child.user_id}`);
  revalidatePath(`/org/${session.orgId}/users/${child.user_id}/edit`);
}

/**
 * 참가자 도토리 잔액 조정 (+1 / -1 등). 음수 방지 — 최소 0.
 */
export async function adjustAcornBalanceAction(
  userId: string,
  delta: number
): Promise<void> {
  const owner = await getOwnedUser(userId);
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("변경 수량이 올바르지 않아요");
  }

  const supabase = await createClient();

  // 현재 잔액 조회
  const curResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbOne<{ acorn_balance: number }>>;
        };
      };
    }
  )
    .select("acorn_balance")
    .eq("id", owner.id)
    .maybeSingle()) as SbOne<{ acorn_balance: number }>;

  const current = curResp.data?.acorn_balance ?? 0;
  const next = Math.max(0, current + delta);

  const upd = (await (
    supabase.from("app_users" as never) as unknown as {
      update: (p: { acorn_balance: number }) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({ acorn_balance: next })
    .eq("id", owner.id)) as { error: SbErr };

  if (upd.error) {
    throw new Error(`도토리 조정 실패: ${upd.error.message}`);
  }

  revalidatePath(`/org/${owner.org_id}/users`);
  revalidatePath(`/org/${owner.org_id}/users/${owner.id}`);
}

/**
 * 참가자 당일 출석 상태 토글.
 * - 같은 상태 다시 누르면 취소(null)
 * - 다른 상태면 교체
 * - 날짜는 항상 오늘 기준
 */
export async function setAttendanceStatusAction(
  userId: string,
  nextStatus: AttendanceStatus | null
): Promise<void> {
  const owner = await getOwnedUser(userId);
  if (nextStatus !== null && !ATTENDANCE_SET.has(nextStatus)) {
    throw new Error("올바르지 않은 출석 상태");
  }

  const supabase = await createClient();
  const todayIso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const upd = (await (
    supabase.from("app_users" as never) as unknown as {
      update: (p: {
        attendance_status: AttendanceStatus | null;
        attendance_date: string | null;
      }) => {
        eq: (k: string, v: string) => Promise<{ error: SbErr }>;
      };
    }
  )
    .update({
      attendance_status: nextStatus,
      attendance_date: nextStatus ? todayIso : null,
    })
    .eq("id", owner.id)) as { error: SbErr };

  if (upd.error) {
    throw new Error(`출석 상태 변경 실패: ${upd.error.message}`);
  }

  revalidatePath(`/org/${owner.org_id}/users`);
}
