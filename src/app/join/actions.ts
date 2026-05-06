"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { formatKorean } from "@/lib/phone";
import { logAccess, getRequestMeta } from "@/lib/audit-log";
import { recordConsent, type ConsentInput } from "@/lib/consent";
import type { SupabaseClient } from "@supabase/supabase-js";

const USER_COOKIE = "campnic_user";

export async function directPhoneLoginAction(
  phoneDigits: string,
  consent?: ConsentInput
) {
  const supabase = await createClient();

  const phone = phoneDigits.startsWith("0") ? phoneDigits : `0${phoneDigits}`;
  const formatted = formatKorean(phone);

  // 모든 ACTIVE 행사에서 이 번호로 등록된 것 찾기 (legacy event_registrations)
  const { data: regs } = await supabase
    .from("event_registrations")
    .select("id, event_id, name, phone, status")
    .eq("phone", formatted);

  if (regs && regs.length > 0) {
    return await enterEvent(supabase, regs[0], consent);
  }

  // 전화번호 뒷자리로도 시도 (legacy)
  const { data: partialRegs } = await supabase
    .from("event_registrations")
    .select("id, event_id, name, phone, status")
    .like("phone", `%${phoneDigits.slice(-4)}`);

  if (partialRegs && partialRegs.length > 0) {
    return await enterEvent(supabase, partialRegs[0], consent);
  }

  // ──────────────── 신규 스키마(app_users) fallback ────────────────
  // 기관이 새 시스템(/org/[orgId]/users)에서 등록한 학부모 → app_users 에 저장됨.
  // phone 은 숫자만(010xxxxxxxx). 매칭되면 campnic_user 쿠키로 신규 포털 진입.
  return await tryAppUsersLogin(supabase, phone, consent);
}

async function tryAppUsersLogin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  phoneWithLeadingZero: string,
  consent?: ConsentInput
) {
  type AppUserMin = {
    id: string;
    phone: string;
    parent_name: string | null;
    org_id: string;
    status: string | null;
  };
  const userResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: AppUserMin | null }>;
        };
      };
    }
  )
    .select("id, phone, parent_name, org_id, status")
    .eq("phone", phoneWithLeadingZero)
    .maybeSingle()) as { data: AppUserMin | null };

  const user = userResp.data;
  if (!user) {
    return {
      ok: false,
      message: "등록된 번호가 없습니다. 관리자에게 문의해주세요.",
    };
  }
  if (user.status === "SUSPENDED" || user.status === "CLOSED") {
    return {
      ok: false,
      message: "계정 사용이 제한되어 있어요. 기관에 문의해 주세요.",
    };
  }

  // 기관명
  const orgResp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { org_name: string | null } | null;
          }>;
        };
      };
    }
  )
    .select("org_name")
    .eq("id", user.org_id)
    .maybeSingle()) as { data: { org_name: string | null } | null };
  const orgName = orgResp.data?.org_name ?? "";

  // 신규 포털 세션 쿠키
  const nowIso = new Date().toISOString();
  const cookieStore = await cookies();
  cookieStore.set(
    USER_COOKIE,
    JSON.stringify({
      id: user.id,
      phone: user.phone,
      parentName: user.parent_name,
      orgId: user.org_id,
      orgName,
      loginAt: nowIso,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    }
  );

  // last_login_at 갱신 (best-effort)
  try {
    await (
      supabase.from("app_users" as never) as unknown as {
        update: (p: unknown) => {
          eq: (k: string, v: string) => Promise<{ error: unknown }>;
        };
      }
    )
      .update({ last_login_at: nowIso } as never)
      .eq("id", user.id);
  } catch {
    /* ignore */
  }

  // 동의 기록 (best-effort)
  try {
    if (consent) {
      const hdrs = await headers();
      const meta = getRequestMeta(hdrs);
      await recordConsent(supabase as unknown as SupabaseClient, {
        user_type: "participant",
        user_identifier: user.phone,
        consent,
        ip_address: meta.ip_address ?? undefined,
        user_agent: meta.user_agent ?? undefined,
      });
      await logAccess(supabase as unknown as SupabaseClient, {
        user_type: "USER",
        user_id: user.id,
        user_identifier: user.phone.slice(-4),
        action: "LOGIN",
        resource: "app_users",
        status_code: 200,
        ...meta,
      });
    }
  } catch {
    /* ignore */
  }

  // 신규 포털 홈으로 — eventId 가 아닌 sentinel 값을 돌려주고 클라이언트가 분기.
  return { ok: true, redirectTo: "/home", name: user.parent_name ?? "참가자" };
}

async function enterEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reg: { id: string; event_id: string; name: string; phone: string; status: string },
  consent?: ConsentInput
) {
  if (reg.status !== "ENTERED") {
    await supabase
      .from("event_registrations")
      .update({ status: "ENTERED", entered_at: new Date().toISOString() })
      .eq("id", reg.id);
  }

  const { data: existingP } = await supabase
    .from("participants")
    .select("id")
    .eq("event_id", reg.event_id)
    .eq("phone", reg.phone)
    .maybeSingle();

  let participantId = existingP?.id;
  if (!participantId) {
    const { data: newP } = await supabase
      .from("participants")
      .insert({ event_id: reg.event_id, phone: reg.phone, participation_type: "INDIVIDUAL" })
      .select("id")
      .single();
    participantId = newP?.id;
  }

  // 단톡방 자동 입장
  const displayName = `${reg.name} 가족`;
  const { data: groupRoom } = await supabase
    .from("chat_rooms").select("id")
    .eq("event_id", reg.event_id).eq("type", "GROUP").maybeSingle();

  if (groupRoom) {
    const { data: existingMember } = await supabase
      .from("chat_members").select("id")
      .eq("room_id", groupRoom.id).eq("participant_phone", reg.phone).maybeSingle();

    if (!existingMember) {
      await supabase.from("chat_members").insert({
        room_id: groupRoom.id, participant_name: displayName, participant_phone: reg.phone,
      });
      await supabase.from("chat_messages").insert({
        room_id: groupRoom.id, sender_name: "시스템", type: "SYSTEM",
        content: `${displayName}이 입장했습니다`,
      });
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(
    "campnic_participant",
    JSON.stringify({
      eventId: reg.event_id,
      phone: reg.phone,
      name: reg.name,
      registrationId: reg.id,
      participantId,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    }
  );

  try {
    const hdrs = await headers();
    const meta = getRequestMeta(hdrs);
    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "PARTICIPANT",
      user_id: participantId,
      user_identifier: reg.phone,
      action: "LOGIN",
      resource: `event:${reg.event_id}`,
      status_code: 200,
      ...meta,
    });

    if (consent) {
      await recordConsent(supabase as unknown as SupabaseClient, {
        user_type: "participant",
        user_identifier: reg.phone,
        consent,
        ip_address: meta.ip_address ?? undefined,
        user_agent: meta.user_agent ?? undefined,
      });
    }
  } catch {
    // best-effort
  }

  return { ok: true, eventId: reg.event_id, name: reg.name };
}
