// 참가자 간편 로그인 — 연락처만 입력하면 세션 발급.
//
// 배경: 기관이 일괄 등록 시 이미 원생명 + 학부모연락처를 기입하므로,
//       참가자는 연락처만으로 로그인. 비밀번호 단계 제거.
//
// 보안: 세미-프라이빗 환경. 기관이 pre-register 한 번호만 접근 가능.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logAccess, getRequestMeta } from "@/lib/audit-log";
import { normalizeUserPhone } from "@/lib/app-user/account";
import { trySelfRegister } from "@/lib/app-user/self-register";
import type { AppUserRow } from "@/lib/app-user/queries";
import {
  rateLimit,
  getClientIp,
  tooManyRequests,
  maybeGcBuckets,
} from "@/lib/rate-limit";

type SbRespOne<T> = { data: T | null; error: unknown };

type OrgNameRow = { org_name: string | null };

const USER_COOKIE = "campnic_user";

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  // 30일
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * 폼 전송 실패 시 redirect 대상에 `?err=<code>` 를 merge 해서 303 리다이렉트.
 * JSON 본문이 브라우저에 노출되는 UX 를 막기 위해 사용.
 */
function formErrorRedirect(
  request: Request,
  errCode: string
): NextResponse {
  const safe = resolveSafeRedirect(request);
  // safe 가 query 를 이미 가지고 있을 수도 있으므로 URL 로 parse 후 merge
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const target = new URL(safe, origin);
  target.searchParams.set("err", errCode);
  return NextResponse.redirect(target, { status: 303 });
}

/**
 * ?redirect=... 파라미터 검증 — open redirect 방지.
 *  - "/" 로 시작 (상대 경로)
 *  - "//" 로 시작하면 거부 (protocol-relative: //evil.com)
 *  - "/\"    (backslash) 경로도 거부 — 일부 브라우저가 //로 해석
 *  - query/hash 는 통과
 * 유효하지 않으면 기본 "/home".
 */
function resolveSafeRedirect(request: Request): string {
  const raw = new URL(request.url).searchParams.get("redirect");
  if (!raw) return "/home";
  if (!raw.startsWith("/")) return "/home";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/home";
  // 영역 길이 cap — 비정상적으로 긴 값 차단
  if (raw.length > 500) return "/home";
  return raw;
}

async function readBody(request: Request): Promise<{
  phone: string;
  eventId: string;
  parentName: string;
  isForm: boolean;
}> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await request.json()) as {
        phone?: unknown;
        event_id?: unknown;
        parent_name?: unknown;
      };
      return {
        phone: String(body?.phone ?? ""),
        eventId: String(body?.event_id ?? ""),
        parentName: String(body?.parent_name ?? ""),
        isForm: false,
      };
    } catch {
      return { phone: "", eventId: "", parentName: "", isForm: false };
    }
  }
  // form-urlencoded / multipart
  try {
    const form = await request.formData();
    return {
      phone: String(form.get("phone") ?? ""),
      eventId: String(form.get("event_id") ?? ""),
      parentName: String(form.get("parent_name") ?? ""),
      isForm: true,
    };
  } catch {
    return { phone: "", eventId: "", parentName: "", isForm: true };
  }
}

export async function POST(request: Request) {
  // Rate limit: IP 당 분당 10회. brute-force / 폭주 차단.
  const ip = getClientIp(request) ?? "unknown";
  const rl = rateLimit({
    key: `user-login:${ip}`,
    windowMs: 60_000,
    max: 10,
  });
  maybeGcBuckets();
  if (!rl.allowed) return tooManyRequests(rl);

  const { phone: rawPhone, eventId, parentName, isForm } =
    await readBody(request);
  const phone = normalizeUserPhone(rawPhone);

  const supabase = await createClient();
  const meta = getRequestMeta(request.headers);

  if (!phone || phone.length < 10 || phone.length > 11) {
    if (isForm) return formErrorRedirect(request, "invalid_phone");
    return jsonError("연락처를 올바르게 입력해주세요", 400);
  }

  // 1) app_users 조회 (연락처만으로)
  const userResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<AppUserRow>>;
        };
      };
    }
  )
    .select(
      "id, phone, password_hash, parent_name, org_id, acorn_balance, status, notification_consent, first_login_at, last_login_at, created_at"
    )
    .eq("phone", phone)
    .maybeSingle()) as SbRespOne<AppUserRow>;

  const user = userResp.data;

  if (!user) {
    // event_id 가 제공되면 self-register 흐름 시도.
    // event.allow_self_register=true AND status=LIVE 인 경우에만 신규 가입.
    // 나머지 케이스는 기존 "notfound" fallback.
    if (eventId) {
      const selfRegisterResult = await trySelfRegister(
        supabase,
        { phone, parentName: parentName.trim(), eventId },
        meta
      );

      if (selfRegisterResult.kind === "SUCCESS") {
        const nowIso = new Date().toISOString();
        const cookieStore = await cookies();
        cookieStore.set(
          USER_COOKIE,
          JSON.stringify({
            id: selfRegisterResult.userId,
            phone,
            parentName: selfRegisterResult.parentName,
            orgId: selfRegisterResult.orgId,
            orgName: selfRegisterResult.orgName,
            loginAt: nowIso,
          }),
          cookieOpts
        );

        await logAccess(supabase as unknown as SupabaseClient, {
          user_type: "USER",
          user_id: selfRegisterResult.userId,
          user_identifier: phone.slice(-4),
          action: "SELF_REGISTER",
          resource: "app_users",
          status_code: 200,
          ...meta,
        });

        const safeRedirect = resolveSafeRedirect(request);
        if (isForm) {
          return NextResponse.redirect(
            new URL(
              safeRedirect,
              process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
            ),
            { status: 303 }
          );
        }
        return NextResponse.json({ ok: true, redirectTo: safeRedirect });
      }

      if (selfRegisterResult.kind === "NEEDS_NAME") {
        if (isForm) return formErrorRedirect(request, "needs_signup");
        return NextResponse.json(
          { ok: false, needs_signup: true, error: "이름을 입력해 주세요" },
          { status: 422 }
        );
      }

      // kind === "NOT_ALLOWED" → 기존 notfound 흐름으로 fall-through
    }

    await logAccess(supabase as unknown as SupabaseClient, {
      user_type: "USER",
      user_identifier: phone.slice(-4),
      action: "LOGIN_FAIL",
      resource: "app_users",
      status_code: 401,
      ...meta,
    });
    if (isForm) return formErrorRedirect(request, "notfound");
    return jsonError("등록되지 않은 번호예요. 기관에 문의해 주세요.", 401);
  }

  // 2) 상태 체크
  if (user.status === "SUSPENDED") {
    if (isForm) return formErrorRedirect(request, "suspended");
    return jsonError("계정이 일시 정지됐어요. 기관에 문의하세요.", 403);
  }
  if (user.status === "CLOSED") {
    if (isForm) return formErrorRedirect(request, "closed");
    return jsonError("계정이 종료됐어요.", 403);
  }

  // 3) 기관명 조회
  const orgResp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbRespOne<OrgNameRow>>;
        };
      };
    }
  )
    .select("org_name")
    .eq("id", user.org_id)
    .maybeSingle()) as SbRespOne<OrgNameRow>;

  const orgName = orgResp.data?.org_name ?? "";

  // 4) 세션 쿠키 설정
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
    cookieOpts
  );

  // 5) last_login_at / first_login_at 갱신
  const patch: Record<string, string> = { last_login_at: nowIso };
  if (!user.first_login_at) patch.first_login_at = nowIso;
  try {
    await (
      supabase.from("app_users" as never) as unknown as {
        update: (p: unknown) => {
          eq: (k: string, v: string) => Promise<{ error: unknown }>;
        };
      }
    )
      .update(patch as never)
      .eq("id", user.id);
  } catch {
    // best-effort — 로그인은 성공시킨다
  }

  // 6) 감사 로그
  await logAccess(supabase as unknown as SupabaseClient, {
    user_type: "USER",
    user_id: user.id,
    user_identifier: phone.slice(-4),
    action: "LOGIN",
    resource: "app_users",
    status_code: 200,
    ...meta,
  });

  // 7) 응답
  const safeRedirect = resolveSafeRedirect(request);
  if (isForm) {
    return NextResponse.redirect(
      new URL(
        safeRedirect,
        process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
      ),
      { status: 303 }
    );
  }
  return NextResponse.json({ ok: true, redirectTo: safeRedirect });
}
