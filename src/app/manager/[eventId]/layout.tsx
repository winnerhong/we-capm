import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AcornIcon } from "@/components/acorn-icon";

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

  // 도토리 잔액 (events.acorn_balance 가 없는 스키마에서는 0)
  let acornBalance = 0;
  try {
    const supabase = await createClient();
    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { acorn_balance: number | null } | null;
            }>;
          };
        };
      };
    };
    const { data } = await sb
      .from("events")
      .select("acorn_balance")
      .eq("id", eventId)
      .maybeSingle();
    acornBalance = data?.acorn_balance ?? 0;
  } catch {
    acornBalance = 0;
  }

  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="border-b border-[#E8F0E4] bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
          <Link href={`/manager/${eventId}`} className="flex items-center gap-2 font-bold text-[#2D5A3D]">
            <span className="text-xl" aria-hidden>🌲</span>
            <span>{eventName}</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href={`/admin/events/${eventId}/missions`} className="rounded-lg px-3 py-1.5 text-[#2C2C2C] hover:bg-[#E8F0E4] hover:text-[#2D5A3D]">미션</Link>
            <Link href={`/admin/events/${eventId}/submissions`} className="rounded-lg px-3 py-1.5 text-[#2C2C2C] hover:bg-[#E8F0E4] hover:text-[#2D5A3D]">승인</Link>
            <Link href={`/admin/events/${eventId}/registrations`} className="rounded-lg px-3 py-1.5 text-[#2C2C2C] hover:bg-[#E8F0E4] hover:text-[#2D5A3D]">참가자</Link>
            <Link href={`/admin/events/${eventId}/staff`} className="rounded-lg px-3 py-1.5 text-[#2C2C2C] hover:bg-[#E8F0E4] hover:text-[#2D5A3D]">선생님</Link>
            <Link href={`/admin/events/${eventId}/chat`} className="rounded-lg px-3 py-1.5 text-[#2C2C2C] hover:bg-[#E8F0E4] hover:text-[#2D5A3D]">채팅</Link>
            <Link href={`/manager/${eventId}/report`} className="rounded-lg px-3 py-1.5 text-[#2C2C2C] hover:bg-[#E8F0E4] hover:text-[#2D5A3D]">📋 행사 리포트</Link>
            <Link href={`/manager/${eventId}/announce`} className="rounded-lg px-3 py-1.5 text-[#2C2C2C] hover:bg-[#E8F0E4] hover:text-[#2D5A3D]">💬 학부모 공지</Link>
            <Link href={`/manager/${eventId}/billing`} className="rounded-lg px-3 py-1.5 text-blue-700 hover:bg-blue-50">💳 결제 & 정산</Link>
            <Link
              href={`/manager/${eventId}/billing/acorns`}
              title="도토리 잔액 — 클릭하여 충전"
              className="ml-1 flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              <span aria-hidden><AcornIcon /></span>
              <span>{acornBalance.toLocaleString("ko-KR")}</span>
            </Link>
            <span className="ml-2 rounded-full bg-[#E8F0E4] px-3 py-1 text-xs font-semibold text-[#2D5A3D]">{managerId}</span>
            <form action="/api/auth/manager-logout" method="post">
              <button className="rounded-lg border border-[#E8F0E4] px-3 py-1 text-xs text-[#6B6560] hover:bg-neutral-50">로그아웃</button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl p-4">{children}</div>
    </div>
  );
}
