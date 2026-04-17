import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addTeacherAction, removeTeacherAction } from "./actions";
import { TeacherCsvUpload } from "./teacher-csv";

export const dynamic = "force-dynamic";

export default async function StaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  const { data: teachers } = await supabase
    .from("event_registrations")
    .select("id, phone, name, status, created_at")
    .eq("event_id", id)
    .like("name", "[선생님]%")
    .order("created_at", { ascending: true });

  const total = teachers?.length ?? 0;
  const entered = (teachers ?? []).filter((t) => t.status === "ENTERED").length;

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/admin/events/${id}`} className="text-sm hover:underline">← {event.name}</Link>
        <h1 className="text-2xl font-bold">선생님 관리</h1>
        <p className="text-sm">등록: {total}명 | 입장: {entered}명</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form action={addTeacherAction.bind(null, id)} className="space-y-3 rounded-lg border bg-white p-4">
          <h2 className="font-semibold">수동 추가</h2>
          <input name="name" type="text" required placeholder="이름 (예: 김선생)"
            className="w-full rounded-lg border px-3 py-2" />
          <input name="phone" type="tel" required placeholder="전화번호 (01012345678)"
            className="w-full rounded-lg border px-3 py-2" />
          <button type="submit" className="w-full rounded-lg bg-violet-600 py-2 font-semibold text-white hover:bg-violet-700">추가</button>
        </form>

        <TeacherCsvUpload eventId={id} />
      </div>

      {total > 0 ? (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">이름</th>
                <th className="px-4 py-2">전화번호</th>
                <th className="px-4 py-2">상태</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(teachers ?? []).map((t, i) => {
                const displayName = t.name.replace("[선생님] ", "");
                return (
                  <tr key={t.id}>
                    <td className="px-4 py-2">{i + 1}</td>
                    <td className="px-4 py-2 font-medium">{displayName}</td>
                    <td className="px-4 py-2 font-mono text-xs">{t.phone}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${t.status === "ENTERED" ? "bg-green-100 text-green-700" : "bg-neutral-100"}`}>
                        {t.status === "ENTERED" ? "입장" : "미입장"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <form action={async () => { "use server"; await removeTeacherAction(id, t.id); }}>
                        <button className="text-xs text-red-600 hover:underline">삭제</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-8 text-center text-sm">등록된 선생님이 없습니다</div>
      )}
    </div>
  );
}
