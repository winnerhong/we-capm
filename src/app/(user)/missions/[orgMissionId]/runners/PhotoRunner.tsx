"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/image-compress";
import type {
  OrgMissionRow,
  PhotoMissionConfig,
} from "@/lib/missions/types";
import { submitMissionAction, uploadMissionPhotoAction } from "../../actions";
import { AcornIcon } from "@/components/acorn-icon";

interface Props {
  mission: OrgMissionRow;
  config: PhotoMissionConfig;
}

export function PhotoRunner({ mission, config }: Props) {
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const minPhotos = Math.max(1, config.min_photos ?? 1);
  const maxPhotos = 5; // 안전하게 5장 제한
  const requireCaption = Boolean(config.require_caption);

  const handleFileUpload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (list.length === 0) return;

      const remaining = maxPhotos - photos.length;
      if (remaining <= 0) {
        setErrorMsg(`최대 ${maxPhotos}장까지 올릴 수 있어요`);
        return;
      }
      const toProcess = list.slice(0, remaining);

      setUploading(true);
      setErrorMsg(null);

      const uploaded: string[] = [];
      let doneCount = 0;

      for (const file of toProcess) {
        try {
          setUploadStatus(
            `압축 중 (${doneCount + 1}/${toProcess.length})...`
          );
          const compressed = await compressImage(file, { maxKb: 500 });
          setUploadStatus(
            `업로드 중 (${doneCount + 1}/${toProcess.length})...`
          );
          const fd = new FormData();
          fd.append("file", compressed, compressed.name || "photo.jpg");
          const { url } = await uploadMissionPhotoAction(mission.id, fd);
          uploaded.push(url);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[PhotoRunner] upload failed", msg);
          setErrorMsg(`업로드 실패: ${msg}`);
        }
        doneCount += 1;
      }

      if (uploaded.length > 0) {
        setPhotos((prev) => [...prev, ...uploaded]);
      }
      setUploadStatus(null);
      setUploading(false);
    },
    [mission.id, photos.length]
  );

  const handleRemove = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (photos.length < minPhotos) {
      setErrorMsg(`사진을 ${minPhotos}장 이상 올려주세요`);
      return;
    }
    if (requireCaption && caption.trim().length === 0) {
      setErrorMsg("한 줄 소감을 입력해 주세요");
      return;
    }
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const result = await submitMissionAction(mission.id, {
          photo_urls: photos,
          caption: caption.trim() || undefined,
        });
        if (result.redirectTo) {
          router.push(result.redirectTo);
          router.refresh();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(msg);
      }
    });
  };

  const canSubmit =
    !uploading &&
    !isPending &&
    photos.length >= minPhotos &&
    (!requireCaption || caption.trim().length > 0);

  return (
    <div className="space-y-4">
      {/* 안내 */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span aria-hidden>📸</span>
          미션 안내
        </h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#3D3A36]">
          {config.prompt || "사진을 찍어 업로드해 주세요"}
        </p>
        {config.geofence && (
          <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
            📍 지정된 장소 반경 {config.geofence.radius_m}m 이내에서 촬영해
            주세요
          </p>
        )}
        {minPhotos > 1 && (
          <p className="mt-2 text-[11px] font-semibold text-[#6B6560]">
            사진 {minPhotos}장 이상 필요
          </p>
        )}
      </section>

      {/* 업로드 영역 */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-[#2D5A3D]">
          📷 사진 ({photos.length}/{maxPhotos})
        </p>

        {photos.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {photos.map((url, i) => (
              <li
                key={`${url}-${i}`}
                className="group relative aspect-square overflow-hidden rounded-xl border border-[#D4E4BC] bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`사진 ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  disabled={uploading || isPending}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-rose-300 bg-white/90 text-sm text-rose-600 shadow-sm disabled:opacity-50"
                  aria-label={`${i + 1}번째 사진 제거`}
                >
                  ✕
                </button>
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
              </li>
            ))}
          </ul>
        )}

        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || isPending}
            className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-sm font-bold text-[#2D5A3D] transition hover:border-[#2D5A3D] hover:bg-[#F5F1E8] disabled:opacity-50"
          >
            {uploading ? (
              <span className="inline-flex items-center gap-2">
                <span className="animate-pulse">⏳</span>
                {uploadStatus ?? "업로드 중..."}
              </span>
            ) : (
              <>📷 카메라로 찍기 / 사진 선택</>
            )}
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              void handleFileUpload(files);
            }
            e.target.value = "";
          }}
        />
      </section>

      {/* Caption */}
      {(requireCaption || photos.length > 0) && (
        <section className="rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
          <label
            htmlFor="mission-caption"
            className="flex items-center justify-between text-sm font-bold text-[#2D5A3D]"
          >
            <span>
              💬 한 줄 소감
              {requireCaption && (
                <span className="ml-1 text-rose-500">*</span>
              )}
            </span>
            <span className="text-[11px] font-normal text-[#8B7F75]">
              {caption.length}/200
            </span>
          </label>
          <textarea
            id="mission-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 200))}
            placeholder="오늘의 숲길에서 느낀 점을 짧게 남겨보세요"
            rows={3}
            maxLength={200}
            className="mt-2 w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </section>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="min-h-[56px] w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#3A7A52] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#B8C7B0] disabled:text-white/80"
      >
        {isPending
          ? "제출 중..."
          : <><AcornIcon /> +{mission.acorns} 도토리 받기 · 미션 완료</>}
      </button>
    </div>
  );
}
