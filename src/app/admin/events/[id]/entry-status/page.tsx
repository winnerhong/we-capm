import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EntryRealtime } from "./entry-realtime";

export const dynamic = "force-dynamic";

export default async function EntryStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  const { data: regs } = await supabase
    .from("event_registrations")
    .select("id, name, phone, status, entered_at")
    .eq("event_id", id)
    .not("name", "like", "%선생님%")
    .order("entered_at", { ascending: false, nullsFirst: false });

  const { data: teachers } = await supabase
    .from("event_registrations")
    .select("id, name, phone, status, entered_at")
    .eq("event_id", id)
    .like("name", "%선생님%")
    .order("entered_at", { ascending: false, nullsFirst: false });

  const allRegs = regs ?? [];
  const allTeachers = teachers ?? [];
  const enteredRegs = allRegs.filter((r) => r.status === "ENTERED");
  const enteredTeachers = allTeachers.filter((t) => t.status === "ENTERED");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/admin/events/${id}`} className="text-sm hover:underline">← {event.name}</Link>
          <h1 className="text-2xl font-bold">실시간 입장 현황</h1>
        </div>
      </div>

      <EntryRealtime eventId={id} />

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{enteredRegs.length}</div>
          <div className="text-xs">참가자 입장</div>
        </div>
        <div className="rounded-xl bg-neutral-50 border p-4 text-center">
          <div className="text-3xl font-bold">{allRegs.length - enteredRegs.length}</div>
          <div className="text-xs">참가자 미입장</div>
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{enteredTeachers.length}</div>
          <div className="text-xs">선생님 입장</div>
        </div>
        <div className="rounded-xl bg-neutral-50 border p-4 text-center">
          <div className="text-3xl font-bold">{allTeachers.length - enteredTeachers.length}</div>
          <div className="text-xs">선생님 미입장</div>
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex justify-between text-sm mb-1">
          <span>전체 입장률</span>
          <span className="font-bold">
            {enteredRegs.length + enteredTeachers.length} / {allRegs.length + allTeachers.length}명
          </span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full bg-green-500 transition-all" style={{
            width: `${(allRegs.length + allTeachers.length) > 0
              ? ((enteredRegs.length + enteredTeachers.length) / (allRegs.length + allTeachers.length) * 100)
              : 0}%`
          }} />
        </div>
      </div>

      {/* 최근 입장 */}
      {enteredRegs.length + enteredTeachers.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-semibold">🟢 최근 입장</h2>
          <ul className="space-y-2 max-h-60 overflow-y-auto">
            {[...enteredRegs, ...enteredTeachers]
              .sort((a, b) => new Date(b.entered_at!).getTime() - new Date(a.entered_at!).getTime())
              .slice(0, 20)
              .map((r) => {
                const match = r.name.match(/^\[(.+?)\]\s*(.+)$/);
                const tag = match?.[1] ?? "";
                const displayName = match?.[2] ?? r.name;
                return (
                  <li key={r.id} className="flex items-center justify-between rounded-lg bg-green-50 p-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="font-medium">{displayName}</span>
                      {tag && <span className="rounded-full bg-white px-2 py-0.5 text-[10px]">{tag}</span>}
                    </div>
                    <span className="text-xs">
                      {r.entered_at ? new Date(r.entered_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {/* 미입장 명단 */}
      {(allRegs.length - enteredRegs.length + allTeachers.length - enteredTeachers.length) > 0 && (
        <details className="rounded-xl border bg-white">
          <summary className="cursor-pointer p-4 font-semibold">
            ⏳ 미입장 ({allRegs.length - enteredRegs.length + allTeachers.length - enteredTeachers.length}명)
          </summary>
          <ul className="divide-y px-4 pb-4">
            {[...allRegs, ...allTeachers]
              .filter((r) => r.status !== "ENTERED")
              .map((r) => {
                const match = r.name.match(/^\[(.+?)\]\s*(.+)$/);
                const displayName = match?.[2] ?? r.name;
                return (
                  <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{displayName}</span>
                    <span className="text-xs text-neutral-400">{r.phone}</span>
                  </li>
                );
              })}
          </ul>
        </details>
      )}
    </div>
  );
}
