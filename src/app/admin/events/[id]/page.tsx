import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateEventStatusAction, deleteEventAction, duplicateEventAction } from "../actions";
import type { EventStatus } from "@/lib/supabase/database.types";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { WinnerTalkIcon } from "@/components/winner-talk-icon";

export const dynamic = "force-dynamic";

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

  const [{ count: participantCount }, { count: missionCount }, { count: pendingCount }, { count: regCount }] =
    await Promise.all([
      supabase.from("participants").select("*", { count: "exact", head: true }).eq("event_id", id),
      supabase.from("missions").select("*", { count: "exact", head: true }).eq("event_id", id).eq("is_active", true),
      supabase.from("submissions").select("missions!inner(event_id)", { count: "exact", head: true }).eq("missions.event_id", id).eq("status", "PENDING"),
      supabase.from("event_registrations").select("*", { count: "exact", head: true }).eq("event_id", id),
    ]);

  // 선생님 수 / 가족 수 / 보상 수
  const { data: allRegsData } = await supabase.from("event_registrations").select("name").eq("event_id", id);
  const teacherCount = (allRegsData ?? []).filter((r) => r.name.includes("선생님")).length;
  const familyCount = (allRegsData ?? []).filter((r) => !r.name.includes("선생님")).length;
  const { count: rewardCount } = await supabase.from("rewards").select("*", { count: "exact", head: true }).eq("event_id", id);

  const { data: topParticipants } = await supabase
    .from("participants").select("id, phone, total_score")
    .eq("event_id", id).order("total_score", { ascending: false }).limit(3);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://we-capm.vercel.app";
  const joinUrl = `${appUrl}/join/${event.join_code}`;
  const next = NEXT_STATUS[event.status];
  const isDraft = event.status === "DRAFT";
  const isActive = event.status === "ACTIVE";
  const isEnded = event.status === "ENDED" || event.status === "CONFIRMED";

  // 체크리스트 (DRAFT)
  const checks = isDraft ? [
    { done: true, label: "행사 정보 입력", link: `/admin/events/${id}/edit` },
    { done: teacherCount > 0, label: `참가 선생님 등록 (${teacherCount}명)`, link: `/admin/events/${id}/staff` },
    { done: familyCount > 0, label: `참가 가족 등록 (${familyCount}명)`, link: `/admin/events/${id}/registrations` },
    { done: (missionCount ?? 0) > 0, label: `미션 만들기 (${missionCount ?? 0}개)`, link: `/admin/events/${id}/missions` },
    { done: (rewardCount ?? 0) > 0, label: `보상 만들기 (${rewardCount ?? 0}개)`, link: `/admin/events/${id}/rewards` },
  ] : [];

  // 등록명단에서 이름 가져오기
  const phones = (topParticipants ?? []).map((p) => p.phone).filter(Boolean);
  const { data: regNames } = phones.length
    ? await supabase.from("event_registrations").select("phone, name").eq("event_id", id).in("phone", phones as string[])
    : { data: [] };
  const nameByPhone = new Map((regNames ?? []).map((r) => [r.phone, r.name]));

  return (
    <div className="space-y-6">
      <RealtimeRefresh table="submissions" />
      <RealtimeRefresh table="participants" />
      <RealtimeRefresh table="event_registrations" />
      <div className="flex items-center justify-between">
        <Link href="/admin/events" className="text-sm hover:underline">← 행사 목록</Link>
        <div className="flex gap-2">
          <Link href={`/admin/events/${id}/edit`} className="rounded-lg border px-3 py-1 text-sm hover:bg-neutral-50">편집</Link>
          {next && (
            <form action={async () => { "use server"; await updateEventStatusAction(event.id, next.target); }}>
              <button className={`rounded-lg px-4 py-1 text-sm font-semibold text-white ${next.color}`}>{next.label}</button>
            </form>
          )}
        </div>
      </div>

      {/* 헤더 */}
      <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-purple-700 p-6 text-white">
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-90">
          <span>📍 {event.location}</span>
          <span>🗓 {new Date(event.start_at).toLocaleDateString("ko-KR")} {new Date(event.start_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} ~ {new Date(event.end_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-white/20 p-3 text-center">
            <div className="text-2xl font-bold">{participantCount ?? 0}<span className="text-sm opacity-70">/{regCount ?? 0}</span></div>
            <div className="text-xs opacity-80">입장/등록</div>
          </div>
          <div className="rounded-lg bg-white/20 p-3 text-center">
            <div className="text-2xl font-bold">{missionCount ?? 0}</div>
            <div className="text-xs opacity-80">미션</div>
          </div>
          <Link href={`/admin/events/${id}/submissions`} className="rounded-lg bg-white/20 p-3 text-center hover:bg-white/30">
            <div className={`text-2xl font-bold ${(pendingCount ?? 0) > 0 ? "text-yellow-300" : ""}`}>{pendingCount ?? 0}</div>
            <div className="text-xs opacity-80">승인 대기</div>
          </Link>
        </div>
      </div>

      {/* DRAFT: 준비 체크리스트 */}
      {isDraft && (
        <div className="rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 p-5">
          <h2 className="mb-3 font-bold">📋 준비 체크리스트</h2>
          <ul className="space-y-2">
            {checks.map((c) => (
              <li key={c.label}>
                <Link href={c.link} className="flex items-center gap-3 rounded-lg bg-white p-3 hover:shadow-sm">
                  <span className={`text-lg ${c.done ? "text-green-500" : "text-neutral-300"}`}>{c.done ? "✅" : "⬜"}</span>
                  <span className={c.done ? "" : "font-semibold"}>{c.label}</span>
                  <span className="ml-auto text-xs text-violet-600">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ACTIVE: 빠른 액션 */}
      {isActive && (
        <>
          {(pendingCount ?? 0) > 0 && (
            <Link href={`/admin/events/${id}/submissions`}
              className="block rounded-2xl bg-red-50 border-2 border-red-200 p-6 text-center hover:shadow-md">
              <div className="text-4xl font-bold text-red-600">{pendingCount}건</div>
              <div className="mt-1 text-sm">승인 대기 중</div>
              <div className="mt-3 inline-block rounded-lg bg-red-600 px-6 py-2 font-semibold text-white">지금 승인하러 가기</div>
            </Link>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Link href={`/admin/events/${id}/submissions`}
              className="flex flex-col items-center gap-2 rounded-xl border-2 bg-white p-4 hover:border-violet-500">
              <span className="text-3xl">✅</span><span className="font-semibold">승인</span>
            </Link>
            <Link href={`/admin/events/${id}/chat`}
              className="flex flex-col items-center gap-2 rounded-xl border-2 bg-white p-4 hover:border-violet-500">
              <span className="text-3xl">💬</span><span className="font-semibold">채팅/공지</span>
            </Link>
            <Link href={`/admin/events/${id}/entry-status`}
              className="flex flex-col items-center gap-2 rounded-xl border-2 bg-white p-4 hover:border-violet-500">
              <span className="text-3xl">📋</span><span className="font-semibold">입장 현황</span>
            </Link>
          </div>
        </>
      )}

      {/* ENDED: 결과 요약 */}
      {isEnded && topParticipants && topParticipants.length > 0 && (
        <div className="rounded-2xl border bg-white p-5">
          <h2 className="mb-3 font-bold">🏆 최종 결과</h2>
          <ol className="space-y-2">
            {topParticipants.map((p, i) => {
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
              const name = nameByPhone.get(p.phone ?? "") ?? p.phone ?? "?";
              return (
                <li key={p.id} className="flex items-center justify-between rounded-lg bg-neutral-50 p-3">
                  <span className="font-semibold">{medal} {name}</span>
                  <span className="font-bold">{p.total_score}점</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* 관리 메뉴 */}
      <div className="grid grid-cols-3 gap-2">
        <Link href={`/admin/events/${id}/stats`}
          className="flex flex-col items-center gap-1 rounded-xl border bg-white p-3 hover:border-violet-500">
          <span className="text-xl">📊</span><span className="text-[11px]">통계</span>
        </Link>
        <Link href={`/admin/events/${id}/claim`}
          className="flex flex-col items-center gap-1 rounded-xl border bg-white p-3 hover:border-violet-500">
          <span className="text-xl">🎫</span><span className="text-[11px]">수령</span>
        </Link>
        <Link href={`/admin/events/${id}/chat`}
          className="flex flex-col items-center gap-1 rounded-xl border bg-white p-3 hover:border-violet-500">
          <WinnerTalkIcon size={22} /><span className="text-[11px]">위너톡</span>
        </Link>
      </div>

      {/* QR */}
      <div className="rounded-2xl border bg-white p-5">
        <h2 className="mb-3 font-semibold">📱 입장 QR</h2>
        <div className="flex items-center gap-4">
          <img src={`/admin/events/${event.id}/qr`} alt="QR" className="h-28 w-28 rounded-xl border" />
          <div className="flex-1 space-y-2">
            <div className="rounded-lg bg-neutral-50 p-2 font-mono text-xs break-all">{joinUrl}</div>
            <div className="text-xs">입장코드: <strong>{event.join_code}</strong></div>
            <a href={`/admin/events/${event.id}/qr?download=1`} download className="inline-block rounded border px-3 py-1 text-xs hover:bg-neutral-50">다운로드</a>
          </div>
        </div>
      </div>

      {/* 하단 */}
      <div className="flex gap-2 text-sm">
        <form action={async () => { "use server"; await duplicateEventAction(event.id); }}>
          <button className="rounded-lg border px-4 py-2 hover:bg-neutral-50">행사 복제</button>
        </form>
        <form action={async () => { "use server"; await deleteEventAction(event.id); }}>
          <button className="rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50">삭제</button>
        </form>
      </div>
    </div>
  );
}
