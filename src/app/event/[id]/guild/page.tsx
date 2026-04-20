import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";

export const dynamic = "force-dynamic";

export default async function GuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getParticipant(id);
  if (!p) redirect("/join");

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  return (
    <main className="min-h-dvh bg-[#FFF8F0] pb-24">
      <div className="bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] px-4 pt-6 pb-8 text-white">
        <Link href={`/event/${id}`} className="text-sm opacity-80">← 홈으로</Link>
        <h1 className="mt-3 text-2xl font-bold flex items-center gap-2">
          <span>🏡</span>
          <span>숲 패밀리</span>
        </h1>
        <p className="mt-1 text-sm opacity-90">같은 숲길을 걷는 다람이가족과 함께</p>
      </div>

      <div className="mx-auto max-w-lg px-4 -mt-4 space-y-4">
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-6 text-center">
          <div className="text-5xl mb-3">🌳</div>
          <h2 className="text-lg font-bold text-[#2D5A3D]">곧 열리는 기능이에요</h2>
          <p className="text-sm text-[#6B6560] mt-2">같은 관심사를 가진 다람이가족이 모여<br/>함께 숲길을 걷고 도토리를 모아요</p>
        </div>

        <div className="grid gap-3">
          {[
            { icon: "🌰", title: "도토리 합산", desc: "우리 패밀리 총 도토리로 랭킹에 도전" },
            { icon: "💬", title: "패밀리 전용 토리톡", desc: "우리끼리만의 숲 이야기 공간" },
            { icon: "🎯", title: "패밀리 챌린지", desc: "함께 목표를 세우고 달성해요" },
            { icon: "🏆", title: "길드 명예의 전당", desc: "전국 숲 패밀리 TOP 10" },
          ].map((f, i) => (
            <div key={i} className="rounded-2xl border border-[#D4E4BC] bg-white p-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F0E4] text-2xl">{f.icon}</div>
              <div>
                <p className="font-semibold text-[#2C2C2C]">{f.title}</p>
                <p className="text-xs text-[#6B6560] mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
