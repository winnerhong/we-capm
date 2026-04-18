import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WinnerTalkIcon } from "@/components/winner-talk-icon";

export default async function AdminHome() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, status, start_at, location, manager_id")
    .order("start_at", { ascending: false })
    .limit(5);

  const active = events?.filter((e) => e.status === "ACTIVE").length ?? 0;
  const draft = events?.filter((e) => e.status === "DRAFT").length ?? 0;
  const ended = events?.filter((e) => e.status === "ENDED" || e.status === "CONFIRMED").length ?? 0;

  const statusMap: Record<string, { label: string; dot: string; bg: string }> = {
    DRAFT: { label: "준비중", dot: "bg-neutral-400", bg: "bg-neutral-100 text-neutral-600" },
    ACTIVE: { label: "진행중", dot: "bg-green-500", bg: "bg-green-100 text-green-700" },
    ENDED: { label: "종료", dot: "bg-yellow-500", bg: "bg-yellow-100 text-yellow-700" },
    CONFIRMED: { label: "확정", dot: "bg-blue-500", bg: "bg-blue-100 text-blue-700" },
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-purple-700 p-6 text-white">
        <h1 className="text-2xl font-bold">윙크 대시보드</h1>
        <p className="mt-1 text-sm opacity-80">행사 운영 현황을 한눈에 확인하세요</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-green-50 border border-green-200 p-4">
          <div className="text-xs font-medium text-green-600">진행 중</div>
          <div className="text-3xl font-bold text-green-700 mt-1">{active}</div>
        </div>
        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
          <div className="text-xs font-medium text-neutral-500">준비중</div>
          <div className="text-3xl font-bold text-neutral-700 mt-1">{draft}</div>
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
          <div className="text-xs font-medium text-blue-600">종료/확정</div>
          <div className="text-3xl font-bold text-blue-700 mt-1">{ended}</div>
        </div>
      </div>

      {/* 빠른 액션 */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/admin/events/new"
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 p-4 hover:border-violet-500 hover:shadow-md transition-all">
          <span className="text-2xl">➕</span>
          <span className="text-sm font-semibold text-violet-700">새 행사</span>
        </Link>
        <Link href="/admin/chat"
          className="flex flex-col items-center gap-2 rounded-xl border bg-white p-4 hover:border-violet-500 hover:shadow-md transition-all">
          <WinnerTalkIcon size={28} />
          <span className="text-sm font-semibold">윙크톡</span>
        </Link>
        <Link href="/admin/stats"
          className="flex flex-col items-center gap-2 rounded-xl border bg-white p-4 hover:border-violet-500 hover:shadow-md transition-all">
          <span className="text-2xl">📊</span>
          <span className="text-sm font-semibold">전체통계</span>
        </Link>
      </div>

      {/* 최근 행사 */}
      <section className="rounded-2xl border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">최근 행사</h2>
          <Link href="/admin/events" className="text-sm text-violet-600 hover:underline font-medium">
            전체 보기 →
          </Link>
        </div>
        {events && events.length > 0 ? (
          <div className="space-y-2">
            {events.map((e) => {
              const st = statusMap[e.status] ?? statusMap.DRAFT;
              return (
                <Link key={e.id} href={`/admin/events/${e.id}`}
                  className="flex items-center gap-3 rounded-xl p-3 hover:bg-neutral-50 transition-colors">
                  <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${st.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{e.name}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {e.location && `📍 ${e.location}`}
                      {e.manager_id && ` · 🏢 ${e.manager_id}`}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0 ${st.bg}`}>
                    {st.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center">
            <span className="text-4xl">🏕️</span>
            <p className="mt-3 text-sm text-neutral-500">
              행사가 없습니다.{" "}
              <Link href="/admin/events/new" className="text-violet-600 hover:underline font-medium">
                첫 행사 만들기 →
              </Link>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
