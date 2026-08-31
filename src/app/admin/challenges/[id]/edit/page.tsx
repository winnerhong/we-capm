// 챌린지 수정 — 목록의 「수정」 이 여기로 온다.
//
// 이 화면이 없어서 목록의 수정 버튼이 404 로 떨어지고 있었다. 서버 액션
// (updateChallengeAction)은 진작 있었고 폼도 있었는데, 둘을 잇는 화면만
// 비어 있었다.
//
// 폼은 새로 만들기와 **같은 것**을 쓴다(challenge-form.tsx). 따로 두면 필드가
// 한쪽에만 추가되면서 갈라진다 — 행사 만들기/수정이 실제로 그렇게 갈라졌었다.

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";
import { ChallengeForm, type ChallengeInitial } from "../../challenge-form";

export const dynamic = "force-dynamic";

type ChallengeQuery = {
  select: (c: string) => {
    eq: (
      k: string,
      v: string
    ) => {
      maybeSingle: () => Promise<{
        data: ChallengeInitial | null;
        error: { message: string } | null;
      }>;
    };
  };
};

export default async function EditChallengePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  // challenges 는 아직 database.types.ts 에 없다 — actions.ts 와 같은 브릿지.
  const { data: challenge } = await (
    supabase as unknown as { from: (t: string) => ChallengeQuery }
  )
    .from("challenges")
    .select(
      "id, title, description, icon, goal_type, goal_value, reward_acorns, reward_badge, starts_at, ends_at, event_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (!challenge) notFound();

  const { data: events } = await supabase
    .from("events")
    .select("id, name")
    .order("start_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/challenges"
          className="text-sm font-medium text-[#2D5A3D] hover:underline"
        >
          ← 챌린지 목록
        </Link>
        <Link href="/admin" className="text-xs text-[#6B6560] hover:underline">
          대시보드
        </Link>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <span aria-hidden>{challenge.icon ?? "🎯"}</span>
          <span className="min-w-0 truncate">{challenge.title}</span>
        </h1>
        <p className="mt-1 text-sm text-white/80">
          목표와 보상을 고쳐요. 진행 상태(진행 중 · 종료)는 목록에서 바꿉니다.
        </p>
      </div>

      <ChallengeForm events={events ?? []} initial={challenge} />
    </div>
  );
}
