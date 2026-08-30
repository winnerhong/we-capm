// 행사 사진 피드 — 참가 가족들이 나눠준 미션 사진 모음.
//
// 미션 화면 하단에도 같은 그리드가 있지만 그쪽은 "그 미션" 만 본다. 여기는
// 행사 전체를 최신순으로 흘려보내 행사 분위기를 느끼게 하는 자리다.
//
// 오르는 사진은 기관이 이 행사에서 나눠보기를 켰고, 기관 확인(자동승인 포함)이
// 끝난 것뿐이다. 검토 중·반려 사진은 절대 오르지 않는다.

import Link from "next/link";
import { requireEventContext } from "@/lib/event-context";
import { EventLocked } from "@/components/event-locked";
import { F } from "@/lib/features/codes";
import {
  isPhotoFeedEnabled,
  loadEventPhotoFeed,
  loadMyLikeCountsByMission,
} from "@/lib/missions/photo-feed-queries";
import { LIKES_PER_MISSION } from "@/lib/missions/photo-feed-core";
import { PhotoGrid } from "@/components/photo-feed/photo-grid";

export const dynamic = "force-dynamic";

export default async function EventPhotosPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ctx = await requireEventContext(eventId);

  // 기관이 안 쓰는 기능. 메뉴·탭에서는 이미 빠져 있지만 북마크·옛 링크로
  // 직접 들어올 수 있다 — 빈 화면 대신 사실을 말하고 돌려보낸다.
  if (!ctx.hasFeature(F.PHOTO)) {
    return (
      <EventLocked
        icon="📸"
        title="사진"
        notice="이 행사에서는 사용하지 않는 기능이에요"
        homeHref={ctx.href()}
      />
    );
  }

  const enabled = await isPhotoFeedEnabled(eventId);

  if (!enabled) {
    // 탭도 안 뜨는 상태지만, 링크를 직접 열었을 때 빈 화면 대신 이유를 알려준다.
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <section className="rounded-3xl border border-[#D4E4BC] bg-white p-6 text-center shadow-sm">
          <p className="text-4xl" aria-hidden>
            📸
          </p>
          <h1 className="mt-3 text-lg font-bold text-[#2D5A3D]">
            사진 나눠보기를 쓰지 않는 행사예요
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#6B6560]">
            기관에서 열어주면 참가 가족들이 서로의 미션 사진을 볼 수 있어요.
          </p>
          <Link
            href={ctx.href()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-[#2D5A3D] px-5 py-2.5 text-sm font-bold text-white"
          >
            🎪 행사홈으로
          </Link>
        </section>
      </div>
    );
  }

  const photos = await loadEventPhotoFeed({
    eventId,
    viewerId: ctx.user.id,
    limit: 60,
  }).catch(() => []);

  // 좋아요는 미션 단위로 3개씩이라, 이 탭에서는 사진마다 남은 개수가 다르다.
  const usedByMission = await loadMyLikeCountsByMission(
    ctx.user.id,
    Array.from(new Set(photos.map((p) => p.missionId)))
  ).catch(() => ({}));

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-4">
      <header className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h1 className="flex items-center gap-2 text-lg font-bold text-[#2D5A3D]">
          <span aria-hidden>📸</span>
          <span>우리 행사 사진</span>
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-[#6B6560]">
          참가 가족들이 나눠준 미션 사진이에요. 새 사진이 올라오면 저절로
          채워집니다.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-[#8B7F75]">
          🌿 사진 미션을 완료하면 내 사진도 여기에 함께 올라와요 (기관 확인 후).
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#8B7F75]">
          ❤️ 하트를 누르면 그 가족에게 도토리가 1개 전해져요. 미션마다{" "}
          {LIKES_PER_MISSION}개까지 누를 수 있어요.
        </p>
      </header>

      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
        <PhotoGrid
          photos={photos}
          eventId={eventId}
          viewerId={ctx.user.id}
          usedByMission={usedByMission}
          channelKey={`event-${eventId}`}
        />
      </section>
    </div>
  );
}
