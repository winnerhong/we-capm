"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyPassword } from "@/lib/password";
import { logAccess, getRequestMeta } from "@/lib/audit-log";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeamRole, TeamStatus } from "@/lib/team/types";

export type PartnerLoginResult =
  | { ok: true }
  | { ok: false; error: string };

type PartnerRow = {
  id: string;
  name: string;
  username: string;
  password: string;
  status: string;
};

type TeamMemberLoginRow = {
  id: string;
  partner_id: string;
  name: string;
  username: string;
  password_hash: string;
  role: TeamRole;
  status: TeamStatus;
};

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24,
  path: "/",
};

export async function partnerLoginAction(
  formData: FormData
): Promise<PartnerLoginResult> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!username || !password) {
    return { ok: false, error: "아이디와 비밀번호를 입력해주세요" };
  }

  const supabase = await createClient();
  const hdrs = await headers();
  const meta = getRequestMeta(hdrs);

  // 1) 기존 partners 테이블에서 조회
  const queryAny = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: PartnerRow | null;
            error: unknown;
          }>;
        };
      };
    };
  };

  const { data: partner } = await queryAny
    .from("partners")
    .select("id, name, username, password, status")
    .eq("username", username)
    .maybeSingle();

  let partnerMatched = false;

  if (partner) {
    const passwordOk = await verifyPassword(password, partner.password);
    if (passwordOk) {
      if (partner.status === "PENDING") {
        return {
          ok: false,
          error: "승인 대기 중입니다. 관리자 승인 후 로그인 가능합니다",
        };
      }
      if (partner.status === "SUSPENDED") {
        return { ok: false, error: "정지된 계정입니다" };
      }
      if (partner.status === "CLOSED") {
        return { ok: false, error: "해지된 계정입니다" };
      }

      const cookieStore = await cookies();
      cookieStore.set(
        "campnic_partner",
        JSON.stringify({
          id: partner.id,
          teamMemberId: null,
          name: partner.name,
          username: partner.username,
          role: "OWNER" as TeamRole,
          loginAt: new Date().toISOString(),
        }),
        cookieOpts
      );

      await logAccess(supabase as unknown as SupabaseClient, {
        user_type: "PARTNER",
        user_id: partner.id,
        user_identifier: username,
        action: "LOGIN",
        resource: "partners",
        status_code: 200,
        ...meta,
      });

      return { ok: true };
    }

    // 비번 틀림 로그 남기고 팀원 경로로 폴스루 (동일 username일 수 있음)
    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "PARTNER",
      user_id: partner.id,
      user_identifier: username,
      action: "LOGIN_FAIL",
      resource: "partners",
      status_code: 401,
      ...meta,
    });
    partnerMatched = true; // partners에 아이디는 존재했지만 비번 틀림
  }

  // 2) partner_team_members 에서도 조회
  const teamQuery = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: TeamMemberLoginRow | null;
            error: unknown;
          }>;
        };
      };
    };
  };

  const { data: member } = await teamQuery
    .from("partner_team_members")
    .select("id,partner_id,name,username,password_hash,role,status")
    .eq("username", username)
    .maybeSingle();

  if (member) {
    if (member.status === "DELETED") {
      return { ok: false, error: "삭제된 계정입니다" };
    }
    if (member.status === "SUSPENDED") {
      return { ok: false, error: "정지된 계정입니다" };
    }

    const ok = await verifyPassword(password, member.password_hash);
    if (!ok) {
      await logAccess(supabase as unknown as SupabaseClient, {
        user_type: "PARTNER",
        user_id: member.id,
        user_identifier: username,
        action: "LOGIN_FAIL",
        resource: "partner_team_members",
        status_code: 401,
        ...meta,
      });
      return { ok: false, error: "비밀번호가 일치하지 않습니다" };
    }

    // 소속 partner 조회
    const { data: ownerPartner } = await queryAny
      .from("partners")
      .select("id, name, username, password, status")
      .eq("id", member.partner_id)
      .maybeSingle();

    if (!ownerPartner) {
      return { ok: false, error: "소속 지사를 찾을 수 없습니다" };
    }
    if (ownerPartner.status === "CLOSED" || ownerPartner.status === "SUSPENDED") {
      return { ok: false, error: "소속 지사가 비활성화되었습니다" };
    }

    // PENDING → ACTIVE 전이
    const nowIso = new Date().toISOString();
    const updatePatch =
      member.status === "PENDING"
        ? { status: "ACTIVE", activated_at: nowIso, last_login_at: nowIso }
        : { last_login_at: nowIso };

    await (
      supabase.from("partner_team_members" as never) as unknown as {
        update: (p: unknown) => {
          eq: (k: string, v: string) => Promise<{ error: unknown }>;
        };
      }
    )
      .update(updatePatch as never)
      .eq("id", member.id);

    const cookieStore = await cookies();
    cookieStore.set(
      "campnic_partner",
      JSON.stringify({
        id: ownerPartner.id,
        teamMemberId: member.id,
        name: member.name,
        username: member.username,
        role: member.role,
        loginAt: nowIso,
      }),
      cookieOpts
    );

    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "PARTNER",
      user_id: member.id,
      user_identifier: username,
      action: "LOGIN",
      resource: "partner_team_members",
      status_code: 200,
      ...meta,
    });

    return { ok: true };
  }

  // 3) 전부 실패
  if (!partnerMatched) {
    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "PARTNER",
      user_identifier: username,
      action: "LOGIN_FAIL",
      resource: "partners",
      status_code: 404,
      ...meta,
    });
    return { ok: false, error: "존재하지 않는 계정입니다" };
  }

  return { ok: false, error: "비밀번호가 일치하지 않습니다" };
}

export async function partnerLogoutAction() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("campnic_partner")?.value;
  let partnerInfo: { id?: string; username?: string } = {};
  if (raw) {
    try {
      partnerInfo = JSON.parse(raw);
    } catch {
      // ignore
    }
  }

  cookieStore.delete("campnic_partner");

  try {
    const supabase = await createClient();
    const hdrs = await headers();
    const meta = getRequestMeta(hdrs);
    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "PARTNER",
      user_id: partnerInfo.id,
      user_identifier: partnerInfo.username,
      action: "LOGOUT",
      resource: "partners",
      status_code: 200,
      ...meta,
    });
  } catch {
    // best-effort
  }

  redirect("/partner");
}
