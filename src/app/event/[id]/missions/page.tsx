import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TEMPLATE_ICON: Record<string, string> = {
  PHOTO: "📸",
  VIDEO: "🎥",
  LOCATION: "📍",
  QUIZ: "✍️",
  MIXED: "🎯",
  TEAM: "🤝",
  TIMEATTACK: "🏃",
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: "승인 대기", color: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "승인됨", color: "bg-green-100 text-green-700" },
  AUTO_APPROVED: { label: "완료", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "반려", color: "bg-red-100 text-red-700" },
  RESUBMIT_REQUESTED: { label: "재제출", color: "bg-orange-100 text-orange-700" },
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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/event/${id}/missions`);

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  const { data: participant } = await supabase
    .from("participants")
    .select("id, total_score")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) redirect(`/event/${id}`);

  const { data: missions } = await supabase
    .from("missions")
    .select("id, title, description, template_type, points, order, auto_approve")
    .eq("event_id", id)
    .eq("is_active", true)
    .order("order", { ascending: true });

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, mission_id, status, earned_points")
    .eq("participant_id", participant.id);

  const subsByMission = new Map(submissions?.map((s) => [s.mission_id, s]));

  return (
    <main className="min-h-dvh bg-neutral-50 p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <header className="rounded-lg bg-violet-600 p-6 text-white">
          <Link href={`/event/${id}`} className="text-xs opacity-80 hover:underline">
            ← {event.name}
          </Link>
          <h1 className="mt-1 text-xl font-bold">미션</h1>
          <div className="mt-3 rounded-lg bg-white/20 p-3">
            <div className="text-xs opacity-80">내 점수</div>
            <div className="text-2xl font-bold">{participant.total_score}점</div>
          </div>
        </header>

        {result === "correct" && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">🎉 정답입니다!</div>
        )}
        {result === "submitted" && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">✅ 제출 완료</div>
        )}
        {result === "pending" && (
          <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700">
            ⏳ 제출 완료 · 관리자 승인 대기
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
                    className={`block rounded-lg border bg-white p-4 ${
                      isDone ? "opacity-75" : "hover:border-violet-500"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span>{TEMPLATE_ICON[m.template_type] ?? ""}</span>
                          <span className="font-semibold">{m.title}</span>
                        </div>
                        <p className="mt-1 text-sm text-neutral-600">{m.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-semibold text-violet-600">{m.points}점</span>
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
          <div className="rounded-lg border bg-white p-12 text-center text-sm text-neutral-500">
            아직 등록된 미션이 없습니다
          </div>
        )}
      </div>
    </main>
  );
}
