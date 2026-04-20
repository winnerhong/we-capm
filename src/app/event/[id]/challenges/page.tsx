import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { ChallengeCard } from "@/components/challenge-card";

export const dynamic = "force-dynamic";

const PAST_CHALLENGES = [
  { icon: "🌿", title: "지난주 챌린지", desc: "숲길 스탬프 5개 찍기", reward: "🌰 8", status: "완료" },
  { icon: "🍂", title: "2주 전 챌린지", desc: "토리톡 첫 인사 남기기", reward: "🌰 3", status: "완료" },
  { icon: "🌾", title: "3주 전 챌린지", desc: "함께한 사진 3장 올리기", reward: "🌰 5", status: "완료" },
];

export default async function ChallengesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getParticipant(id);
  if (!p) redirect("/join");

  const supabase = await createClient();
  const [eventRes, participantRes] = await Promise.all([
    supabase.from("events").select("id, name").eq("id", id).single(),
    supabase.from("participants").select("id").eq("event_id", id).eq("phone", p.phone).maybeSingle(),
  ]);
  if (!eventRes.data) notFound();

  let completedCount = 0;
  if (participantRes.data) {
    const { data: subs } = await supabase.from("submissions").select("mission_id")
      .eq("participant_id", participantRes.data.id).in("status", ["APPROVED", "AUTO_APPROVED", "PENDING"]);
    completedCount = subs?.length ?? 0;
  }

  return (
    <main className="min-h-dvh bg-[#FFF8F0] pb-24">
      <div className="bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] px-4 pt-6 pb-8 text-white">
        <Link href={`/event/${id}`} className="text-sm opacity-80">← 홈으로</Link>
        <h1 className="mt-3 text-2xl font-bold flex items-center gap-2">
          <span>🎯</span>
          <span>숲길 챌린지</span>
        </h1>
        <p className="mt-1 text-sm opacity-90">매주 새로운 목표로 도토리를 모아요</p>
      </div>

      <div className="mx-auto max-w-lg px-4 -mt-4 space-y-5">
        <section>
          <p className="text-xs font-bold text-[#2D5A3D] mb-2 tracking-wide">THIS WEEK</p>
          <ChallengeCard completedMissions={completedCount} />
        </section>

        <section>
          <p className="text-xs font-bold text-[#6B6560] mb-2 tracking-wide">지난 챌린지</p>
          <div className="grid gap-2">
            {PAST_CHALLENGES.map((c, i) => (
              <div key={i} className="rounded-2xl border border-[#E8E0D4] bg-white p-4 flex items-center gap-3 opacity-80">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F5E6D3] text-xl">{c.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#2C2C2C] text-sm">{c.title}</p>
                  <p className="text-xs text-[#6B6560] truncate">{c.desc}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-[#C4956A]">{c.reward}</p>
                  <p className="text-[10px] text-[#2D5A3D] mt-0.5">✓ {c.status}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white/60 p-5 text-center">
          <p className="text-sm text-[#2D5A3D] font-semibold">곧 더 많은 챌린지가 열려요 🌱</p>
          <p className="text-xs text-[#6B6560] mt-1">매주 월요일, 토리가 새 챌린지를 준비해요</p>
        </div>
      </div>
    </main>
  );
}
