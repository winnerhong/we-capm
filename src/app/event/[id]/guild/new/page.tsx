import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { createGuildAction } from "../actions";
import NewGuildForm from "./NewGuildForm";

export const dynamic = "force-dynamic";

export default async function NewGuildPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getParticipant(id);
  if (!p) redirect("/join");

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  return (
    <main className="min-h-dvh bg-[#FFF8F0] pb-24">
      <div className="bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] px-4 pt-6 pb-10 text-white">
        <Link href={`/event/${id}/guild`} className="text-sm opacity-80">
          ← 뒤로
        </Link>
        <h1 className="mt-3 text-2xl font-bold flex items-center gap-2">
          <span>🌱</span>
          <span>새 숲 패밀리 만들기</span>
        </h1>
        <p className="mt-1 text-sm opacity-90">함께 걸을 다람이가족을 모아보세요</p>
      </div>

      <div className="mx-auto max-w-lg px-4 -mt-6">
        <NewGuildForm
          eventId={id}
          action={createGuildAction.bind(null, id)}
          leaderName={p.name}
        />
      </div>
    </main>
  );
}
