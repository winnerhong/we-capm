import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

const DEFAULT_PROFILE_NAME = "참가자";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { pathname } = request.nextUrl;

  const isApiRoute = pathname.startsWith("/api");
  const isAuthFlow = pathname === "/login" || pathname === "/login/verify";
  const isOnboarding = pathname === "/login/name";
  const isAdminRoute = pathname.startsWith("/admin");
  const isEventRoute = pathname.startsWith("/event");
  const isProtectedRoute = isAdminRoute || pathname.startsWith("/me");

  if (isApiRoute) return response;

  // campnic_participant 쿠키가 있으면 참가자로 인정 (event 라우트만)
  const participantCookie = request.cookies.get("campnic_participant");
  const hasParticipantSession = !!participantCookie?.value;

  if (isEventRoute && hasParticipantSession) {
    return response;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user && (isProtectedRoute || (isEventRoute && !hasParticipantSession))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthFlow) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  const needsProfileCheck = user && !isOnboarding && (isAdminRoute || pathname === "/" || isEventRoute || pathname.startsWith("/me"));

  if (needsProfileCheck && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, role")
      .eq("id", user.id)
      .single();

    if (profile && profile.name === DEFAULT_PROFILE_NAME && !hasParticipantSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/login/name";
      if (pathname !== "/") url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    if (isAdminRoute && (!profile || (profile.role !== "ADMIN" && profile.role !== "STAFF"))) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
