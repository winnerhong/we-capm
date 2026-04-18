import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import type { StampTierConfig } from "@/lib/supabase/database.types";
import {
  createStampBoardAction,
  updateStampBoardAction,
  addStampSlotAction,
  deleteSlotAction,
  deleteStampBoardAction,
} from "./actions";

export const dynamic = "force-dynamic";

const CONGESTION_ICON: Record<string, string> = { GREEN: "🟢", YELLOW: "🟡", RED: "🔴" };
const SLOT_TYPE_LABEL: Record<string, string> = { MANUAL: "수동", AUTO_MISSION: "미션연동", AUTO_ENTRY: "자동입장" };

export default async function AdminStampsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", id).single();
  if (!event) notFound();

  const { data: board } = await supabase
    .from("stamp_boards")
    .select("*")
    .eq("event_id", id)
    .eq("is_active", true)
    .maybeSingle();

  // No board - show creation form
  if (!board) {
    return (
      <div className="space-y-4">
        <div>
          <Link href={`/admin/events/${id}`} className="text-sm hover:underline">&larr; {event.name}</Link>
          <h1 className="text-2xl font-bold">🎫 스탬프 랠리 만들기</h1>
        </div>

        <form
          action={async (formData: FormData) => {
            "use server";
            await createStampBoardAction(id, formData);
          }}
          className="rounded-2xl border bg-white p-6 space-y-4 max-w-lg"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-semibold mb-1">보드 이름</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue="스탬프 랠리"
              className="w-full rounded-xl border-2 px-4 py-3 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-semibold mb-1">설명 (선택)</label>
            <textarea
              id="description"
              name="description"
              rows={2}
              className="w-full rounded-xl border-2 px-4 py-3 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
              placeholder="스탬프를 모아 보상을 받아보세요!"
            />
          </div>
          <div>
            <label htmlFor="total_slots" className="block text-sm font-semibold mb-1">
              스테이션 수 (최소 3개)
            </label>
            <input
              id="total_slots"
              name="total_slots"
              type="number"
              inputMode="numeric"
              min={3}
              max={20}
              defaultValue={6}
              required
              className="w-full rounded-xl border-2 px-4 py-3 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
            <p className="text-xs text-neutral-400 mt-1">스테이션이 자동으로 생성됩니다. 나중에 이름/아이콘을 수정할 수 있습니다.</p>
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-violet-600 py-3 font-bold text-white hover:bg-violet-700 transition-colors"
          >
            스탬프 보드 만들기
          </button>
        </form>
      </div>
    );
  }

  // Board exists - show management view
  const tierConfig = board.tier_config as unknown as StampTierConfig;

  const { data: slots } = await supabase
    .from("stamp_slots")
    .select("id, name, icon, description, location_hint, type, congestion_status, staff_name, order, is_active")
    .eq("board_id", board.id)
    .order("order", { ascending: true });

  const activeSlots = (slots ?? []).filter((s) => s.is_active);
  const slotIds = activeSlots.map((s) => s.id);

  // Stats
  const { count: totalParticipants } = await supabase
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("event_id", id);

  // Get stamp records for all slots
  const { data: allRecords } = slotIds.length
    ? await supabase
        .from("stamp_records")
        .select("slot_id, participant_id")
        .in("slot_id", slotIds)
    : { data: [] };

  // Per-participant stamp count
  const participantStamps = new Map<string, number>();
  for (const r of allRecords ?? []) {
    participantStamps.set(r.participant_id, (participantStamps.get(r.participant_id) ?? 0) + 1);
  }

  // Per-slot stamp count
  const slotStampCounts = new Map<string, number>();
  for (const r of allRecords ?? []) {
    slotStampCounts.set(r.slot_id, (slotStampCounts.get(r.slot_id) ?? 0) + 1);
  }

  const totalP = totalParticipants ?? 0;
  const participantsWithStamps = participantStamps.size;
  const avgCompletion = participantsWithStamps > 0
    ? Math.round(([...participantStamps.values()].reduce((a, b) => a + b, 0) / participantsWithStamps / activeSlots.length) * 100)
    : 0;
  const fullCompletion = [...participantStamps.values()].filter((c) => c >= activeSlots.length).length;

  // Tier distribution
  const tierDist = { none: 0, sprout: 0, explorer: 0, keeper: 0 };
  for (const count of participantStamps.values()) {
    if (count >= tierConfig.keeper.goal_count) tierDist.keeper++;
    else if (count >= tierConfig.explorer.goal_count) tierDist.explorer++;
    else if (count >= tierConfig.sprout.goal_count) tierDist.sprout++;
    else tierDist.none++;
  }

  return (
    <div className="space-y-4">
      <RealtimeRefresh table="stamp_records" />
      <RealtimeRefresh table="stamp_slots" />

      <div className="flex items-center justify-between">
        <div>
          <Link href={`/admin/events/${id}`} className="text-sm hover:underline">&larr; {event.name}</Link>
          <h1 className="text-2xl font-bold">🎫 {board.name}</h1>
        </div>
        <form action={async () => { "use server"; await deleteStampBoardAction(id, board.id); }}>
          <button
            type="submit"
            className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-500 hover:bg-red-50"
          >
            보드 삭제
          </button>
        </form>
      </div>

      {/* Stats dashboard */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-center">
          <div className="text-2xl font-bold text-violet-700">{participantsWithStamps}<span className="text-sm opacity-60">/{totalP}</span></div>
          <div className="text-xs text-violet-600">참여 참가자</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{avgCompletion}%</div>
          <div className="text-xs text-blue-600">평균 완료율</div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{fullCompletion}</div>
          <div className="text-xs text-green-600">전체 완료</div>
        </div>
      </div>

      {/* Tier distribution */}
      <div className="rounded-2xl border bg-white p-5">
        <h2 className="font-bold mb-3">등급 분포</h2>
        <div className="space-y-2">
          {[
            { key: "keeper", emoji: tierConfig.keeper.emoji, label: tierConfig.keeper.label, count: tierDist.keeper, color: "bg-emerald-500" },
            { key: "explorer", emoji: tierConfig.explorer.emoji, label: tierConfig.explorer.label, count: tierDist.explorer, color: "bg-blue-500" },
            { key: "sprout", emoji: tierConfig.sprout.emoji, label: tierConfig.sprout.label, count: tierDist.sprout, color: "bg-yellow-500" },
            { key: "none", emoji: "🌰", label: "미달성", count: tierDist.none, color: "bg-neutral-300" },
          ].map((t) => {
            const pct = participantsWithStamps > 0 ? Math.round((t.count / participantsWithStamps) * 100) : 0;
            return (
              <div key={t.key} className="flex items-center gap-3">
                <span className="w-6 text-center">{t.emoji}</span>
                <span className="w-16 text-sm">{t.label}</span>
                <div className="flex-1 h-4 overflow-hidden rounded-full bg-neutral-100">
                  <div className={`h-full rounded-full ${t.color} transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 text-right text-xs text-neutral-500">{t.count}명 ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tier settings */}
      <form
        action={async (formData: FormData) => {
          "use server";
          await updateStampBoardAction(id, board.id, formData);
        }}
        className="rounded-2xl border bg-white p-5 space-y-3"
      >
        <h2 className="font-bold">등급 설정</h2>
        <input type="hidden" name="name" value={board.name} />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="tier_sprout" className="block text-xs font-semibold mb-1">
              {tierConfig.sprout.emoji} {tierConfig.sprout.label}
            </label>
            <input
              id="tier_sprout"
              name="tier_sprout"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={tierConfig.sprout.goal_count}
              className="w-full rounded-lg border px-3 py-2 text-center focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="tier_explorer" className="block text-xs font-semibold mb-1">
              {tierConfig.explorer.emoji} {tierConfig.explorer.label}
            </label>
            <input
              id="tier_explorer"
              name="tier_explorer"
              type="number"
              inputMode="numeric"
              min={2}
              defaultValue={tierConfig.explorer.goal_count}
              className="w-full rounded-lg border px-3 py-2 text-center focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="tier_keeper" className="block text-xs font-semibold mb-1">
              {tierConfig.keeper.emoji} {tierConfig.keeper.label}
            </label>
            <input
              id="tier_keeper"
              name="tier_keeper"
              type="number"
              inputMode="numeric"
              min={3}
              defaultValue={tierConfig.keeper.goal_count}
              className="w-full rounded-lg border px-3 py-2 text-center focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          등급 저장
        </button>
      </form>

      {/* Slots list */}
      <div className="rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">스테이션 목록 ({activeSlots.length}개)</h2>
        </div>

        <div className="space-y-2">
          {activeSlots.map((slot) => {
            const stampCount = slotStampCounts.get(slot.id) ?? 0;
            const congestion = slot.congestion_status ?? "GREEN";
            return (
              <div key={slot.id} className="flex items-center gap-3 rounded-xl border p-3">
                <span className="text-xl">{slot.icon || "📍"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{slot.name}</span>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px]">
                      {SLOT_TYPE_LABEL[slot.type] ?? slot.type}
                    </span>
                    <span className="text-xs">{CONGESTION_ICON[congestion]}</span>
                  </div>
                  {slot.location_hint && (
                    <p className="text-[11px] text-neutral-400 truncate">{slot.location_hint}</p>
                  )}
                  {slot.staff_name && (
                    <p className="text-[11px] text-neutral-400">담당: {slot.staff_name}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-violet-700">{stampCount}</div>
                  <div className="text-[10px] text-neutral-400">도장</div>
                </div>
                <form action={async () => { "use server"; await deleteSlotAction(id, slot.id); }}>
                  <button
                    type="submit"
                    className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </form>
              </div>
            );
          })}
        </div>

        {/* Add slot form */}
        {activeSlots.length < board.total_slots && (
          <form
            action={async (formData: FormData) => {
              "use server";
              await addStampSlotAction(id, board.id, formData);
            }}
            className="mt-4 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-violet-700">스테이션 추가</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="slot-name" className="block text-xs font-medium mb-1">이름</label>
                <input
                  id="slot-name"
                  name="name"
                  type="text"
                  required
                  placeholder="예: 자연관찰 코너"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="slot-icon" className="block text-xs font-medium mb-1">아이콘 (이모지)</label>
                <input
                  id="slot-icon"
                  name="icon"
                  type="text"
                  placeholder="🌿"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="slot-location" className="block text-xs font-medium mb-1">위치 힌트 (선택)</label>
              <input
                id="slot-location"
                name="location_hint"
                type="text"
                placeholder="예: 숲속 쉼터 옆"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
              />
            </div>
            <input type="hidden" name="description" value="" />
            <button
              type="submit"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              + 추가
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
