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
import { AcornIcon } from "@/components/acorn-icon";

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
          <Link href={`/admin/events/${id}`} className="text-sm text-[#2D5A3D] hover:underline">&larr; {event.name}</Link>
          <div className="mt-2 rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <span><AcornIcon size={24} /></span>
              <span>도토리 수집 랠리 만들기</span>
            </h1>
            <p className="mt-1 text-sm text-white/80">숲길을 걸으며 도토리를 모아보는 탐험을 시작해요</p>
          </div>
        </div>

        <form
          action={async (formData: FormData) => {
            "use server";
            await createStampBoardAction(id, formData);
          }}
          className="rounded-2xl border border-[#D4E4BC] bg-white p-6 space-y-4 max-w-lg"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-semibold mb-1 text-[#2C2C2C]">🌲 보드 이름</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue="도토리 수집 랠리"
              className="w-full rounded-xl border-2 border-[#D4E4BC] px-4 py-3 focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#E8F0E4]"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-semibold mb-1 text-[#2C2C2C]">🍃 설명 (선택)</label>
            <textarea
              id="description"
              name="description"
              rows={2}
              className="w-full rounded-xl border-2 border-[#D4E4BC] px-4 py-3 focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#E8F0E4]"
              placeholder="숲길에서 도토리를 모아 보상을 받아보세요!"
            />
          </div>
          <div>
            <label htmlFor="total_slots" className="block text-sm font-semibold mb-1 text-[#2C2C2C]">
              🏞️ 스테이션 수 (최소 3개)
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
              className="w-full rounded-xl border-2 border-[#D4E4BC] px-4 py-3 focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#E8F0E4]"
            />
            <p className="text-xs text-[#6B6560] mt-1">스테이션이 자동으로 생성됩니다. 나중에 이름/아이콘을 수정할 수 있어요.</p>
          </div>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#2D5A3D] py-3 font-bold text-white hover:bg-[#1F4229] transition-colors"
          >
            <AcornIcon /> 도토리 보드 만들기
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

      <div>
        <Link href={`/admin/events/${id}`} className="text-sm text-[#2D5A3D] hover:underline">&larr; {event.name}</Link>
        <div className="mt-2 flex items-center justify-between rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <span><AcornIcon size={24} /></span>
              <span>{board.name}</span>
            </h1>
            <p className="mt-1 text-sm text-white/80">탐험가들이 숲길에서 모은 도토리 현황</p>
          </div>
          <form action={async () => { "use server"; await deleteStampBoardAction(id, board.id); }}>
            <button
              type="submit"
              className="rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-xs text-white hover:bg-white/20"
            >
              보드 삭제
            </button>
          </form>
        </div>
      </div>

      {/* Stats dashboard */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[#D4E4BC] bg-[#E8F0E4] p-4 text-center">
          <div className="text-2xl font-bold text-[#2D5A3D]">{participantsWithStamps}<span className="text-sm opacity-60">/{totalP}</span></div>
          <div className="text-xs text-[#2D5A3D]">🐿️ 참여 탐험가</div>
        </div>
        <div className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 text-center">
          <div className="text-2xl font-bold text-[#C4956A]">{avgCompletion}%</div>
          <div className="text-xs text-[#8B6F47]">🍃 평균 수집률</div>
        </div>
        <div className="rounded-2xl border border-[#A8C686] bg-[#D4E4BC] p-4 text-center">
          <div className="text-2xl font-bold text-[#2D5A3D]">{fullCompletion}</div>
          <div className="text-xs text-[#2D5A3D]">🌳 전체 완료</div>
        </div>
      </div>

      {/* Tier distribution */}
      <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="font-bold mb-3 text-[#2D5A3D]">🌲 등급 분포</h2>
        <div className="space-y-2">
          {([
            { key: "keeper", emoji: tierConfig.keeper.emoji as React.ReactNode, label: tierConfig.keeper.label, count: tierDist.keeper, color: "bg-[#2D5A3D]" },
            { key: "explorer", emoji: tierConfig.explorer.emoji as React.ReactNode, label: tierConfig.explorer.label, count: tierDist.explorer, color: "bg-[#A8C686]" },
            { key: "sprout", emoji: tierConfig.sprout.emoji as React.ReactNode, label: tierConfig.sprout.label, count: tierDist.sprout, color: "bg-[#D4E4BC]" },
            { key: "none", emoji: <AcornIcon size={16} />, label: "미달성", count: tierDist.none, color: "bg-[#E8E3DA]" },
          ]).map((t) => {
            const pct = participantsWithStamps > 0 ? Math.round((t.count / participantsWithStamps) * 100) : 0;
            return (
              <div key={t.key} className="flex items-center gap-3">
                <span className="w-6 text-center">{t.emoji}</span>
                <span className="w-16 text-sm text-[#2C2C2C]">{t.label}</span>
                <div className="flex-1 h-4 overflow-hidden rounded-full bg-[#FFF8F0]">
                  <div className={`h-full rounded-full ${t.color} transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 text-right text-xs text-[#6B6560]">{t.count}명 ({pct}%)</span>
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
        className="rounded-2xl border border-[#D4E4BC] bg-white p-5 space-y-3"
      >
        <h2 className="font-bold text-[#2D5A3D]">🎯 등급 설정</h2>
        <input type="hidden" name="name" value={board.name} />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="tier_sprout" className="block text-xs font-semibold mb-1 text-[#2C2C2C]">
              {tierConfig.sprout.emoji} {tierConfig.sprout.label}
            </label>
            <input
              id="tier_sprout"
              name="tier_sprout"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={tierConfig.sprout.goal_count}
              className="w-full rounded-lg border border-[#D4E4BC] px-3 py-2 text-center focus:border-[#2D5A3D] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="tier_explorer" className="block text-xs font-semibold mb-1 text-[#2C2C2C]">
              {tierConfig.explorer.emoji} {tierConfig.explorer.label}
            </label>
            <input
              id="tier_explorer"
              name="tier_explorer"
              type="number"
              inputMode="numeric"
              min={2}
              defaultValue={tierConfig.explorer.goal_count}
              className="w-full rounded-lg border border-[#D4E4BC] px-3 py-2 text-center focus:border-[#2D5A3D] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="tier_keeper" className="block text-xs font-semibold mb-1 text-[#2C2C2C]">
              {tierConfig.keeper.emoji} {tierConfig.keeper.label}
            </label>
            <input
              id="tier_keeper"
              name="tier_keeper"
              type="number"
              inputMode="numeric"
              min={3}
              defaultValue={tierConfig.keeper.goal_count}
              className="w-full rounded-lg border border-[#D4E4BC] px-3 py-2 text-center focus:border-[#2D5A3D] focus:outline-none"
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1F4229]"
        >
          등급 저장
        </button>
      </form>

      {/* Slots list */}
      <div className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[#2D5A3D]">🏞️ 스테이션 목록 ({activeSlots.length}개)</h2>
        </div>

        <div className="space-y-2">
          {activeSlots.map((slot) => {
            const stampCount = slotStampCounts.get(slot.id) ?? 0;
            const congestion = slot.congestion_status ?? "GREEN";
            return (
              <div key={slot.id} className="flex items-center gap-3 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3">
                <span className="text-xl">{slot.icon || "🌿"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#2C2C2C]">{slot.name}</span>
                    <span className="rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] text-[#2D5A3D]">
                      {SLOT_TYPE_LABEL[slot.type] ?? slot.type}
                    </span>
                    <span className="text-xs">{CONGESTION_ICON[congestion]}</span>
                  </div>
                  {slot.location_hint && (
                    <p className="text-[11px] text-[#6B6560] truncate">📍 {slot.location_hint}</p>
                  )}
                  {slot.staff_name && (
                    <p className="text-[11px] text-[#6B6560]">담당: {slot.staff_name}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1 text-sm font-bold text-[#C4956A]"><AcornIcon /> {stampCount}</div>
                  <div className="text-[10px] text-[#6B6560]">도토리</div>
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
            className="mt-4 rounded-xl border-2 border-dashed border-[#A8C686] bg-[#E8F0E4]/50 p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-[#2D5A3D]">🌱 스테이션 추가</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="slot-name" className="block text-xs font-medium mb-1 text-[#2C2C2C]">이름</label>
                <input
                  id="slot-name"
                  name="name"
                  type="text"
                  required
                  placeholder="예) 자연관찰 코너"
                  className="w-full rounded-lg border border-[#D4E4BC] px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="slot-icon" className="block text-xs font-medium mb-1 text-[#2C2C2C]">아이콘 (이모지)</label>
                <input
                  id="slot-icon"
                  name="icon"
                  type="text"
                  placeholder="🌿"
                  className="w-full rounded-lg border border-[#D4E4BC] px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="slot-location" className="block text-xs font-medium mb-1 text-[#2C2C2C]">위치 힌트 (선택)</label>
              <input
                id="slot-location"
                name="location_hint"
                type="text"
                placeholder="예) 숲속 쉼터 옆"
                className="w-full rounded-lg border border-[#D4E4BC] px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </div>
            <input type="hidden" name="description" value="" />
            <button
              type="submit"
              className="rounded-lg bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1F4229]"
            >
              + 추가
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
