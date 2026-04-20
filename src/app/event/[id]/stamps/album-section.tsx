// NOTE: Supabase Storage bucket `stamp-photos` should be created manually in the dashboard.
// 지금은 기존 `chat-files` bucket 을 사용합니다 (경로: `stamps/{slotId}/{participantId}/...`).
import Link from "next/link";
import { PhotoUploadModal } from "./photo-upload-modal";

interface SlotInfo {
  id: string;
  name: string;
  icon: string | null;
}

interface AlbumPhoto {
  id: string;
  slot_id: string;
  photo_url: string;
  caption: string | null;
  created_at: string;
}

interface Props {
  eventId: string;
  stampedSlots: SlotInfo[];
  photos: AlbumPhoto[];
}

export function AlbumSection({ eventId, stampedSlots, photos }: Props) {
  if (stampedSlots.length === 0) return null;

  const photosBySlot = new Map<string, AlbumPhoto[]>();
  for (const photo of photos) {
    const list = photosBySlot.get(photo.slot_id) ?? [];
    list.push(photo);
    photosBySlot.set(photo.slot_id, list);
  }

  return (
    <section aria-labelledby="album-heading">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="album-heading" className="text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden="true">📸</span> 숲 앨범
        </h2>
        <Link
          href={`/event/${eventId}/album`}
          className="text-xs font-semibold text-violet-700 hover:underline"
        >
          전체 보기 →
        </Link>
      </div>

      <div className="space-y-3">
        {stampedSlots.map((slot) => {
          const slotPhotos = photosBySlot.get(slot.id) ?? [];
          return (
            <div
              key={slot.id}
              className="rounded-2xl border border-[#D4E4BC] bg-[#FEFCF8] p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#2D5A3D]">
                  <span aria-hidden="true">{slot.icon || "🏞️"}</span>
                  <span className="truncate">{slot.name}</span>
                  {slotPhotos.length > 0 && (
                    <span className="rounded-full bg-[#E8F0E4] px-1.5 py-0.5 text-[10px] font-bold text-[#4A7C59]">
                      {slotPhotos.length}
                    </span>
                  )}
                </div>
                <PhotoUploadModal
                  eventId={eventId}
                  slotId={slot.id}
                  slotName={slot.name}
                  slotEmoji={slot.icon}
                />
              </div>

              {slotPhotos.length === 0 ? (
                <p className="py-4 text-center text-xs text-[#6B6560]">
                  <span aria-hidden="true">🌱</span> 첫 사진을 남겨보세요
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slotPhotos.slice(0, 6).map((photo) => (
                    <Link
                      key={photo.id}
                      href={`/event/${eventId}/album?photo=${photo.id}`}
                      className="group relative block aspect-square overflow-hidden rounded-xl bg-neutral-200"
                      aria-label={photo.caption || "사진 보기"}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.photo_url}
                        alt={photo.caption || slot.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      {photo.caption && (
                        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 py-1 text-[10px] text-white">
                          {photo.caption}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
