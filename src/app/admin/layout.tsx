import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("campnic_admin");

  if (!adminCookie?.value) redirect("/login");

  let adminName = "관리자";
  try {
    const data = JSON.parse(adminCookie.value);
    adminName = data.id ?? "관리자";
  } catch {}

  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2 font-bold text-violet-600">
              <span className="text-xl">🏕️</span>
              <span>캠프닉</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/admin/events" className="rounded-lg px-3 py-1.5 hover:bg-neutral-100">📋 행사목록</Link>
              <Link href="/admin/stats" className="rounded-lg px-3 py-1.5 hover:bg-neutral-100">📊 전체통계</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">{adminName}</span>
            <form action="/api/auth/admin-logout" method="post">
              <button className="rounded-lg border px-3 py-1 text-xs hover:bg-neutral-50">로그아웃</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl p-4">{children}</div>
    </div>
  );
}
