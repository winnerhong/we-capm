"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  signedUrl: string;
  alt: string;
  fileName: string;
  fileSize?: number | null;
  isImage: boolean;
  mimeType?: string | null;
};

function fmtSize(size: number | null | undefined): string {
  if (!size) return "";
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

export function DocumentImageViewer({
  signedUrl,
  alt,
  fileName,
  fileSize,
  isImage,
  mimeType,
}: Props) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!signedUrl) {
    return <p className="text-xs text-rose-600">⚠️ 파일 URL 생성 실패</p>;
  }

  return (
    <>
      {/* 썸네일 */}
      <div className="overflow-hidden rounded-xl border border-[#D4E4BC] bg-[#FFF8F0]">
        {isImage ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`${alt} 원본 크게 보기`}
            className="block h-44 w-full cursor-zoom-in overflow-hidden bg-[#FFF8F0] p-0 transition hover:opacity-90"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedUrl}
              alt={alt}
              className="h-44 w-full object-cover"
            />
          </button>
        ) : (
          <div className="flex h-44 flex-col items-center justify-center gap-2">
            <span className="text-4xl" aria-hidden>
              📄
            </span>
            <p className="px-2 text-center text-[10px] text-[#6B6560]">
              {mimeType ?? "파일"}
            </p>
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="mt-2 flex flex-wrap gap-2">
        {isImage ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-[#2D5A3D] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            🔍 원본 크게 보기
          </button>
        ) : (
          <a
            href={signedUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[#2D5A3D] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            ⬇ 다운로드
          </a>
        )}
      </div>

      {/* 모달 */}
      {open && isImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} 원본 이미지`}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="relative flex max-h-[95vh] w-full max-w-5xl flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between rounded-t-xl bg-black/70 px-4 py-2 text-xs text-white">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0">📎</span>
                <span className="truncate font-semibold">{fileName}</span>
                {fileSize ? (
                  <span className="shrink-0 text-white/60">
                    · {fmtSize(fileSize)}
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="새 탭에서 원본 열기"
                  className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20"
                >
                  ↗ 새 탭
                </a>
                <button
                  type="button"
                  onClick={close}
                  aria-label="닫기"
                  className="rounded-md bg-white/10 px-2 py-1 text-[13px] font-bold text-white hover:bg-white/20"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 이미지 */}
            <div className="flex flex-1 items-center justify-center overflow-auto rounded-b-xl bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signedUrl}
                alt={alt}
                className="max-h-[85vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
