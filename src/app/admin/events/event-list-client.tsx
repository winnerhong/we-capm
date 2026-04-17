"use client";

import { useState } from "react";
import Link from "next/link";

interface EventItem {
  id: string; name: string; status: string; start_at: string; end_at: string;
  location: string; manager_id: string | null; join_code: string;
  regCount: number; participantCount: number; pendingCount: number;
}

const STATUS_LABEL: Record<string, string> = { DRAFT: "초안", ACTIVE: "진행 중", ENDED: "종료", CONFIRMED: "확정", ARCHIVED: "보관" };
const STATUS_DOT: Record<string, string> = { DRAFT: "bg-neutral-400", ACTIVE: "bg-green-500", ENDED: "bg-yellow-500", CONFIRMED: "bg-blue-500", ARCHIVED: "bg-neutral-400" };
const STATUS_BORDER: Record<string, string> = { ACTIVE: "border-l-green-500", ENDED: "border-l-yellow-500", CONFIRMED: "border-l-blue-500" };

export function EventListClient({ events }: { events: EventItem[] }) {
  const [view, setView] = useState<"card" | "list">("card");
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const filtered = events.filter((e) => {
    if (filter !== "ALL" && e.status !== filter) return false;
    if (search && !e.name.includes(search) && !e.manager_id?.includes(search) && !e.location.includes(search)) return false;
    return true;
  });

  const counts = {
    ALL: events.length,
    ACTIVE: events.filter((e) => e.status === "ACTIVE").length,
    DRAFT: events.filter((e) => e.status === "DRAFT").length,
    ENDED: events.filter((e) => e.status === "ENDED" || e.status === "CONFIRMED").length,
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">행사 목록</h1>
        <Link href="/admin/events/new"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
          + 새 행사
        </Link>
      </div>

      {/* 필터 + 검색 + 뷰 토글 */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "ALL", label: `전체 ${counts.ALL}` },
          { key: "ACTIVE", label: `진행 중 ${counts.ACTIVE}` },
          { key: "DRAFT", label: `초안 ${counts.DRAFT}` },
          { key: "ENDED", label: `종료 ${counts.ENDED}` },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === f.key ? "bg-violet-600 text-white" : "bg-white border"}`}>
            {f.label}
          </button>
        ))}
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 행사/기관 검색" className="ml-auto rounded-lg border px-3 py-1 text-sm outline-none w-48 focus:ring-2 focus:ring-violet-500" />
        <div className="flex rounded-lg border overflow-hidden">
          <button onClick={() => setView("card")}
            className={`px-3 py-1 text-xs ${view === "card" ? "bg-violet-600 text-white" : "bg-white"}`}>카드</button>
          <button onClick={() => setView("list")}
            className={`px-3 py-1 text-xs ${view === "list" ? "bg-violet-600 text-white" : "bg-white"}`}>리스트</button>
        </div>
      </div>

      {/* 카드뷰 */}
      {view === "card" && (
        filtered.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => {
              const pct = e.regCount > 0 ? Math.round((e.participantCount / e.regCount) * 100) : 0;
              return (
                <Link key={e.id} href={`/admin/events/${e.id}`}
                  className={`rounded-xl border-l-4 border bg-white p-4 hover:shadow-md ${STATUS_BORDER[e.status] ?? "border-l-neutral-300"}`}>
                  <div className="flex items-start justify-between">
                    <div className="font-bold">{e.name}</div>
                    <div className="flex items-center gap-1">
                      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[e.status] ?? ""}`} />
                      <span className="text-xs">{STATUS_LABEL[e.status] ?? e.status}</span>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div>📍 {e.location}</div>
                    <div>🗓 {new Date(e.start_at).toLocaleDateString("ko-KR")} {new Date(e.start_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</div>
                    {e.manager_id && <div>🏢 {e.manager_id}</div>}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span>참가 {e.participantCount}/{e.regCount}</span>
                    {e.pendingCount > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-600">대기 {e.pendingCount}</span>}
                  </div>
                  {e.regCount > 0 && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                      <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border bg-white p-12 text-center text-sm">검색 결과 없음</div>
        )
      )}

      {/* 리스트뷰 */}
      {view === "list" && (
        filtered.length > 0 ? (
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs">
                <tr>
                  <th className="px-4 py-2 w-8">상태</th>
                  <th className="px-4 py-2">행사명</th>
                  <th className="px-4 py-2">기관</th>
                  <th className="px-4 py-2">일시</th>
                  <th className="px-4 py-2">장소</th>
                  <th className="px-4 py-2 text-right">참가</th>
                  <th className="px-4 py-2 text-right">대기</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-neutral-50 cursor-pointer" onClick={() => window.location.href = `/admin/events/${e.id}`}>
                    <td className="px-4 py-3"><span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[e.status] ?? ""}`} /></td>
                    <td className="px-4 py-3 font-medium">{e.name}</td>
                    <td className="px-4 py-3 text-xs">{e.manager_id ?? "-"}</td>
                    <td className="px-4 py-3 text-xs">{new Date(e.start_at).toLocaleDateString("ko-KR")}</td>
                    <td className="px-4 py-3 text-xs">{e.location}</td>
                    <td className="px-4 py-3 text-right text-xs">{e.participantCount}/{e.regCount}</td>
                    <td className="px-4 py-3 text-right">
                      {e.pendingCount > 0 ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">{e.pendingCount}</span> : <span className="text-xs">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border bg-white p-12 text-center text-sm">검색 결과 없음</div>
        )
      )}
    </div>
  );
}
