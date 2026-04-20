import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NotificationComposer from "./notification-composer";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, status, start_at")
    .order("start_at", { ascending: false })
    .limit(50);

  const eventList = (events ?? []).map((e) => ({ id: e.id, name: e.name }));

  return (
    <div className="space-y-6">
      {/* 상단 네비 */}
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-sm text-[#2D5A3D] hover:underline font-medium">
          ← 대시보드
        </Link>
        <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-semibold">
          베타 · 실발송 차단됨
        </span>
      </div>

      {/* 헤더 */}
      <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-[11px] tracking-[0.4em] opacity-70 font-light">BROADCAST</p>
          <h1 className="text-2xl font-extrabold mt-1 flex items-center gap-2">
            <span>📣</span>
            <span>알림 발송</span>
          </h1>
          <p className="mt-2 text-sm opacity-80">
            참가자·기관에게 SMS/알림톡/앱 푸시를 한 번에 보내요
          </p>
        </div>
      </div>

      <NotificationComposer events={eventList} />
    </div>
  );
}
