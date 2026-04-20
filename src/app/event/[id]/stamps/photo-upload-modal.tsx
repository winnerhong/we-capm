// NOTE: Supabase Storage bucket `stamp-photos` should be created manually in the dashboard.
// 지금은 기존 `chat-files` bucket 을 사용합니다 (경로: `stamps/{slotId}/{participantId}/...`).
"use client";

import { useRef, useState, useTransition } from "react";
import { compressImage } from "@/lib/image-compress";
import { uploadStampPhotoAction } from "./photo-actions";

interface Props {
  eventId: string;
  slotId: string;
  slotName: string;
  slotEmoji?: string | null;
}

export function PhotoUploadModal({ eventId, slotId, slotName, slotEmoji }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCaption("");
    setError(null);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setError(null);

    try {
      setCompressing(true);
      const compressed = await compressImage(picked);
      setFile(compressed);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(compressed));
    } catch {
      setError("이미지를 불러오지 못했어요");
    } finally {
      setCompressing(false);
    }
  };

  const onSubmit = () => {
    if (!file) {
      setError("사진을 선택해주세요");
      return;
    }

    const fd = new FormData();
    fd.append("photo", file);
    fd.append("caption", caption);

    startTransition(async () => {
      try {
        await uploadStampPhotoAction(eventId, slotId, fd);
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : "업로드 실패");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4] active:scale-[0.98] transition-all"
        aria-label={`${slotName} 사진 올리기`}
      >
        <span aria-hidden="true">📸</span>
        사진 올리기
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="사진 업로드"
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-[#FEFCF8] p-5 pb-8 animate-in slide-in-from-bottom-6 duration-200 sm:rounded-3xl sm:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#2D5A3D]">
                  <span aria-hidden="true">{slotEmoji || "🏞️"}</span> {slotName}
                </h3>
                <p className="mt-0.5 text-xs text-[#6B6560]">이 순간을 숲 앨범에 남겨보세요</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="-mr-1 -mt-1 rounded-full p-2 text-[#6B6560] hover:bg-[#E8F0E4]"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* Preview / Picker */}
            {previewUrl ? (
              <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-2xl bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="미리보기" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    inputRef.current?.click();
                  }}
                  className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"
                >
                  다시 찍기
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mb-3 flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#D4E4BC] bg-[#E8F0E4]/40 text-[#4A7C59] hover:bg-[#E8F0E4] transition-colors"
              >
                <span className="text-5xl" aria-hidden="true">📷</span>
                <span className="text-sm font-semibold">사진 찍기 / 고르기</span>
                <span className="text-[11px] text-[#6B6560]">카메라 또는 갤러리</span>
              </button>
            )}

            <input
              ref={inputRef}
              type="file"
              name="photo"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={onPick}
            />

            {/* Caption */}
            <label htmlFor="stamp-caption" className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
              한 줄 기록 (선택)
            </label>
            <input
              id="stamp-caption"
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={80}
              placeholder="예: 오늘의 작은 도토리 🌰"
              autoComplete="off"
              inputMode="text"
              className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm placeholder:text-[#A8A49F] focus:border-[#4A7C59] focus:outline-none focus:ring-2 focus:ring-violet-200"
            />

            {error && (
              <p className="mt-2 text-xs font-semibold text-red-600" role="alert" aria-live="polite">
                {error}
              </p>
            )}
            {compressing && (
              <p className="mt-2 text-xs text-[#6B6560]" aria-live="polite">
                사진을 다듬고 있어요…
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="flex-1 rounded-xl border-2 border-[#D4E4BC] py-3 text-sm font-semibold text-[#6B6560] hover:bg-[#E8F0E4] disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={pending || compressing || !file}
                className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow hover:bg-violet-700 disabled:opacity-50 disabled:hover:bg-violet-600 active:scale-[0.98] transition-all"
              >
                {pending ? "올리는 중…" : "올리기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
