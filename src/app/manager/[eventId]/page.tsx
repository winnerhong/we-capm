import { RealtimeRefresh } from "@/components/realtime-refresh";
import { WinnerTalkIcon } from "@/components/winner-talk-icon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateEventStatusAction } from "@/app/admin/events/actions";
import type { EventStatus } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const NEXT_STATUS: Partial<Record<EventStatus, { label: string; target: EventStatus; color: string }>> = {
  DRAFT: { label: "숲길 열기", target: "ACTIVE", color: "bg-[#2D5A3D] hover:bg-[#3A7A52]" },
  ACTIVE: { label: "숲길 닫기", target: "ENDED", color: "bg-[#C4956A] hover:bg-[#b0835a]" },
  ENDED: { label: "결과 확정", target: "CONFIRMED", color: "bg-[#4A7C59] hover:bg-[#3d6a4b]" },
};

export default async function ManagerDashboard({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: id } = await params;
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

  const { data: allRegsData } = await supabase.from("event_registrations").select("name").eq("event_id", id);
  const teacherCount = (allRegsData ?? []).filter((r) => r.name.includes("선생님")).length;
  const familyCount = (allRegsData ?? []).filter((r) => !r.name.includes("선생님")).length;
  const { count: rewardCount } = await supabase.from("rewards").select("*", { count: "exact", head: true }).eq("event_id", id);

  const { data: topParticipants } = await supabase
    .from("participants").select("id, phone, total_score")
    .eq("event_id", id).order("total_score", { ascending: false }).limit(3);

  const { data: allScores } = await supabase.from("participants").select("total_score").eq("event_id", id);
  const avgScore = allScores && allScores.length > 0
    ? Math.round(allScores.reduce((sum, p) => sum + (p.total_score ?? 0), 0) / allScores.length)
    : 0;

  const now = new Date();
  const startAt = new Date(event.start_at);
  const diffMs = startAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const ddayLabel = diffDays === 0 ? "D-DAY" : diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://we-capm.vercel.app";
  const joinUrl = `${appUrl}/join/${event.join_code}`;
  const next = NEXT_STATUS[event.status];
  const isActive = event.status === "ACTIVE";
  const isEnded = event.status === "ENDED" || event.status === "CONFIRMED";

  const checks = [
    { done: true, label: "행사 정보 입력", link: `/admin/events/${id}/edit` },
    { done: teacherCount > 0, label: `참가 선생님 등록 (${teacherCount}명)`, link: `/admin/events/${id}/staff` },
    { done: familyCount > 0, label: `참가 가족 등록 (${familyCount}명)`, link: `/admin/events/${id}/registrations` },
    { done: (missionCount ?? 0) > 0, label: `숲길 만들기 (${missionCount ?? 0}개)`, link: `/admin/events/${id}/missions` },
    { done: (rewardCount ?? 0) > 0, label: `보상 만들기 (${rewardCount ?? 0}개)`, link: `/admin/events/${id}/rewards` },
  ];

  const phones = (topParticipants ?? []).map((p) => p.phone).filter(Boolean);
  const { data: regNames } = phones.length
    ? await supabase.from("event_registrations").select("phone, name").eq("event_id", id).in("phone", phones as string[])
    : { data: [] };
  const nameByPhone = new Map((regNames ?? []).map((r) => [r.phone, r.name]));

  return (
    <div className="space-y-6"><RealtimeRefresh table="submissions" /><RealtimeRefresh table="participants" /><RealtimeRefresh table="event_registrations" />
      <div className="flex items-center justify-between">
        <div />
        <div className="flex gap-2">
          {next && (
            <form action={async () => { "use server"; await updateEventStatusAction(event.id, next.target); }}>
              <button className={`rounded-lg px-4 py-1 text-sm font-semibold text-white ${next.color}`}>{next.label}</button>
            </form>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-[0_10px_30px_-12px_rgba(45,90,61,0.4)]">
        <div className="flex items-center gap-2 text-xs text-[#D4E4BC]">
          <span aria-hidden>🌲</span>
          <span>오늘의 숲길</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold">{event.name}</h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-90">
          <span>📍 {event.location}</span>
          <span>🗓 {new Date(event.start_at).toLocaleDateString("ko-KR")} {new Date(event.start_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} ~ {new Date(event.end_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white/15 p-3 text-center backdrop-blur-sm">
            <div className="text-2xl font-bold">{participantCount ?? 0}<span className="text-sm opacity-70">/{regCount ?? 0}</span></div>
            <div className="text-xs opacity-80">🐿️ 입장/등록</div>
          </div>
          <div className="rounded-xl bg-white/15 p-3 text-center backdrop-blur-sm">
            <div className="text-2xl font-bold">{missionCount ?? 0}</div>
            <div className="text-xs opacity-80">🍃 숲길</div>
          </div>
          <Link href={`/admin/events/${id}/submissions`} className="rounded-xl bg-white/15 p-3 text-center backdrop-blur-sm transition-colors hover:bg-white/25">
            <div className={`text-2xl font-bold ${(pendingCount ?? 0) > 0 ? "text-[#F5D58C]" : ""}`}>{pendingCount ?? 0}</div>
            <div className="text-xs opacity-80">🌰 승인 대기</div>
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-bold text-[#2D5A3D]">🏫 숲친구들 CRM</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 text-center shadow-sm">
            <div className="text-2xl" aria-hidden>🐿️</div>
            <div className="mt-1 text-xs text-[#6B6560]">참가 다람이가족</div>
            <div className="mt-1 text-lg font-bold text-[#2D5A3D]">
              {familyCount}<span className="text-xs font-normal text-[#6B6560]">명 / 목표 {regCount ?? 0}명</span>
            </div>
          </div>
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 text-center shadow-sm">
            <div className="text-2xl" aria-hidden>📊</div>
            <div className="mt-1 text-xs text-[#6B6560]">평균 도토리</div>
            <div className="mt-1 text-lg font-bold text-[#2D5A3D]">
              {avgScore}<span className="text-xs font-normal text-[#6B6560]">점</span>
            </div>
          </div>
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 text-center shadow-sm">
            <div className="text-2xl" aria-hidden>💬</div>
            <div className="mt-1 text-xs text-[#6B6560]">오늘 토리톡</div>
            <div className="mt-1 text-sm font-bold text-[#2D5A3D]">활발해요 🌿</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#2D5A3D]">📆 다음 일정</h2>
          <span className="rounded-full bg-[#2D5A3D] px-3 py-1 text-xs font-bold text-white">{ddayLabel}</span>
        </div>
        <div className="mt-3 space-y-1.5 text-sm text-[#2C2C2C]">
          <div>🌅 시작: <strong className="text-[#2D5A3D]">{startAt.toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" })}</strong></div>
          <div>📍 장소: <strong className="text-[#2D5A3D]">{event.location}</strong></div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-[#4A7C59]/40 bg-[#E8F0E4] p-5">
          <h2 className="mb-3 font-bold text-[#2D5A3D]">🏞️ 숲길 준비 체크리스트</h2>
          <ul className="space-y-2">
            {checks.map((c) => (
              <li key={c.label}>
                <Link href={c.link} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
                  <span className={`text-lg ${c.done ? "text-[#2D5A3D]" : "text-neutral-300"}`}>{c.done ? "✅" : "⬜"}</span>
                  <span className={`text-[#2C2C2C] ${c.done ? "" : "font-semibold"}`}>{c.label}</span>
                  <span className="ml-auto text-xs text-[#C4956A]">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

      {isActive && (
        <>
          {(pendingCount ?? 0) > 0 && (
            <Link href={`/admin/events/${id}/submissions`}
              className="block rounded-2xl border-2 border-[#C4956A]/40 bg-gradient-to-br from-[#FFF8F0] to-[#F5E6D3] p-6 text-center shadow-sm transition-shadow hover:shadow-md">
              <div className="text-4xl font-bold text-[#C4956A]">🌰 {pendingCount}건</div>
              <div className="mt-1 text-sm text-[#6B6560]">승인을 기다리는 도토리</div>
              <div className="mt-3 inline-block rounded-xl bg-[#C4956A] px-6 py-2 font-semibold text-white shadow-sm hover:bg-[#b0835a]">지금 살펴보기 →</div>
            </Link>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Link href={`/admin/events/${id}/submissions`}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-[#E8F0E4] bg-white p-4 shadow-sm transition-colors hover:border-[#4A7C59]">
              <span className="text-3xl">🌰</span><span className="font-semibold text-[#2C2C2C]">승인</span>
            </Link>
            <Link href={`/admin/events/${id}/chat`}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-[#E8F0E4] bg-white p-4 shadow-sm transition-colors hover:border-[#4A7C59]">
              <span className="text-3xl">🍃</span><span className="font-semibold text-[#2C2C2C]">토리톡/공지</span>
            </Link>
            <Link href={`/admin/events/${id}/entry-status`}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-[#E8F0E4] bg-white p-4 shadow-sm transition-colors hover:border-[#4A7C59]">
              <span className="text-3xl">🐿️</span><span className="font-semibold text-[#2C2C2C]">입장 현황</span>
            </Link>
          </div>
        </>
      )}

      {isEnded && topParticipants && topParticipants.length > 0 && (
        <div className="rounded-2xl border border-[#E8F0E4] bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold text-[#2D5A3D]">🏆 최종 결과</h2>
          <ol className="space-y-2">
            {topParticipants.map((p, i) => {
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
              const name = nameByPhone.get(p.phone ?? "") ?? p.phone ?? "?";
              return (
                <li key={p.id} className="flex items-center justify-between rounded-xl bg-[#E8F0E4] p-3">
                  <span className="font-semibold text-[#2C2C2C]">{medal} {name}</span>
                  <span className="font-bold text-[#2D5A3D]">🌰 {p.total_score}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Link href={`/admin/events/${id}/stats`}
          className="flex flex-col items-center gap-1 rounded-xl border border-[#E8F0E4] bg-white p-3 shadow-sm transition-colors hover:border-[#4A7C59]">
          <span className="text-xl">📊</span><span className="text-[11px] text-[#2C2C2C]">통계</span>
        </Link>
        <Link href={`/admin/events/${id}/claim`}
          className="flex flex-col items-center gap-1 rounded-xl border border-[#E8F0E4] bg-white p-3 shadow-sm transition-colors hover:border-[#4A7C59]">
          <span className="text-xl">🎁</span><span className="text-[11px] text-[#2C2C2C]">수령</span>
        </Link>
        <Link href={`/admin/events/${id}/chat`}
          className="flex flex-col items-center gap-1 rounded-xl border border-[#E8F0E4] bg-white p-3 shadow-sm transition-colors hover:border-[#4A7C59]">
          <WinnerTalkIcon size={22} /><span className="text-[11px] text-[#2C2C2C]">토리톡</span>
        </Link>
      </div>

      <Link
        href={`/manager/${id}/billing`}
        className="flex items-center gap-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="text-3xl" aria-hidden>💳</div>
        <div className="flex-1">
          <div className="text-sm font-bold text-blue-800">결제 & 정산</div>
          <div className="text-[11px] text-[#6B6560]">
            행사 비용 · 도토리 충전 · 학부모 참가비 한눈에 관리
          </div>
        </div>
        <span className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
          바로가기 →
        </span>
      </Link>

      <div className="rounded-2xl border border-[#E8F0E4] bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-[#2D5A3D]">📱 입장 QR</h2>
        <div className="flex items-center gap-4">
          <img src={`/admin/events/${id}/qr`} alt="입장 QR" className="h-28 w-28 rounded-xl border border-[#E8F0E4]" />
          <div className="flex-1 space-y-2">
            <div className="rounded-lg bg-[#E8F0E4] p-2 font-mono text-xs break-all text-[#2C2C2C]">{joinUrl}</div>
            <div className="text-xs text-[#6B6560]">입장코드: <strong className="text-[#2D5A3D]">{event.join_code}</strong></div>
            <a href={`/admin/events/${id}/qr?download=1`} download className="inline-block rounded-lg border border-[#E8F0E4] px-3 py-1 text-xs text-[#6B6560] hover:bg-neutral-50 hover:text-[#2D5A3D]">다운로드</a>
          </div>
        </div>
      </div>
    </div>
  );
}
