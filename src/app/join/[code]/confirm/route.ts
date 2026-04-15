import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ParticipationType } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/login?next=/join/${code}`, request.url));
  }

  const { data: event } = await supabase.from("events").select("id").eq("join_code", code).single();
  if (!event) return new NextResponse("Not Found", { status: 404 });

  const form = await request.formData();
  const participation_type = (form.get("participation_type") ?? "INDIVIDUAL") as ParticipationType;

  const { error } = await supabase.from("participants").insert({
    user_id: user.id,
    event_id: event.id,
    participation_type,
  });

  if (error && !error.message.includes("duplicate")) {
    return new NextResponse(error.message, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/event/${event.id}`, request.url));
}
