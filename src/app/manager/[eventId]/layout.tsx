import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function ManagerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const cookieStore = await cookies();
  const managerCookie = cookieStore.get("campnic_manager");

  if (!managerCookie?.value) redirect("/manager");

  let eventName = "행사";
  let managerId = "";
  try {
    const data = JSON.parse(managerCookie.value);
    if (data.eventId !== eventId) redirect("/manager");
    eventName = data.eventName ?? "행사";
    managerId = data.managerId ?? "";
  } catch {
    redirect("/manager");
  }

  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href={`/manager/${eventId}`} className="font-bold">{eventName}</Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href={`/manager/${eventId}/missions`} className="hover:underline">미션</Link>
            <Link href={`/manager/${eventId}/submissions`} className="hover:underline">승인</Link>
            <Link href={`/manager/${eventId}/registrations`} className="hover:underline">참가자</Link>
            <Link href={`/manager/${eventId}/chat`} className="hover:underline">채팅</Link>
            <span className="text-neutral-400">{managerId}</span>
            <form action="/api/auth/manager-logout" method="post">
              <button className="rounded border px-2 py-1 text-xs hover:bg-neutral-50">로그아웃</button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl p-4">{children}</div>
    </div>
  );
}
