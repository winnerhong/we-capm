import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { markAllReadAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/notifications");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, message, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

  return (
    <main className="min-h-dvh bg-neutral-50 p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <Link href="/" className="text-sm hover:underline">
          ← 홈
        </Link>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">숲의 소식</h1>
          {unreadCount > 0 && (
            <form action={markAllReadAction}>
              <button className="text-sm text-violet-600 hover:underline">모두 읽음</button>
            </form>
          )}
        </div>

        {notifications && notifications.length > 0 ? (
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`rounded-lg border p-4 ${
                  n.is_read ? "bg-white" : "bg-violet-50 border-violet-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-semibold">{n.title}</div>
                    <p className="mt-1 text-sm">{n.message}</p>
                  </div>
                  {!n.is_read && <span className="h-2 w-2 rounded-full bg-violet-600" />}
                </div>
                <div className="mt-2 text-xs">
                  {new Date(n.created_at).toLocaleString("ko-KR")}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border bg-white p-12 text-center text-sm">
            아직 숲의 소식이 없어요
          </div>
        )}
      </div>
    </main>
  );
}
