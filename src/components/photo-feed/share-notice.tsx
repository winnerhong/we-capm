// "지금 이 사진이 남에게 보이는가" 를 적어주는 줄.
//
// 켜고 끄는 토글이 아니다 — 공개 여부는 기관이 행사 단위로 정한다. 그래도 줄을
// 없애지 않는 이유: 선택지가 없을수록 **지금 상태**는 화면에 적혀 있어야 한다.
//
// 사진이 들어가는 미션은 종류마다 화면이 다르다(PHOTO 는 결과 화면, PHOTO_APPROVAL
// 은 자체 상태 패널). 그 화면들이 각자 문구를 지어 쓰면 같은 상황에 다른 말이
// 적히므로, 문장은 photo-feed-core 한 곳에서 만들고 이 컴포넌트만 돌려 쓴다.

import { describeAutoShare } from "@/lib/missions/photo-feed-core";

export function PhotoShareNotice({
  feedEnabled,
  /** 제출물 상태. 아직 제출 전이면 생략 — "기관 확인이 끝나면" 쪽 문장이 나간다. */
  status,
  className = "mt-3",
}: {
  feedEnabled: boolean;
  status?: string | null;
  className?: string;
}) {
  const notice = describeAutoShare({ feedEnabled, status });
  if (!notice) return null;

  const live = notice.state === "live";
  return (
    <p
      className={`${className} rounded-2xl border px-3 py-2.5 text-[11px] leading-relaxed ${
        live
          ? "border-[#D4E4BC] bg-[#F5F1E8]/60 text-[#6B6560]"
          : "border-[#E8DDC8] bg-[#FFF8F0] text-[#8B7F75]"
      }`}
    >
      <span className="block text-xs font-bold text-[#2D5A3D]">
        {live ? "📸 다른 가족들도 보고 있어요" : "📸 곧 함께 보여요"}
      </span>
      <span className="mt-0.5 block">{notice.text}</span>
    </p>
  );
}
