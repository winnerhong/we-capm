import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { WinnerTalkIcon } from "@/components/winner-talk-icon";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("campnic_admin");
  const managerCookie = cookieStore.get("campnic_manager");

  if (!adminCookie?.value && !managerCookie?.value) redirect("/login");

  const isAdmin = !!adminCookie?.value;
  let displayName = "관리자";
  let managerEventId = "";

  try {
    if (isAdmin) {
      displayName = JSON.parse(adminCookie!.value).id ?? "관리자";
    } else if (managerCookie?.value) {
      const data = JSON.parse(managerCookie.value);
      displayName = data.managerId ?? "기관";
      managerEventId = data.eventId ?? "";
    }
  } catch {}

  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-6">
            {isAdmin ? (
              <>
                <Link href="/admin" className="flex items-center gap-2 font-bold text-violet-600">
                  <span className="text-xl">🏕️</span><span>캠프닉</span>
                </Link>
                <nav className="flex items-center gap-1 text-sm">
                  <Link href="/admin/events" className="rounded-lg px-3 py-1.5 hover:bg-neutral-100">📋 행사목록</Link>
                  <Link href="/admin/chat" className="flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-neutral-100">
                    <WinnerTalkIcon size={16} />위너톡
                  </Link>
                  <Link href="/admin/stats" className="rounded-lg px-3 py-1.5 hover:bg-neutral-100">📊 전체통계</Link>
                </nav>
              </>
            ) : (
              <Link href={`/manager/${managerEventId}`} className="flex items-center gap-2 font-bold text-violet-600">
                <span className="text-xl">🏢</span><span>{displayName}</span>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isAdmin ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
              {isAdmin ? "관리자" : "기관"}
            </span>
            <form action={isAdmin ? "/api/auth/admin-logout" : "/api/auth/manager-logout"} method="post">
              <button className="rounded-lg border px-3 py-1 text-xs hover:bg-neutral-50">로그아웃</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl p-4">{children}</div>
    </div>
  );
}
