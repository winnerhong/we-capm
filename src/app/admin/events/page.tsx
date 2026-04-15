import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "초안",
  ACTIVE: "진행 중",
  ENDED: "종료",
  CONFIRMED: "확정",
  ARCHIVED: "보관",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-700",
  ACTIVE: "bg-green-100 text-green-700",
  ENDED: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-neutral-100 text-neutral-500",
};

export default async function EventsListPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, status, start_at, end_at, location")
    .order("start_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">행사 목록</h1>
        <Link
          href="/admin/events/new"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          + 새 행사
        </Link>
      </div>

      {events && events.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {events.map((e) => (
            <Link
              key={e.id}
              href={`/admin/events/${e.id}`}
              className="rounded-lg border bg-white p-4 hover:border-violet-500"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{e.name}</div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[e.status] ?? ""}`}>
                  {STATUS_LABEL[e.status] ?? e.status}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-sm text-neutral-600">
                <div>📍 {e.location}</div>
                <div>🗓 {new Date(e.start_at).toLocaleString("ko-KR")}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-12 text-center text-neutral-500">
          아직 등록된 행사가 없습니다
        </div>
      )}
    </div>
  );
}
