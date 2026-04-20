import { RealtimeRefresh } from "@/components/realtime-refresh";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";

export const dynamic = "force-dynamic";

const TEMPLATE_ICON: Record<string, string> = {
  PHOTO: "📸",
  VIDEO: "🎥",
  LOCATION: "🏞️",
  QUIZ: "🌿",
  MIXED: "🐾",
  TEAM: "🐿️",
  TIMEATTACK: "🍃",
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: "승인 대기", color: "bg-[#FFF2D6] text-[#8B6F47]" },
  APPROVED: { label: "길 걷기 완료", color: "bg-[#D4E4BC] text-[#2D5A3D]" },
  AUTO_APPROVED: { label: "길 걷기 완료", color: "bg-[#D4E4BC] text-[#2D5A3D]" },
  REJECTED: { label: "다시 도전", color: "bg-red-100 text-red-700" },
  RESUBMIT_REQUESTED: { label: "재제출", color: "bg-[#F5D9B5] text-[#8B6F47]" },
  EXPIRED: { label: "만료", color: "bg-neutral-200 text-neutral-600" },
};

export default async function EventMissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const { id } = await params;
  const { result } = await searchParams;

  const p = await getParticipant(id);
  if (!p) redirect(`/join/unknown`);

  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  const { data: missions } = await supabase
    .from("missions")
    .select("id, title, description, template_type, points, order, auto_approve")
    .eq("event_id", id)
    .eq("is_active", true)
    .order("order", { ascending: true });

  const subsByMission = new Map<string, { id: string; mission_id: string; status: string; earned_points: number | null }>();

  return (
    <main className="min-h-dvh bg-neutral-50 p-4"><RealtimeRefresh table="submissions" />
      <div className="mx-auto max-w-lg space-y-4">
        <header className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-lg">
          <Link href={`/event/${id}`} className="text-xs opacity-80 hover:underline">
            ← {event.name}
          </Link>
          <h1 className="mt-1 text-xl font-bold">🌿 오늘의 숲길</h1>
          <p className="mt-1 text-xs opacity-90">오늘, 어디로 걸어볼까요?</p>
          <div className="mt-3 rounded-xl bg-white/20 p-3">
            <div className="text-xs opacity-80">🐿️ {p.name}님</div>
          </div>
        </header>

        {result === "correct" && (
          <div className="rounded-xl bg-[#D4E4BC] p-3 text-sm text-[#2D5A3D]">🌿 정답이에요!</div>
        )}
        {result === "submitted" && (
          <div className="rounded-xl bg-[#D4E4BC] p-3 text-sm text-[#2D5A3D]">🐾 한 걸음 남겼어요</div>
        )}
        {result === "pending" && (
          <div className="rounded-xl bg-[#FFF2D6] p-3 text-sm text-[#8B6F47]">
            🌰 제출 완료 · 지기가 확인 중이에요
          </div>
        )}

        {missions && missions.length > 0 ? (
          <ul className="space-y-2">
            {missions.map((m) => {
              const sub = subsByMission.get(m.id);
              const status = sub?.status;
              const statusInfo = status ? STATUS_LABEL[status] : null;
              const isDone = status === "APPROVED" || status === "AUTO_APPROVED";

              return (
                <li key={m.id}>
                  <Link
                    href={isDone ? "#" : `/event/${id}/missions/${m.id}`}
                    className={`block rounded-2xl border bg-white p-4 ${
                      isDone ? "opacity-75 border-[#D4E4BC]" : "hover:border-violet-500 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span>{TEMPLATE_ICON[m.template_type] ?? "🌿"}</span>
                          <span className="font-semibold">{m.title}</span>
                        </div>
                        <p className="mt-1 text-sm text-[#6B6560]">{m.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-semibold text-violet-600">🌰 {m.points}</span>
                        {statusInfo && (
                          <span className={`rounded-full px-2 py-0.5 text-xs ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border bg-white p-12 text-center text-sm text-[#6B6560]">
            곧 새로운 길이 열려요 🌱
          </div>
        )}
      </div>
    </main>
  );
}
