"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { findSchoolByUsername } from "@/lib/school-db";
import { logAccess, getRequestMeta } from "@/lib/audit-log";
import { verifyPassword } from "@/lib/password";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function managerLoginAction(managerId: string, password: string) {
  const supabase = await createClient();
  const hdrs = await headers();
  const meta = getRequestMeta(hdrs);

  // 1. campnic events에서 manager_id로 찾기
  const { data: events } = await supabase
    .from("events")
    .select("id, name, manager_id, manager_password")
    .eq("manager_id", managerId);

  const event = events?.find((e) => e.manager_password === password);

  if (event) {
    await setManagerCookie(event.id, event.name, event.manager_id ?? managerId);
    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "MANAGER",
      user_id: event.id,
      user_identifier: managerId,
      action: "LOGIN",
      resource: `event:${event.id}`,
      status_code: 200,
      ...meta,
    });
    return { ok: true, eventId: event.id, eventName: event.name };
  }

  // 2. schools DB에서 username으로 찾기
  const school = await findSchoolByUsername(managerId);
  if (school && school.password === password) {
    const { data: schoolEvents } = await supabase
      .from("events")
      .select("id, name")
      .eq("manager_id", school.username);

    if (schoolEvents && schoolEvents.length > 0) {
      const ev = schoolEvents[0];
      await setManagerCookie(ev.id, ev.name, school.username);
      await logAccess(supabase as unknown as SupabaseClient, {
        user_type: "MANAGER",
        user_id: ev.id,
        user_identifier: school.username,
        action: "LOGIN",
        resource: `event:${ev.id}`,
        status_code: 200,
        ...meta,
      });
      return { ok: true, eventId: ev.id, eventName: ev.name };
    }
    return { ok: false, message: "배정된 행사가 없습니다. 관리자에게 문의하세요." };
  }

  // 3. 지사 CRM 발급 기관 계정 (partner_orgs.auto_username)
  const { data: orgRow } = await (supabase.from("partner_orgs" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: {
          id: string;
          org_name: string;
          auto_password_hash: string | null;
          status: string;
        } | null }>;
      };
    };
  })
    .select("id, org_name, auto_password_hash, status")
    .eq("auto_username", managerId)
    .maybeSingle();

  if (orgRow && orgRow.auto_password_hash) {
    const ok = await verifyPassword(password, orgRow.auto_password_hash);
    if (ok) {
      if (orgRow.status !== "ACTIVE") {
        return { ok: false, message: "이 계정은 현재 사용할 수 없습니다. 지사에 문의하세요." };
      }

      // 해당 기관에 배정된 행사 검색 (events.manager_id = auto_username)
      const { data: orgEvents } = await supabase
        .from("events")
        .select("id, name")
        .eq("manager_id", managerId)
        .order("start_at", { ascending: false })
        .limit(1);

      await (supabase.from("partner_orgs" as never) as unknown as {
        update: (p: unknown) => { eq: (k: string, v: string) => Promise<{ error: unknown }> };
      })
        .update({ first_login_at: new Date().toISOString() })
        .eq("id", orgRow.id);

      // org 쿠키는 이벤트 유무와 무관하게 항상 세팅 (기관 세션)
      await setOrgCookie(orgRow.id, orgRow.org_name, managerId);

      if (orgEvents && orgEvents.length > 0) {
        const ev = orgEvents[0];
        await setManagerCookie(ev.id, ev.name, managerId);
        await logAccess(supabase as unknown as SupabaseClient, {
          user_type: "MANAGER",
          user_id: ev.id,
          user_identifier: managerId,
          action: "LOGIN",
          resource: `org:${orgRow.id}`,
          status_code: 200,
          ...meta,
        });
        return {
          ok: true,
          eventId: ev.id,
          eventName: ev.name,
          orgId: orgRow.id,
          orgName: orgRow.org_name,
        };
      }

      // 배정된 행사가 없어도 기관 로그인 자체는 성공 → 템플릿 페이지로 안내
      await logAccess(supabase as unknown as SupabaseClient, {
        user_type: "MANAGER",
        user_id: orgRow.id,
        user_identifier: managerId,
        action: "LOGIN",
        resource: `org:${orgRow.id}`,
        status_code: 200,
        ...meta,
      });
      return {
        ok: true,
        orgId: orgRow.id,
        orgName: orgRow.org_name,
        message: "행사 없음 — 템플릿 페이지로 이동",
      };
    }
  }

  await logAccess(supabase as unknown as SupabaseClient, {
    user_type: "MANAGER",
    user_identifier: managerId,
    action: "LOGIN_FAIL",
    resource: "manager",
    status_code: 401,
    ...meta,
  });
  return { ok: false, message: "아이디 또는 비밀번호가 틀렸습니다" };
}

async function setManagerCookie(eventId: string, eventName: string, managerId: string) {
  const cookieStore = await cookies();
  cookieStore.set("campnic_manager", JSON.stringify({
    eventId, eventName, managerId, loginAt: new Date().toISOString(),
  }), {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 86400, path: "/",
  });
}

async function setOrgCookie(orgId: string, orgName: string, managerId: string) {
  const cookieStore = await cookies();
  cookieStore.set("campnic_org", JSON.stringify({
    orgId, orgName, managerId, loginAt: new Date().toISOString(),
  }), {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 86400, path: "/",
  });
}
