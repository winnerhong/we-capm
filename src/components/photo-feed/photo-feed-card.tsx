// 행사홈의 사진 피드 입구 — 하단 탭을 대신한다.
//
// 왜 탭에서 내렸나:
//   하단이 7칸이 되면서 360px 폰에서 글자가 눌렸다. 사진 피드는 "왔다 갔다 하는"
//   화면이 아니라 "구경하는" 화면이라 상시 자리를 차지할 성격이 아니다.
//
// 대신 카드가 탭보다 잘 보인다: 작은 📸 아이콘 하나보다 실제 사진 석 장이 깔린
// 카드가 훨씬 눈에 띄고, 무엇이 있는 곳인지 열기 전에 알 수 있다.
//
// 사진이 없거나 기관이 피드를 끈 행사에서는 카드 자체가 나타나지 않는다.

import Link from "next/link";
import { eventHref } from "@/lib/event-context";
import { loadEventPhotoFeed } from "@/lib/missions/photo-feed-queries";

/** 카드에 걸 미리보기 장수. 재서명 비용이 있어 딱 필요한 만큼만 받아온다. */
const PREVIEW_COUNT = 3;

export async function PhotoFeedCard({
  eventId,
  viewerId,
}: {
  eventId: string;
  viewerId?: string;
}) {
  if (!eventId) return null;

  // 스위치는 loadEventPhotoFeed 안에서 이미 본다 — 여기서 또 물으면 왕복만 는다.
  // 꺼진 행사·사진 0장 모두 빈 배열이고, 그때 카드는 나타나지 않는다.
  const photos = await loadEventPhotoFeed({
    eventId,
    viewerId,
    limit: PREVIEW_COUNT,
  }).catch(() => []);
  if (photos.length === 0) return null;

  return (
    <Link
      href={eventHref(eventId, "/photos")}
      className="block overflow-hidden rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition hover:border-[#2D5A3D]/40 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span aria-hidden>📸</span>
          우리 행사 사진
        </h2>
        <span className="text-xs font-semibold text-[#8B7F75]">모아보기 →</span>
      </div>

      <ul className="mt-3 grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <li
            key={`${p.submissionId}-${p.url}`}
            className="overflow-hidden rounded-xl border border-[#D4E4BC] bg-[#FFF8F0]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={`${p.userName || "다른"} 가족의 ${p.missionTitle} 사진`}
              className="aspect-square w-full object-cover"
              loading="lazy"
            />
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[11px] leading-relaxed text-[#6B6560]">
        참가 가족들이 나눈 미션 사진이에요. 하트를 누르면 도토리를 보낼 수 있어요.
      </p>
    </Link>
  );
}
