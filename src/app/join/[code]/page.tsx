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

  return (
    <PhoneEntry
      eventId={event.id}
      eventName={event.name}
      location={event.location}
      joinCode={code}
    />
  );
}
