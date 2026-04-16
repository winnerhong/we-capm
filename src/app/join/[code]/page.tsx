import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhoneEntry } from "./phone-entry";

export const dynamic = "force-dynamic";

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
          <p className="text-sm">QR 코드를 다시 확인해주세요</p>
        </div>
      </main>
    );
  }

  const { count: regCount } = await supabase
    .from("event_registrations")
    .select("*", { count: "exact", head: true })
    .eq("event_id", event.id);

  const hasRegistrations = (regCount ?? 0) > 0;

  if (hasRegistrations) {
    return (
      <PhoneEntry
        eventId={event.id}
        eventName={event.name}
        location={event.location}
        joinCode={code}
      />
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/join/${code}`);
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

  const { error } = await supabase.from("participants").insert({
    user_id: user.id,
    event_id: event.id,
    participation_type: event.participation_type === "TEAM" ? "TEAM" : "INDIVIDUAL",
  });

  if (error && !error.message.includes("duplicate")) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p className="text-sm text-red-600">{error.message}</p>
      </main>
    );
  }

  redirect(`/event/${event.id}`);
}
