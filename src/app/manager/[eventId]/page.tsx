import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ManagerDashboard({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!event) notFound();

  const [{ count: participantCount }, { count: missionCount }, { count: pendingCount }] = await Promise.all([
    supabase.from("participants").select("*", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("missions").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("is_active", true),
    supabase.from("submissions").select("missions!inner(event_id)", { count: "exact", head: true }).eq("missions.event_id", eventId).eq("status", "PENDING"),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://we-capm.vercel.app";
  const joinUrl = `${appUrl}/join/${event.join_code}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <p className="text-sm">상태: {event.status} · 📍 {event.location}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link href={`/manager/${eventId}/missions`} className="rounded-lg border bg-white p-4 text-center hover:border-violet-500">
          <div className="text-2xl">🎯</div><div className="mt-1 font-semibold">미션</div><div className="text-xs">{missionCount ?? 0}개</div>
        </Link>
        <Link href={`/manager/${eventId}/submissions`} className="rounded-lg border bg-white p-4 text-center hover:border-violet-500">
          <div className="text-2xl">✅</div><div className="mt-1 font-semibold">대기함</div><div className="text-xs text-yellow-600">{pendingCount ?? 0}건</div>
        </Link>
        <Link href={`/manager/${eventId}/registrations`} className="rounded-lg border bg-white p-4 text-center hover:border-violet-500">
          <div className="text-2xl">📋</div><div className="mt-1 font-semibold">참가자</div><div className="text-xs">{participantCount ?? 0}명</div>
        </Link>
        <Link href={`/manager/${eventId}/chat`} className="rounded-lg border bg-white p-4 text-center hover:border-violet-500">
          <div className="text-2xl">💬</div><div className="mt-1 font-semibold">채팅</div>
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 font-semibold">입장 QR / 링크</h2>
        <div className="flex items-start gap-4">
          <img src={`/admin/events/${eventId}/qr`} alt="QR" className="h-32 w-32 rounded border" />
          <div className="space-y-2 text-sm">
            <div className="rounded bg-neutral-100 p-2 font-mono text-xs break-all">{joinUrl}</div>
            <p>입장 코드: <strong>{event.join_code}</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}
