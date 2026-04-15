import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateEventStatusAction, deleteEventAction } from "../actions";
import type { EventStatus } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const NEXT_STATUS: Partial<Record<EventStatus, { label: string; target: EventStatus }>> = {
  DRAFT: { label: "행사 시작 (ACTIVE로 전환)", target: "ACTIVE" },
  ACTIVE: { label: "행사 종료 (ENDED로 전환)", target: "ENDED" },
  ENDED: { label: "결과 확정 (CONFIRMED)", target: "CONFIRMED" },
};

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("*").eq("id", id).single();
  if (!event) notFound();

  const [{ count: participantCount }, { count: missionCount }, { count: pendingCount }] =
    await Promise.all([
      supabase.from("participants").select("*", { count: "exact", head: true }).eq("event_id", id),
      supabase
        .from("missions")
        .select("*", { count: "exact", head: true })
        .eq("event_id", id)
        .eq("is_active", true),
      supabase
        .from("submissions")
        .select("missions!inner(event_id)", { count: "exact", head: true })
        .eq("missions.event_id", id)
        .eq("status", "PENDING"),
    ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://we-capm.vercel.app";
  const joinUrl = `${appUrl}/join/${event.join_code}`;

  const next = NEXT_STATUS[event.status];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/events" className="text-sm text-neutral-500 hover:underline">
          ← 행사 목록
        </Link>
        <Link
          href={`/admin/events/${id}/edit`}
          className="rounded-lg border px-3 py-1 text-sm hover:bg-neutral-50"
        >
          편집
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{event.name}</h1>
            <p className="text-sm text-neutral-500">상태: {event.status}</p>
          </div>
        </div>

        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-neutral-500">장소</dt>
          <dd>{event.location}</dd>
          <dt className="text-neutral-500">시작</dt>
          <dd>{new Date(event.start_at).toLocaleString("ko-KR")}</dd>
          <dt className="text-neutral-500">종료</dt>
          <dd>{new Date(event.end_at).toLocaleString("ko-KR")}</dd>
          <dt className="text-neutral-500">참가 단위</dt>
          <dd>{event.participation_type}</dd>
          <dt className="text-neutral-500">입장 코드</dt>
          <dd className="font-mono">{event.join_code}</dd>
        </dl>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Link
          href={`/admin/events/${event.id}/missions`}
          className="rounded-lg border bg-white p-4 text-center hover:border-violet-500"
        >
          <div className="text-2xl">🎯</div>
          <div className="mt-1 font-semibold">미션</div>
          <div className="text-xs text-neutral-500">{missionCount ?? 0}개</div>
        </Link>
        <Link
          href={`/admin/events/${event.id}/submissions`}
          className="rounded-lg border bg-white p-4 text-center hover:border-violet-500"
        >
          <div className="text-2xl">✅</div>
          <div className="mt-1 font-semibold">대기함</div>
          <div className="text-xs text-yellow-600">{pendingCount ?? 0}건 대기</div>
        </Link>
        <Link
          href={`/admin/events/${event.id}/participants`}
          className="rounded-lg border bg-white p-4 text-center hover:border-violet-500"
        >
          <div className="text-2xl">👥</div>
          <div className="mt-1 font-semibold">참가자</div>
          <div className="text-xs text-neutral-500">{participantCount ?? 0}명</div>
        </Link>
        <Link
          href={`/admin/events/${event.id}/rewards`}
          className="rounded-lg border bg-white p-4 text-center hover:border-violet-500"
        >
          <div className="text-2xl">🎁</div>
          <div className="mt-1 font-semibold">보상</div>
          <div className="text-xs text-neutral-500">관리</div>
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 font-semibold">입장 QR</h2>
        <div className="flex items-start gap-6">
          <img
            src={`/admin/events/${event.id}/qr`}
            alt="입장 QR 코드"
            className="h-48 w-48 rounded border"
          />
          <div className="flex-1 space-y-2 text-sm">
            <div className="break-all rounded bg-neutral-100 p-2 font-mono text-xs">{joinUrl}</div>
            <a
              href={`/admin/events/${event.id}/qr?download=1`}
              download={`qr-${event.join_code}.png`}
              className="inline-block rounded border px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              QR 다운로드
            </a>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-white p-6">
        <h2 className="font-semibold">행사 상태 관리</h2>
        {next && (
          <form
            action={async () => {
              "use server";
              await updateEventStatusAction(event.id, next.target);
            }}
          >
            <button
              type="submit"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              {next.label}
            </button>
          </form>
        )}
        <form
          action={async () => {
            "use server";
            await deleteEventAction(event.id);
          }}
        >
          <button
            type="submit"
            className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            행사 삭제
          </button>
        </form>
      </div>
    </div>
  );
}
