import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewChallengeForm } from "./new-challenge-form";

export const dynamic = "force-dynamic";

export default async function NewChallengePage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name")
    .order("start_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* 상단 네비 */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/challenges"
          className="text-sm text-[#2D5A3D] hover:underline font-medium"
        >
          ← 챌린지 목록
        </Link>
        <Link
          href="/admin"
          className="text-xs text-[#6B6560] hover:underline"
        >
          대시보드
        </Link>
      </div>

      {/* 포레스트 헤더 */}
      <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <span>🎯</span>
          <span>새 챌린지 만들기</span>
        </h1>
        <p className="mt-1 text-sm text-white/80">
          참가자가 함께 달성할 목표를 설정하고 도토리 보상을 걸어봐요
        </p>
      </div>

      <NewChallengeForm events={events ?? []} />
    </div>
  );
}
