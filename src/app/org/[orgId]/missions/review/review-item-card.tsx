// 서버 컴포넌트 — 한 제출 건의 카드 레이아웃.
// 탭에 따라 하단 영역이 달라짐:
//   - pending : <ReviewActions /> (승인 / 반려 버튼)
//   - approved: 지급 도토리 + 처리 시각
//   - rejected: 사유 + 처리 시각
import type { ReviewSubmissionItem } from "@/lib/missions/review-queries";
import type { ReviewTab } from "./review-layout";
import { ReviewActions } from "./review-actions";
import {
  formatAgo,
  waitTone,
  WAIT_TONE_CLASSES,
} from "./utils";

type Props = {
  item: ReviewSubmissionItem;
  tab: ReviewTab;
};

/* -------------------------------------------------------------------------- */
/* payload 미리보기 유틸                                                      */
/* -------------------------------------------------------------------------- */

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickFirstImageUrl(payload: Record<string, unknown>): string | null {
  // 배열 계열: photo_urls / photos / image_urls
  for (const key of ["photo_urls", "photos", "image_urls"]) {
    const v = payload[key];
    if (Array.isArray(v)) {
      for (const entry of v) {
        if (typeof entry === "string" && entry.trim()) return entry.trim();
        if (entry && typeof entry === "object") {
          const url = (entry as Record<string, unknown>).url;
          if (typeof url === "string" && url.trim()) return url.trim();
        }
      }
    }
  }
  // 단일: image_url / photo_url
  const single = pickString(payload, ["image_url", "photo_url"]);
  return single;
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function ReviewItemCard({ item, tab }: Props) {
  const kind = item.missionKind;
  const payload = item.payload ?? {};
  const tone = waitTone(item.waitingMinutes);

  // payload 미리보기 블록 분기
  const firstImage = pickFirstImageUrl(payload);
  const caption = pickString(payload, ["caption", "answer", "text", "note"]);
  const songTitle = pickString(payload, ["song_title", "title"]);
  const artist = pickString(payload, ["artist"]);
  const story = pickString(payload, ["story_text", "story"]);
  const lat = typeof payload.lat === "number" ? payload.lat : null;
  const lng = typeof payload.lng === "number" ? payload.lng : null;
  const checkedAt = pickString(payload, ["checked_in_at", "scanned_at"]);

  return (
    <article className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm md:p-5">
      {/* 상단: 대기 뱃지 + 팩 이름 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {tab === "pending" && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${WAIT_TONE_CLASSES[tone]}`}
            >
              <span aria-hidden>⏳</span>
              <span>대기 {formatAgo(item.submittedAt)}</span>
            </span>
          )}
          {item.packName && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
              <span aria-hidden>📚</span>
              <span className="truncate max-w-[140px]">{item.packName}</span>
            </span>
          )}
        </div>
        <span className="text-[11px] text-[#8B7F75]">
          제출 {formatAgo(item.submittedAt)}
        </span>
      </div>

      {/* 미션 정보 */}
      <div className="mt-2 flex items-start gap-2">
        <span className="text-2xl leading-none" aria-hidden>
          {item.missionIcon ?? "📋"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-[#2D5A3D] md:text-base">
            {item.missionTitle}
          </h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {kind && (
              <span className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                {kind}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2D5A3D]">
              <span aria-hidden>🌰</span>
              <span>
                기본 {item.defaultAcorns}
                {tab === "approved" && item.awardedAcorns !== null && (
                  <>
                    {" · 지급 "}
                    <span className="font-bold">{item.awardedAcorns}</span>
                  </>
                )}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* 제출자 */}
      <p className="mt-2 text-xs text-[#6B6560]">
        <span aria-hidden>🧑 </span>
        <span className="font-semibold text-[#2D5A3D]">
          {item.submitterDisplayName}
        </span>
        {item.childName && (
          <span className="text-[#8B7F75]"> ({item.childName})</span>
        )}
      </p>

      {/* payload 미리보기 */}
      <div className="mt-3 space-y-2">
        {firstImage && (
          <a
            href={firstImage}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40"
            aria-label="제출 이미지 크게 보기"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={firstImage}
              alt="제출 이미지"
              className="h-48 w-full object-cover md:h-56"
            />
          </a>
        )}

        {kind === "RADIO" && (songTitle || artist || story) && (
          <div className="rounded-xl bg-[#F5F1E8] p-3 text-xs text-[#2C2C2C]">
            <p className="font-semibold text-[#2D5A3D]">
              <span aria-hidden>🎵 </span>
              {songTitle || "(곡 정보 없음)"}
              {artist && (
                <span className="text-[#6B6560] font-normal"> — {artist}</span>
              )}
            </p>
            {story && (
              <p className="mt-1 line-clamp-2 text-[11px] text-[#6B6560]">
                {story}
              </p>
            )}
          </div>
        )}

        {kind !== "RADIO" && caption && (
          <p className="line-clamp-2 rounded-xl bg-[#F5F1E8] p-3 text-xs text-[#2C2C2C]">
            &ldquo;{caption}&rdquo;
          </p>
        )}

        {(kind === "LOCATION" || kind === "ATTENDANCE") &&
          (lat !== null || checkedAt) && (
            <div className="rounded-xl bg-[#F5F1E8] p-3 text-xs text-[#2C2C2C]">
              {lat !== null && lng !== null && (
                <p>
                  <span aria-hidden>🗺 </span>
                  좌표 {lat.toFixed(4)}, {lng.toFixed(4)}
                </p>
              )}
              {checkedAt && (
                <p className="mt-1 text-[#6B6560]">
                  체크인 {formatAgo(checkedAt)}
                </p>
              )}
            </div>
          )}

        {/* fallback — 아무 미리보기도 못 만들었을 때 개발자용 */}
        {!firstImage &&
          !caption &&
          !(songTitle || artist || story) &&
          lat === null &&
          !checkedAt &&
          Object.keys(payload).length > 0 && (
            <pre className="max-h-32 overflow-auto rounded-xl bg-[#F5F1E8] p-2 font-mono text-[10px] text-[#6B6560]">
              {JSON.stringify(payload, null, 2).slice(0, 500)}
            </pre>
          )}
      </div>

      {/* 하단 액션 또는 처리 결과 */}
      <div className="mt-4 border-t border-[#D4E4BC] pt-3">
        {tab === "pending" && (
          <ReviewActions submissionId={item.id} tab={tab} />
        )}
        {tab === "approved" && (
          <p className="text-xs font-semibold text-[#2D5A3D]">
            <span aria-hidden>✅ </span>
            승인됨
            {item.awardedAcorns !== null && (
              <>
                {" · +"}
                <span className="font-bold">{item.awardedAcorns}</span>
                <span aria-hidden>🌰</span>
              </>
            )}
            {item.reviewedAt && (
              <span className="ml-2 text-[#8B7F75] font-normal">
                처리 {formatAgo(item.reviewedAt)}
              </span>
            )}
          </p>
        )}
        {tab === "rejected" && (
          <div className="text-xs">
            <p className="font-semibold text-rose-700">
              <span aria-hidden>❌ </span>
              반려됨
              {item.reviewedAt && (
                <span className="ml-2 text-[#8B7F75] font-normal">
                  처리 {formatAgo(item.reviewedAt)}
                </span>
              )}
            </p>
            {item.rejectReason && (
              <p className="mt-1 rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-800">
                사유: {item.rejectReason}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
