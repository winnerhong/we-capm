import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">캠프닉</h1>
            <p className="text-sm text-neutral-600">캠핑 + 피크닉 행사 운영</p>
          </div>
          <Link
            href="/login"
            className="block w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700"
          >
            입장하기
          </Link>
        </div>
      </main>
    );
  }

  const { data: profile } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  const { data: parts } = await supabase
    .from("participants")
    .select("event_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  const eventIds = (parts ?? []).map((p) => p.event_id);
  const { data: myEvents } = eventIds.length
    ? await supabase
        .from("events")
        .select("id, name, status, location, start_at")
        .in("id", eventIds)
    : { data: [] };

  return (
    <main className="min-h-dvh bg-neutral-50 p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-500">안녕하세요</p>
            <h1 className="text-xl font-bold">{profile?.name ?? "참가자"}님</h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/notifications"
              className="relative rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              🔔
              {unreadCount !== null && unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            {profile && (profile.role === "ADMIN" || profile.role === "STAFF") && (
              <Link href="/admin" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50">
                관리자
              </Link>
            )}
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                로그아웃
              </button>
            </form>
          </div>
        </header>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-neutral-600">내 행사</h2>
          {myEvents && myEvents.length > 0 ? (
            <ul className="space-y-2">
              {myEvents.map((ev) => (
                <li key={ev.id}>
                  <Link
                    href={`/event/${ev.id}`}
                    className="block rounded-lg border bg-white p-4 hover:border-violet-500"
                  >
                    <div className="font-semibold">{ev.name}</div>
                    <div className="mt-1 text-sm text-neutral-600">📍 {ev.location}</div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border bg-white p-8 text-center text-sm text-neutral-500">
              참가 중인 행사가 없습니다
              <br />
              QR을 스캔해서 입장하세요
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
