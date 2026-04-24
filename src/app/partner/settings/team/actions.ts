"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { hashPassword } from "@/lib/password";
import type { TeamRole, TeamStatus } from "@/lib/team/types";

// ============================================================
// 아이디 = 핸드폰번호(숫자만) / 비밀번호 = 뒷 4자리 (초기 임시)
// ============================================================
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function validateKoreanMobile(phoneDigits: string): boolean {
  // 010으로 시작하는 11자리 허용 (일반 모바일) — 필요 시 11 자리 모두 허용으로 완화
  return phoneDigits.length === 11 && phoneDigits.startsWith("01");
}

function lastFourDigits(phoneDigits: string): string {
  if (phoneDigits.length >= 4) return phoneDigits.slice(-4);
  return Math.floor(1000 + Math.random() * 9000).toString();
}

const INVITABLE_ROLES: TeamRole[] = ["MANAGER", "STAFF", "FINANCE", "VIEWER"];

type TeamMemberCore = {
  id: string;
  partner_id: string;
  role: TeamRole;
  status: TeamStatus;
  username: string;
};


async function fetchMemberCore(
  id: string,
  partnerId: string
): Promise<TeamMemberCore | null> {
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partner_team_members" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: TeamMemberCore | null }>;
          };
        };
      };
    }
  )
    .select("id,partner_id,role,status,username")
    .eq("id", id)
    .eq("partner_id", partnerId)
    .maybeSingle();
  return data;
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

// ============================================================
// 초대
// ============================================================
export async function inviteTeamMemberAction(formData: FormData) {
  const session = await requirePartnerWithRole(["OWNER"]);

  const name = String(formData.get("name") ?? "").trim();
  const email = strOrNull(formData.get("email"));
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "").trim() as TeamRole;
  const memo = strOrNull(formData.get("memo"));

  if (!name) throw new Error("이름을 입력해 주세요");
  if (!phoneRaw) throw new Error("핸드폰번호를 입력해 주세요 (로그인 아이디로 사용)");
  const phone = normalizePhone(phoneRaw);
  if (!validateKoreanMobile(phone)) {
    throw new Error("핸드폰번호 11자리를 정확히 입력해 주세요 (예: 01012345678)");
  }
  if (!INVITABLE_ROLES.includes(roleRaw)) {
    throw new Error("초대 가능한 역할이 아닙니다 (OWNER는 초대할 수 없습니다)");
  }

  // 로그인 계정 커스텀 값 (선택)
  const usernameOverride = String(formData.get("username") ?? "").trim();
  const passwordOverride = String(formData.get("initial_password") ?? "").trim();

  // 아이디 결정: 입력값 > 핸드폰번호
  let username: string;
  if (usernameOverride) {
    if (usernameOverride.length < 4) throw new Error("아이디는 4자 이상이어야 합니다");
    if (usernameOverride.length > 30) throw new Error("아이디가 너무 깁니다 (30자 이내)");
    username = usernameOverride;
  } else {
    username = phone;
  }

  // 비번 결정: 입력값 > 뒷 4자리
  let plaintext: string;
  if (passwordOverride) {
    if (passwordOverride.length < 4) throw new Error("비밀번호는 4자 이상이어야 합니다");
    if (passwordOverride.length > 40) throw new Error("비밀번호가 너무 깁니다 (40자 이내)");
    plaintext = passwordOverride;
  } else {
    plaintext = lastFourDigits(phone);
  }

  // 중복 체크: 같은 파트너 내 아이디 중복
  const dupCheck = await (
    (await createClient()).from("partner_team_members" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: { id: string } | null }>;
          };
        };
      };
    }
  )
    .select("id")
    .eq("partner_id", session.id)
    .eq("username", username)
    .maybeSingle();
  if (dupCheck.data) {
    throw new Error(
      usernameOverride
        ? "이미 사용 중인 아이디입니다. 다른 값을 사용해 주세요."
        : "이미 등록된 핸드폰번호입니다. 기존 팀원을 확인해 주세요."
    );
  }

  const password_hash = await hashPassword(plaintext);

  const supabase = await createClient();
  const { data, error } = await (
    supabase.from("partner_team_members" as never) as unknown as {
      insert: (p: unknown) => {
        select: (c: string) => {
          maybeSingle: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .insert({
      partner_id: session.id,
      name,
      email,
      phone,  // 저장된 핸드폰번호 (숫자만)
      username,
      password_hash,
      role: roleRaw,
      status: "PENDING" as TeamStatus,
      invited_by: session.teamMemberId ?? session.id,
      memo,
    } as never)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`팀원 초대 실패: ${error.message}`);
  if (!data) throw new Error("팀원 생성 결과를 읽지 못했습니다");

  revalidatePath("/partner/settings/team");

  try {
    redirect(
      `/partner/settings/team?invited=${data.id}&user=${encodeURIComponent(username)}&pw=${encodeURIComponent(plaintext)}&name=${encodeURIComponent(name)}`
    );
  } catch (e) {
    throw e; // NEXT_REDIRECT 통과
  }
}

// ============================================================
// 수정
// ============================================================
export async function updateTeamMemberAction(id: string, formData: FormData) {
  const session = await requirePartnerWithRole(["OWNER"]);
  const target = await fetchMemberCore(id, session.id);
  if (!target) throw new Error("대상 팀원을 찾을 수 없습니다");
  if (target.role === "OWNER") {
    throw new Error("OWNER 팀원은 이 화면에서 수정할 수 없습니다");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("이름을 입력해 주세요");

  const email = strOrNull(formData.get("email"));
  const phone = strOrNull(formData.get("phone"));
  const roleRaw = String(formData.get("role") ?? target.role).trim() as TeamRole;
  const memo = strOrNull(formData.get("memo"));

  // 아이디(username) — 빈 값이면 기존 유지
  const usernameRaw = String(formData.get("username") ?? "").trim();
  let nextUsername: string | null = null;
  if (usernameRaw && usernameRaw !== target.username) {
    const digits = normalizePhone(usernameRaw) || usernameRaw;
    if (digits.length < 4) throw new Error("아이디는 4자 이상이어야 합니다");
    if (digits.length > 30) throw new Error("아이디가 너무 깁니다 (30자 이내)");

    // 같은 파트너 내 중복 체크 (자기 자신 제외)
    const supabaseDup = await createClient();
    const { data: dup } = await (
      supabaseDup.from("partner_team_members" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              neq: (k: string, v: string) => {
                maybeSingle: () => Promise<{ data: { id: string } | null }>;
              };
            };
          };
        };
      }
    )
      .select("id")
      .eq("partner_id", session.id)
      .eq("username", digits)
      .neq("id", id)
      .maybeSingle();
    if (dup) throw new Error("이미 사용 중인 아이디입니다");
    nextUsername = digits;
  }

  // 비밀번호 — 빈 값이면 미변경
  const newPassword = String(formData.get("new_password") ?? "").trim();
  let passwordHashPatch: string | null = null;
  if (newPassword) {
    if (newPassword.length < 4) throw new Error("비밀번호는 4자 이상이어야 합니다");
    if (newPassword.length > 40) throw new Error("비밀번호가 너무 깁니다 (40자 이내)");
    passwordHashPatch = await hashPassword(newPassword);
  }

  if (!INVITABLE_ROLES.includes(roleRaw)) {
    throw new Error("OWNER로 역할을 변경할 수 없습니다");
  }

  const patch: Record<string, unknown> = {
    name,
    email,
    phone,
    role: roleRaw,
    memo,
    updated_at: new Date().toISOString(),
  };
  if (nextUsername) patch.username = nextUsername;
  if (passwordHashPatch) patch.password_hash = passwordHashPatch;

  const supabase = await createClient();
  const { error } = await (
    supabase.from("partner_team_members" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .update(patch as never)
    .eq("id", id)
    .eq("partner_id", session.id);

  if (error) throw new Error(`팀원 수정 실패: ${error.message}`);

  revalidatePath("/partner/settings/team");
  revalidatePath(`/partner/settings/team/${id}/edit`);
  try {
    redirect(`/partner/settings/team?updated=${id}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("NEXT_REDIRECT")) throw e;
  }
}

// ============================================================
// 정지
// ============================================================
export async function suspendTeamMemberAction(id: string) {
  const session = await requirePartnerWithRole(["OWNER"]);
  const target = await fetchMemberCore(id, session.id);
  if (!target) throw new Error("대상 팀원을 찾을 수 없습니다");
  if (target.role === "OWNER") {
    throw new Error("OWNER 팀원은 정지할 수 없습니다");
  }

  const supabase = await createClient();
  const { error } = await (
    supabase.from("partner_team_members" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .update({
      status: "SUSPENDED" as TeamStatus,
      suspended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .eq("partner_id", session.id);

  if (error) throw new Error(`정지 실패: ${error.message}`);

  revalidatePath("/partner/settings/team");
  redirect(`/partner/settings/team?suspended=${id}`);
}

// ============================================================
// 재활성
// ============================================================
export async function reactivateTeamMemberAction(id: string) {
  const session = await requirePartnerWithRole(["OWNER"]);
  const target = await fetchMemberCore(id, session.id);
  if (!target) throw new Error("대상 팀원을 찾을 수 없습니다");

  const supabase = await createClient();
  const { error } = await (
    supabase.from("partner_team_members" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .update({
      status: "ACTIVE" as TeamStatus,
      suspended_at: null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .eq("partner_id", session.id);

  if (error) throw new Error(`재활성 실패: ${error.message}`);

  revalidatePath("/partner/settings/team");
  redirect(`/partner/settings/team?reactivated=${id}`);
}

// ============================================================
// 삭제 (soft)
// ============================================================
export async function deleteTeamMemberAction(id: string) {
  const session = await requirePartnerWithRole(["OWNER"]);
  const target = await fetchMemberCore(id, session.id);
  if (!target) throw new Error("대상 팀원을 찾을 수 없습니다");
  if (target.role === "OWNER") {
    throw new Error("OWNER 팀원은 삭제할 수 없습니다");
  }

  const supabase = await createClient();
  const { error } = await (
    supabase.from("partner_team_members" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .update({
      status: "DELETED" as TeamStatus,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .eq("partner_id", session.id);

  if (error) throw new Error(`삭제 실패: ${error.message}`);

  revalidatePath("/partner/settings/team");
  redirect(`/partner/settings/team?deleted=${id}`);
}

// ============================================================
// 비밀번호 재발급
// ============================================================
export async function regenerateTeamMemberPasswordAction(id: string) {
  const session = await requirePartnerWithRole(["OWNER"]);
  const target = await fetchMemberCore(id, session.id);
  if (!target) throw new Error("대상 팀원을 찾을 수 없습니다");

  // 핸드폰 번호를 조회해서 뒷 4자리로 재설정
  const supabaseForLookup = await createClient();
  const { data: phoneRow } = await (
    supabaseForLookup.from("partner_team_members" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: { phone: string | null } | null }>;
        };
      };
    }
  )
    .select("phone")
    .eq("id", id)
    .maybeSingle();
  const phoneDigits = normalizePhone(phoneRow?.phone ?? "");
  const plaintext = lastFourDigits(phoneDigits);
  const password_hash = await hashPassword(plaintext);

  const supabase = await createClient();
  const { error } = await (
    supabase.from("partner_team_members" as never) as unknown as {
      update: (p: unknown) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .update({
      password_hash,
      status: "PENDING" as TeamStatus,
      activated_at: null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .eq("partner_id", session.id);

  if (error) throw new Error(`비밀번호 재발급 실패: ${error.message}`);

  revalidatePath("/partner/settings/team");

  try {
    redirect(
      `/partner/settings/team?reset=${id}&pw=${encodeURIComponent(plaintext)}`
    );
  } catch (e) {
    throw e; // NEXT_REDIRECT 통과
  }
}
