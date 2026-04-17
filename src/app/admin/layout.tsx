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
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="font-bold">캠프닉 관리</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin/events" className="hover:underline">행사</Link>
            <Link href="/join" className="hover:underline">참가자 모드</Link>
            <span>{adminName}</span>
            <form action="/api/auth/admin-logout" method="post">
              <button className="rounded-lg border px-2 py-1 text-xs hover:bg-neutral-50">로그아웃</button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl p-4">{children}</div>
    </div>
  );
}
