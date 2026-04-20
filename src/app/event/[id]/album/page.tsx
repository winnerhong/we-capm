// NOTE: Supabase Storage bucket `stamp-photos` should be created manually in the dashboard.
// 지금은 기존 `chat-files` bucket 을 사용합니다 (경로: `stamps/{slotId}/{participantId}/...`).
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/participant-session";
import { AlbumGallery } from "./album-gallery";

export const dynamic = "force-dynamic";

export default async function EventAlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getParticipant(id);
  if (!p) redirect("/join");

  const supabase = await createClient();

  const [eventRes, participantRes, boardRes] = await Promise.all([
    supabase.from("events").select("id, name").eq("id", id).single(),
    supabase
      .from("participants")
      .select("id")
      .eq("event_id", id)
      .eq("phone", p.phone)
      .maybeSingle(),
    supabase
      .from("stamp_boards")
      .select("id")
      .eq("event_id", id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  const event = eventRes.data;
  if (!event) notFound();

  const participant = participantRes.data;
  const board = boardRes.data;

  // 슬롯 정보 (이름/아이콘 맵핑용)
  let slotMap = new Map<string, { id: string; name: string; icon: string | null }>();
  if (board) {
    const { data: slots } = await supabase
      .from("stamp_slots")
      .select("id, name, icon")
      .eq("board_id", board.id);
    for (const s of slots ?? []) {
      slotMap.set(s.id, { id: s.id, name: s.name, icon: s.icon });
    }
  }

  // 내 사진 전체
  let photos: Array<{
    id: string;
    slot_id: string;
    photo_url: string;
    caption: string | null;
    created_at: string;
  }> = [];

  if (participant && slotMap.size > 0) {
    const { data } = await supabase
      .from("stamp_albums")
      .select("id, slot_id, photo_url, caption, created_at")
      .eq("participant_id", participant.id)
      .in("slot_id", Array.from(slotMap.keys()))
      .order("created_at", { ascending: false });
    photos = data ?? [];
  }

  // 슬롯 라벨을 포함한 사진 목록
  const enriched = photos.map((ph) => {
    const slot = slotMap.get(ph.slot_id);
    return {
      ...ph,
      slot_name: slot?.name ?? "알 수 없는 장소",
      slot_icon: slot?.icon ?? null,
    };
  });

  // 필터 옵션 (사진이 있는 슬롯만)
  const slotIdsWithPhotos = new Set(photos.map((ph) => ph.slot_id));
  const filterOptions = Array.from(slotIdsWithPhotos)
    .map((sid) => slotMap.get(sid))
    .filter((s): s is { id: string; name: string; icon: string | null } => !!s);

  return (
    <main className="min-h-dvh bg-[#FEFCF8] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] px-4 pt-5 pb-6 text-white shadow-lg">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center gap-2 text-xs opacity-90">
            <Link href={`/event/${id}/stamps`} className="hover:underline">
              ← 스탬프
            </Link>
          </div>
          <h1 className="mt-1 text-xl font-bold">
            <span aria-hidden="true">📸</span> 나의 숲 앨범
          </h1>
          <p className="mt-1 text-sm opacity-90">
            {p.name}님이 남긴 숲의 순간들 · 총 {photos.length}장
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-4">
        {photos.length === 0 ? (
          <div className="rounded-2xl border border-[#D4E4BC] bg-white p-12 text-center">
            <div className="mb-3 text-5xl" aria-hidden="true">🌱</div>
            <h2 className="text-base font-bold text-[#2D5A3D]">첫 사진을 남겨보세요</h2>
            <p className="mt-1 text-xs text-[#6B6560]">
              스탬프를 찍은 곳에서 사진을 올릴 수 있어요
            </p>
            <Link
              href={`/event/${id}/stamps`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700"
            >
              스탬프 보러가기 →
            </Link>
          </div>
        ) : (
          <Suspense fallback={<div className="py-8 text-center text-xs text-[#6B6560]">불러오는 중…</div>}>
            <AlbumGallery
              eventId={id}
              photos={enriched}
              filterOptions={filterOptions}
            />
          </Suspense>
        )}
      </div>
    </main>
  );
}
