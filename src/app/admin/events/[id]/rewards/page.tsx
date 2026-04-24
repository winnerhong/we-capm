import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteRewardAction, drawLotteryAction } from "./actions";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

const TYPE_ICON: Record<string, string> = {
  POINT: "🏅", RANK: "🏆", BADGE: "🎖️", LOTTERY: "🎰", INSTANT: "⚡",
};
const TYPE_LABEL: Record<string, string> = {
  POINT: "도토리 누적", RANK: "숲지기 순위", BADGE: "뱃지", LOTTERY: "추첨", INSTANT: "즉시",
};

export default async function RewardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name, status").eq("id", id).single();
  if (!event) notFound();

  const { data: rewards } = await supabase
    .from("rewards")
    .select("id, name, description, reward_type, config, quantity, is_active")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  // 보상별 claim 현황
  const rewardIds = (rewards ?? []).map((r) => r.id);
  const { data: allClaims } = rewardIds.length
    ? await supabase.from("reward_claims").select("id, reward_id, status").in("reward_id", rewardIds)
    : { data: [] };

  const statsByReward = new Map<string, { earned: number; claimed: number }>();
  for (const c of allClaims ?? []) {
    const st = statsByReward.get(c.reward_id) ?? { earned: 0, claimed: 0 };
    if (c.status === "EARNED") st.earned++;
    if (c.status === "CLAIMED") st.claimed++;
    statsByReward.set(c.reward_id, st);
  }

  const totalEarned = (allClaims ?? []).filter((c) => c.status === "EARNED").length;
  const totalClaimed = (allClaims ?? []).filter((c) => c.status === "CLAIMED").length;

  return (
    <div className="space-y-4">
      <RealtimeRefresh table="reward_claims" />

      <div>
        <Link href={`/admin/events/${id}`} className="text-sm text-[#2D5A3D] hover:underline">← {event.name}</Link>
        <div className="mt-2 flex items-center justify-between rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <span>🎁</span>
              <span>도토리 보상 관리</span>
            </h1>
            <p className="mt-1 text-sm text-white/80">탐험가들에게 전할 숲의 선물을 준비해요</p>
          </div>
          <div className="flex gap-2">
            <a href={`/api/export/rewards?event_id=${id}`} download
              className="rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white hover:bg-white/20">📥 CSV 다운로드</a>
            <Link href={`/admin/events/${id}/claim`}
              className="rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white hover:bg-white/20">🎫 수령처리</Link>
            <Link href={`/admin/events/${id}/rewards/new`}
              className="rounded-xl bg-white/95 px-4 py-2 text-sm font-semibold text-[#2D5A3D] hover:bg-white shadow-sm">+ 새 보상</Link>
          </div>
        </div>
      </div>

      {/* 현황 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-[#E8F0E4] border border-[#D4E4BC] p-4 text-center">
          <div className="text-2xl font-bold text-[#2D5A3D]">{(rewards ?? []).length}</div>
          <div className="text-xs text-[#2D5A3D]">🎁 총 보상</div>
        </div>
        <div className="rounded-2xl bg-[#FFF8F0] border border-[#C4956A]/40 p-4 text-center">
          <div className="text-2xl font-bold text-[#C4956A]">{totalEarned}</div>
          <div className="text-xs text-[#8B6F47] inline-flex items-center gap-1"><AcornIcon /> 미수령</div>
        </div>
        <div className="rounded-2xl bg-[#D4E4BC] border border-[#A8C686] p-4 text-center">
          <div className="text-2xl font-bold text-[#2D5A3D]">{totalClaimed}</div>
          <div className="text-xs text-[#2D5A3D]">🌳 수령 완료</div>
        </div>
      </div>

      {/* 보상 목록 */}
      {rewards && rewards.length > 0 ? (
        <div className="space-y-3">
          {rewards.map((r) => {
            const st = statsByReward.get(r.id) ?? { earned: 0, claimed: 0 };
            const config = (r.config ?? {}) as Record<string, number>;
            const total = st.earned + st.claimed;
            const claimRate = total > 0 ? Math.round((st.claimed / total) * 100) : 0;

            return (
              <div key={r.id} className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F0E4] text-xl">
                      {TYPE_ICON[r.reward_type] ?? "🎁"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#2C2C2C]">{r.name}</span>
                        <span className="rounded-full bg-[#FFF8F0] border border-[#D4E4BC] px-2 py-0.5 text-[10px] text-[#2D5A3D]">
                          {TYPE_LABEL[r.reward_type]}
                        </span>
                      </div>
                      {r.description && <p className="text-xs text-[#6B6560] mt-0.5">{r.description}</p>}
                      <p className="text-xs text-[#6B6560] mt-1 inline-flex items-center gap-1 flex-wrap">
                        {r.reward_type === "POINT" && (
                          <>
                            <AcornIcon /> {config.threshold}개 이상
                          </>
                        )}
                        {r.reward_type === "RANK" && `${config.rankFrom}~${config.rankTo}등`}
                        {r.reward_type === "LOTTERY" && (
                          <>
                            <AcornIcon /> {config.minScore}개 이상 · {config.winners}명 추첨
                          </>
                        )}
                        {r.reward_type === "BADGE" && `숲길 걸음 완료 시`}
                        {r.reward_type === "INSTANT" && `숲길 승인 즉시`}
                        {r.quantity ? ` · 한정 ${r.quantity}개` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {r.reward_type === "LOTTERY" && (
                      <form action={async () => { "use server"; await drawLotteryAction(id, r.id); }}>
                        <button className="rounded-lg border border-[#C4956A] bg-[#FFF8F0] px-2.5 py-1.5 text-xs font-semibold text-[#8B6F47] hover:bg-[#D4E4BC]">
                          🎲 추첨
                        </button>
                      </form>
                    )}
                    <form action={async () => { "use server"; await deleteRewardAction(id, r.id); }}>
                      <button className="rounded-lg border border-red-200 px-2 py-1.5 text-xs text-red-500 hover:bg-red-50">삭제</button>
                    </form>
                  </div>
                </div>

                {/* 수령 현황 바 */}
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-2 overflow-hidden rounded-full bg-[#FFF8F0]">
                    <div className="h-full rounded-full bg-[#4A7C59] transition-all" style={{ width: `${claimRate}%` }} />
                  </div>
                  <span className="text-[11px] text-[#6B6560] whitespace-nowrap">
                    {st.claimed}/{total}명 수령 ({claimRate}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-12 text-center">
          <div className="mb-3 flex justify-center"><AcornIcon size={40} /></div>
          <p className="text-[#6B6560]">아직 준비된 보상이 없어요</p>
          <Link href={`/admin/events/${id}/rewards/new`}
            className="mt-3 inline-block rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1F4229]">
            첫 보상 만들기
          </Link>
        </div>
      )}
    </div>
  );
}
