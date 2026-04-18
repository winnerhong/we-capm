import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import type { StampTierConfig } from "@/lib/supabase/database.types";
import { StampQRModal } from "./stamp-qr";

export const dynamic = "force-dynamic";

const CONGESTION_ICON: Record<string, string> = {
  GREEN: "\uD83D\uDFE2",
  YELLOW: "\uD83D\uDFE1",
  RED: "\uD83D\uDD34",
};
const CONGESTION_LABEL: Record<string, string> = {
  GREEN: "\uC5EC\uC720",
  YELLOW: "\uBCF4\uD1B5",
  RED: "\uD63C\uC7A1",
};

function getCurrentTier(
  stampCount: number,
  config: StampTierConfig
): { tier: string; label: string; emoji: string; goalCount: number } | null {
  if (stampCount >= config.keeper.goal_count) {
    return { tier: "keeper", label: config.keeper.label, emoji: config.keeper.emoji, goalCount: config.keeper.goal_count };
  }
  if (stampCount >= config.explorer.goal_count) {
    return { tier: "explorer", label: config.explorer.label, emoji: config.explorer.emoji, goalCount: config.explorer.goal_count };
  }
  if (stampCount >= config.sprout.goal_count) {
    return { tier: "sprout", label: config.sprout.label, emoji: config.sprout.emoji, goalCount: config.sprout.goal_count };
  }
  return null;
}

function getNextTier(
  stampCount: number,
  config: StampTierConfig
): { label: string; emoji: string; goalCount: number; remaining: number } | null {
  const tiers = [
    { ...config.sprout, key: "sprout" },
    { ...config.explorer, key: "explorer" },
    { ...config.keeper, key: "keeper" },
  ];
  for (const t of tiers) {
    if (stampCount < t.goal_count) {
      return { label: t.label, emoji: t.emoji, goalCount: t.goal_count, remaining: t.goal_count - stampCount };
    }
  }
  return null;
}

export default async function EventStampsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getParticipant(id);
  if (!p) redirect("/join");

  const supabase = await createClient();

  const [eventRes, boardRes, participantRes] = await Promise.all([
    supabase.from("events").select("id, name, status").eq("id", id).single(),
    supabase.from("stamp_boards").select("*").eq("event_id", id).eq("is_active", true).maybeSingle(),
    supabase.from("participants").select("id, total_score, phone").eq("event_id", id).eq("phone", p.phone).maybeSingle(),
  ]);

  const event = eventRes.data;
  if (!event) notFound();

  const board = boardRes.data;
  const participant = participantRes.data;

  // No stamp board
  if (!board) {
    return (
      <main className="min-h-dvh bg-neutral-50 p-4 pb-24">
        <div className="mx-auto max-w-lg">
          <div className="rounded-2xl border bg-white p-12 text-center">
            <div className="text-5xl mb-4">🎫</div>
            <h2 className="text-lg font-bold text-neutral-700">아직 스탬프 보드가 없습니다</h2>
            <p className="mt-2 text-sm text-neutral-500">행사 관리자가 스탬프 랠리를 준비 중이에요</p>
          </div>
        </div>
      </main>
    );
  }

  const tierConfig = board.tier_config as unknown as StampTierConfig;

  // Get slots and records
  const { data: slots } = await supabase
    .from("stamp_slots")
    .select("id, name, icon, description, location_hint, congestion_status, order, type")
    .eq("board_id", board.id)
    .eq("is_active", true)
    .order("order", { ascending: true });

  let stampedSlotIds = new Set<string>();
  if (participant) {
    const slotIds = (slots ?? []).map((s) => s.id);
    if (slotIds.length > 0) {
      const { data: records } = await supabase
        .from("stamp_records")
        .select("slot_id")
        .eq("participant_id", participant.id)
        .in("slot_id", slotIds);
      stampedSlotIds = new Set((records ?? []).map((r) => r.slot_id));
    }
  }

  const stampCount = stampedSlotIds.size;
  const totalSlots = (slots ?? []).length;
  const currentTier = getCurrentTier(stampCount, tierConfig);
  const nextTier = getNextTier(stampCount, tierConfig);
  const progress = totalSlots > 0 ? Math.round((stampCount / totalSlots) * 100) : 0;

  // Tier indicators
  const tierList = [
    { key: "sprout", ...tierConfig.sprout },
    { key: "explorer", ...tierConfig.explorer },
    { key: "keeper", ...tierConfig.keeper },
  ];

  // Recommended route: unstamped slots sorted by congestion (GREEN first)
  const congestionOrder: Record<string, number> = { GREEN: 0, YELLOW: 1, RED: 2 };
  const unstampedSlots = (slots ?? [])
    .filter((s) => !stampedSlotIds.has(s.id))
    .sort((a, b) => (congestionOrder[a.congestion_status] ?? 1) - (congestionOrder[b.congestion_status] ?? 1));

  return (
    <main className="min-h-dvh bg-neutral-50 pb-28">
      <RealtimeRefresh table="stamp_records" />
      <RealtimeRefresh table="stamp_slots" />

      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 px-4 pt-4 pb-6 text-white">
        <h1 className="text-xl font-bold">🎫 {board.name}</h1>
        {board.description && <p className="mt-1 text-sm opacity-80">{board.description}</p>}

        <div className="mt-4 flex items-center gap-3">
          {/* Current tier badge */}
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl">
            {currentTier ? currentTier.emoji : "🌰"}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">
                {currentTier ? currentTier.label : "도전 시작!"}
              </span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {stampCount}/{totalSlots}
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            {nextTier && (
              <p className="mt-1 text-xs opacity-80">
                다음 등급 {nextTier.emoji}{nextTier.label}까지 {nextTier.remaining}개 남음
              </p>
            )}
            {!nextTier && stampCount > 0 && (
              <p className="mt-1 text-xs opacity-80">모든 등급을 달성했어요!</p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 -mt-2">

        {/* Tier indicators */}
        <div className="flex gap-2">
          {tierList.map((t) => {
            const achieved = stampCount >= t.goal_count;
            return (
              <div
                key={t.key}
                className={`flex-1 rounded-xl border-2 p-3 text-center transition-all ${
                  achieved
                    ? "border-violet-400 bg-violet-50"
                    : "border-neutral-200 bg-white opacity-60"
                }`}
              >
                <div className="text-2xl">{t.emoji}</div>
                <div className={`text-xs font-bold mt-1 ${achieved ? "text-violet-700" : "text-neutral-400"}`}>
                  {t.label}
                </div>
                <div className={`text-[10px] mt-0.5 ${achieved ? "text-violet-500" : "text-neutral-400"}`}>
                  {achieved ? "달성!" : `${t.goal_count}개`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Stamp grid */}
        <section>
          <h2 className="mb-2 text-sm font-bold text-neutral-700">스탬프 현황</h2>
          <div className="grid grid-cols-2 gap-3">
            {(slots ?? []).map((slot) => {
              const stamped = stampedSlotIds.has(slot.id);
              const congestion = slot.congestion_status ?? "GREEN";
              return (
                <div
                  key={slot.id}
                  className={`relative rounded-2xl border-2 p-4 transition-all ${
                    stamped
                      ? "border-green-300 bg-green-50"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="text-2xl">{slot.icon || "📍"}</div>
                    <div className="flex items-center gap-1">
                      {!stamped && (
                        <span className="text-xs" title={CONGESTION_LABEL[congestion]}>
                          {CONGESTION_ICON[congestion]}
                        </span>
                      )}
                      <span className={`text-lg ${stamped ? "text-green-500" : "text-neutral-300"}`}>
                        {stamped ? "\u2705" : "\u25CB"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className={`font-semibold text-sm ${stamped ? "text-green-700" : "text-neutral-800"}`}>
                      {slot.name}
                    </div>
                    {slot.location_hint && (
                      <p className="text-[11px] text-neutral-400 mt-0.5">{slot.location_hint}</p>
                    )}
                  </div>
                  {stamped && (
                    <div className="absolute top-2 right-2 rounded-full bg-green-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      완료
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Recommended route */}
        {unstampedSlots.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-bold text-neutral-700">추천 코스</h2>
            <div className="rounded-2xl border bg-white p-4">
              <p className="text-xs text-neutral-500 mb-3">혼잡도가 낮은 순서로 추천해드려요</p>
              <div className="space-y-2">
                {unstampedSlots.slice(0, 4).map((slot, i) => {
                  const congestion = slot.congestion_status ?? "GREEN";
                  return (
                    <div key={slot.id} className="flex items-center gap-3 rounded-lg bg-neutral-50 p-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                        {i + 1}
                      </span>
                      <span className="text-sm">{slot.icon || "📍"}</span>
                      <span className="flex-1 text-sm font-medium">{slot.name}</span>
                      <span className="flex items-center gap-1 text-xs text-neutral-500">
                        {CONGESTION_ICON[congestion]} {CONGESTION_LABEL[congestion]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* All stamps collected */}
        {stampCount === totalSlots && totalSlots > 0 && (
          <div className="rounded-2xl border-2 border-yellow-300 bg-gradient-to-r from-yellow-50 to-orange-50 p-6 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <h3 className="text-lg font-bold text-yellow-800">모든 도장을 모았어요!</h3>
            <p className="mt-1 text-sm text-yellow-700">스탬프 랠리를 완주했습니다</p>
          </div>
        )}
      </div>

      {/* Bottom sticky QR button */}
      {participant && stampCount < totalSlots && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
          <div className="mx-auto max-w-lg">
            <StampQRModal
              participantId={participant.id}
              eventId={id}
              participantName={p.name}
              stampCount={stampCount}
              currentTier={currentTier?.label ?? "도전자"}
            />
          </div>
        </div>
      )}
    </main>
  );
}
