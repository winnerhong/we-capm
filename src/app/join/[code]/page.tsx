import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, status, start_at, location, participation_type")
    .eq("join_code", code)
    .single();

  if (!event) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-2 text-center">
          <h1 className="text-xl font-bold">유효하지 않은 입장 코드</h1>
          <p className="text-sm text-neutral-600">QR 코드를 다시 확인해주세요</p>
        </div>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${code}`)}`);
  }

  const { data: existing } = await supabase
    .from("participants")
    .select("id")
    .eq("event_id", event.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    redirect(`/event/${event.id}`);
  }

  const defaultParticipationType = event.participation_type === "TEAM" ? "TEAM" : "INDIVIDUAL";

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-sm text-neutral-500">행사 입장</p>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-sm text-neutral-600">📍 {event.location}</p>
          <p className="text-sm text-neutral-600">
            🗓 {new Date(event.start_at).toLocaleString("ko-KR")}
          </p>
        </div>

        <form action={`/join/${code}/confirm`} method="post" className="space-y-3">
          <input type="hidden" name="participation_type" value={defaultParticipationType} />
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700"
          >
            입장하기
          </button>
        </form>

        <Link href="/" className="block text-center text-sm text-neutral-500 hover:underline">
          홈으로
        </Link>
      </div>
    </main>
  );
}
