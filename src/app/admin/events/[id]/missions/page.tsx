import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteMissionAction, toggleMissionActiveAction } from "./actions";

export const dynamic = "force-dynamic";

const TEMPLATE_LABEL: Record<string, string> = {
  PHOTO: "📸 사진",
  VIDEO: "🎥 영상",
  LOCATION: "📍 위치",
  QUIZ: "✍️ 퀴즈",
  MIXED: "🎯 복합",
  TEAM: "🤝 팀 협력",
  TIMEATTACK: "🏃 타임어택",
};

export default async function MissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  const { data: missions } = await supabase
    .from("missions")
    .select("id, title, template_type, points, order, is_active, auto_approve")
    .eq("event_id", id)
    .order("order", { ascending: true });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/admin/events/${id}`} className="text-sm text-neutral-500 hover:underline">
            ← {event.name}
          </Link>
          <h1 className="text-2xl font-bold">미션 관리</h1>
        </div>
        <Link
          href={`/admin/events/${id}/missions/new`}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          + 새 미션
        </Link>
      </div>

      {missions && missions.length > 0 ? (
        <ul className="space-y-2">
          {missions.map((m) => (
            <li
              key={m.id}
              className={`flex items-center justify-between rounded-lg border bg-white p-4 ${
                m.is_active ? "" : "opacity-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-neutral-400">#{m.order}</span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                  {TEMPLATE_LABEL[m.template_type] ?? m.template_type}
                </span>
                <span className="font-semibold">{m.title}</span>
                <span className="text-sm text-neutral-500">{m.points}점</span>
                {m.auto_approve && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    자동 승인
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/admin/events/${id}/missions/${m.id}`}
                  className="rounded border px-2 py-1 text-xs hover:bg-neutral-50"
                >
                  편집
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await toggleMissionActiveAction(id, m.id, !m.is_active);
                  }}
                >
                  <button
                    type="submit"
                    className="rounded border px-2 py-1 text-xs hover:bg-neutral-50"
                  >
                    {m.is_active ? "비활성" : "활성"}
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await deleteMissionAction(id, m.id);
                  }}
                >
                  <button
                    type="submit"
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border bg-white p-12 text-center text-neutral-500">
          아직 등록된 미션이 없습니다.{" "}
          <Link href={`/admin/events/${id}/missions/new`} className="text-violet-600 hover:underline">
            첫 미션 만들기 →
          </Link>
        </div>
      )}
    </div>
  );
}
