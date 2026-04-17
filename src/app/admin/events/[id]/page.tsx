import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateEventStatusAction, deleteEventAction, duplicateEventAction } from "../actions";
import type { EventStatus } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "초안", color: "bg-neutral-200" },
  ACTIVE: { label: "진행 중", color: "bg-green-500 text-white" },
  ENDED: { label: "종료", color: "bg-yellow-500 text-white" },
  CONFIRMED: { label: "확정", color: "bg-blue-500 text-white" },
  ARCHIVED: { label: "보관", color: "bg-neutral-400 text-white" },
};

const NEXT_STATUS: Partial<Record<EventStatus, { label: string; target: EventStatus; color: string }>> = {
  DRAFT: { label: "행사 시작", target: "ACTIVE", color: "bg-green-600 hover:bg-green-700" },
  ACTIVE: { label: "행사 종료", target: "ENDED", color: "bg-yellow-600 hover:bg-yellow-700" },
  ENDED: { label: "결과 확정", target: "CONFIRMED", color: "bg-blue-600 hover:bg-blue-700" },
};

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("*").eq("id", id).single();
  if (!event) notFound();

  const [{ count: participantCount }, { count: missionCount }, { count: pendingCount }] =
    await Promise.all([
      supabase.from("participants").select("*", { count: "exact", head: true }).eq("event_id", id),
      supabase.from("missions").select("*", { count: "exact", head: true }).eq("event_id", id).eq("is_active", true),
      supabase.from("submissions").select("missions!inner(event_id)", { count: "exact", head: true }).eq("missions.event_id", id).eq("status", "PENDING"),
    ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://we-capm.vercel.app";
  const joinUrl = `${appUrl}/join/${event.join_code}`;
  const next = NEXT_STATUS[event.status];
  const badge = STATUS_BADGE[event.status] ?? STATUS_BADGE.DRAFT;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/events" className="text-sm hover:underline">← 행사 목록</Link>
        <Link href={`/admin/events/${id}/edit`} className="rounded-lg border px-3 py-1 text-sm hover:bg-neutral-50">편집</Link>
      </div>

      {/* 헤더 */}
      <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-purple-700 p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${badge.color}`}>{badge.label}</span>
            <h1 className="mt-2 text-2xl font-bold">{event.name}</h1>
          </div>
          {next && (
            <form action={async () => { "use server"; await updateEventStatusAction(event.id, next.target); }}>
              <button className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${next.color}`}>{next.label}</button>
            </form>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm opacity-90">
          <div>📍 {event.location}</div>
          <div>📋 입장코드: <span className="font-mono font-bold">{event.join_code}</span></div>
          <div>🗓 {new Date(event.start_at).toLocaleDateString("ko-KR")} {new Date(event.start_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</div>
          <div>⏰ ~ {new Date(event.end_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-white/20 p-3 text-center">
            <div className="text-2xl font-bold">{participantCount ?? 0}</div>
            <div className="text-xs opacity-80">참가자</div>
          </div>
          <div className="rounded-lg bg-white/20 p-3 text-center">
            <div className="text-2xl font-bold">{missionCount ?? 0}</div>
            <div className="text-xs opacity-80">미션</div>
          </div>
          <div className="rounded-lg bg-white/20 p-3 text-center">
            <div className="text-2xl font-bold">{pendingCount ?? 0}</div>
            <div className="text-xs opacity-80">승인 대기</div>
          </div>
        </div>
      </div>

      {/* 관리 메뉴 */}
      <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
        {[
          { href: `/admin/events/${event.id}/missions`, icon: "🎯", label: "미션" },
          { href: `/admin/events/${event.id}/submissions`, icon: "✅", label: "승인" },
          { href: `/admin/events/${event.id}/registrations`, icon: "📋", label: "명단" },
          { href: `/admin/events/${event.id}/participants`, icon: "👥", label: "참가자" },
          { href: `/admin/events/${event.id}/rewards`, icon: "🎁", label: "보상" },
          { href: `/admin/events/${event.id}/staff`, icon: "👨‍💼", label: "스태프" },
          { href: `/admin/events/${event.id}/stats`, icon: "📊", label: "통계" },
          { href: `/admin/events/${event.id}/claim`, icon: "🎫", label: "수령" },
          { href: `/admin/events/${event.id}/chat`, icon: "💬", label: "채팅" },
          { href: `/admin/events/${event.id}/export`, icon: "📥", label: "CSV" },
        ].map((item) => (
          <Link key={item.href} href={item.href}
            className="flex flex-col items-center gap-1 rounded-xl border bg-white p-3 hover:border-violet-500 hover:shadow-sm">
            <span className="text-2xl">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* QR */}
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 font-semibold">입장 QR / 링크</h2>
        <div className="flex items-center gap-6">
          <img src={`/admin/events/${event.id}/qr`} alt="QR" className="h-36 w-36 rounded-xl border" />
          <div className="flex-1 space-y-3">
            <div className="rounded-lg bg-neutral-50 p-3 font-mono text-xs break-all">{joinUrl}</div>
            <div className="flex gap-2">
              <a href={`/admin/events/${event.id}/qr?download=1`} download={`qr-${event.join_code}.png`}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50">QR 다운로드</a>
            </div>
          </div>
        </div>
      </div>

      {/* 하단 액션 */}
      <div className="flex gap-2">
        <form action={async () => { "use server"; await duplicateEventAction(event.id); }}>
          <button className="rounded-lg border px-4 py-2 text-sm hover:bg-neutral-50">행사 복제</button>
        </form>
        <form action={async () => { "use server"; await deleteEventAction(event.id); }}>
          <button className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50">행사 삭제</button>
        </form>
      </div>
    </div>
  );
}
