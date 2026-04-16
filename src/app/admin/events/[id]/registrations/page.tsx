import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addRegistrationAction, deleteRegistrationAction } from "./actions";
import { CsvUploadForm } from "./csv-upload";

export const dynamic = "force-dynamic";

export default async function RegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  const { data: registrations } = await supabase
    .from("event_registrations")
    .select("id, phone, name, status, entered_at, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  const entered = (registrations ?? []).filter((r) => r.status === "ENTERED").length;
  const total = registrations?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/admin/events/${id}`} className="text-sm hover:underline">
            ← {event.name}
          </Link>
          <h1 className="text-2xl font-bold">참가자 등록</h1>
          <p className="text-sm">등록: {total}명 | 입장: {entered}명 | 미입장: {total - entered}명</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form
          action={addRegistrationAction.bind(null, id)}
          className="space-y-3 rounded-lg border bg-white p-4"
        >
          <h2 className="font-semibold">수동 추가</h2>
          <input
            name="name"
            type="text"
            required
            placeholder="이름 (예: 홍길동)"
            className="w-full rounded-lg border px-3 py-2"
          />
          <input
            name="phone"
            type="tel"
            required
            placeholder="전화번호 (예: 01012345678)"
            className="w-full rounded-lg border px-3 py-2"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-600 py-2 font-semibold text-white hover:bg-violet-700"
          >
            추가
          </button>
        </form>

        <CsvUploadForm eventId={id} />
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
                <th className="px-4 py-2">입장 시각</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(registrations ?? []).map((r, i) => (
                <tr key={r.id}>
                  <td className="px-4 py-2">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.phone}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.status === "ENTERED"
                          ? "bg-green-100 text-green-700"
                          : "bg-neutral-100"
                      }`}
                    >
                      {r.status === "ENTERED" ? "입장완료" : "미입장"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {r.entered_at ? new Date(r.entered_at).toLocaleString("ko-KR") : "-"}
                  </td>
                  <td className="px-4 py-2">
                    <form
                      action={async () => {
                        "use server";
                        await deleteRegistrationAction(id, r.id);
                      }}
                    >
                      <button className="text-xs text-red-600 hover:underline">삭제</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-12 text-center text-sm">
          아직 등록된 참가자가 없습니다
        </div>
      )}
    </div>
  );
}
