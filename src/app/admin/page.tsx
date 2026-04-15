import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminHome() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, status, start_at")
    .order("start_at", { ascending: false })
    .limit(5);

  const active = events?.filter((e) => e.status === "ACTIVE").length ?? 0;
  const draft = events?.filter((e) => e.status === "DRAFT").length ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="진행 중" value={active} />
        <Stat label="초안" value={draft} />
        <Stat label="전체" value={events?.length ?? 0} />
      </div>

      <section className="rounded-lg border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">최근 행사</h2>
          <Link href="/admin/events" className="text-sm text-violet-600 hover:underline">
            전체 보기 →
          </Link>
        </div>
        {events && events.length > 0 ? (
          <ul className="divide-y">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/admin/events/${e.id}`}
                  className="flex items-center justify-between py-3 hover:bg-neutral-50"
                >
                  <span>{e.name}</span>
                  <span className="text-xs text-neutral-500">{e.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-8 text-center text-sm text-neutral-500">
            행사가 없습니다.{" "}
            <Link href="/admin/events/new" className="text-violet-600 hover:underline">
              첫 행사 만들기 →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
