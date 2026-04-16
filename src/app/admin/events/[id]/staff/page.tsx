import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addStaffAction, removeStaffAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function StaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  const { data: staffList } = await supabase
    .from("event_staff")
    .select("id, user_id, added_at")
    .eq("event_id", id);

  const userIds = (staffList ?? []).map((s) => s.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, name").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/admin/events/${id}`} className="text-sm hover:underline">← {event.name}</Link>
        <h1 className="text-2xl font-bold">스태프 배정</h1>
      </div>

      <form action={addStaffAction.bind(null, id)} className="flex gap-2">
        <input
          name="phone"
          type="tel"
          required
          placeholder="스태프 전화번호 (01012345678)"
          className="flex-1 rounded-lg border px-3 py-2"
        />
        <button type="submit" className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700">
          추가
        </button>
      </form>

      {staffList && staffList.length > 0 ? (
        <ul className="space-y-2">
          {staffList.map((s) => {
            const profile = profileMap.get(s.user_id);
            return (
              <li key={s.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
                <div>
                  <div className="font-medium">{profile?.name ?? "?"}</div>
                  <div className="text-xs">{new Date(s.added_at).toLocaleString("ko-KR")}</div>
                </div>
                <form action={async () => { "use server"; await removeStaffAction(id, s.id); }}>
                  <button className="text-xs text-red-600 hover:underline">제거</button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-lg border bg-white p-8 text-center text-sm">배정된 스태프가 없습니다</div>
      )}
    </div>
  );
}
