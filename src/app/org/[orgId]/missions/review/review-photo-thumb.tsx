"use client";

// 검수 카드에 들어가는 작은 사진 썸네일 — 클릭 시 라이트박스로 확대.

import { useLightbox, type LightboxItem } from "@/components/photo-lightbox";

type Props = {
  url: string;
  caption?: string;
  subCaption?: string;
};

export function ReviewPhotoThumb({ url, caption, subCaption }: Props) {
  const items: LightboxItem[] = [
    {
      url,
      caption,
      subCaption,
    },
  ];
  const { openAt, lightbox } = useLightbox(items);

  return (
    <>
      <button
        type="button"
        onClick={() => openAt(0)}
        aria-label="제출 이미지 크게 보기"
        className="group inline-block overflow-hidden rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] shadow-sm transition hover:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="제출 이미지 (썸네일)"
          loading="lazy"
          className="h-24 w-24 cursor-zoom-in object-cover transition-transform group-hover:scale-105 md:h-28 md:w-28"
        />
      </button>
      {lightbox}
    </>
  );
}
