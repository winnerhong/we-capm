import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();

  if (!profile || (profile.role !== "ADMIN" && profile.role !== "STAFF")) {
    redirect("/");
  }

  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="font-bold">
            캠프닉 관리
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin/events" className="hover:underline">
              행사
            </Link>
            <Link href="/" className="text-neutral-500 hover:underline">
              참가자 모드
            </Link>
            <span className="text-neutral-500">{profile.name}</span>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                로그아웃
              </button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl p-4">{children}</div>
    </div>
  );
}
