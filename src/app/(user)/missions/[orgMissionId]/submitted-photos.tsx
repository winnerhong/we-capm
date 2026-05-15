"use client";

// 완료한 사진 미션의 결과 화면 — 제출된 사진 + 다시 찍기/사진 교체 버튼.
//
// "사진만 교체" 정책 — 도토리는 유지, 상태(AUTO_APPROVED 등)도 유지.
// 1장 미션은 "다시 찍기" 단일 액션(원샷 교체+자동저장),
// 2장 이상은 "사진 교체" 멀티 편집 모드.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  replaceMissionPhotosAction,
  uploadMissionPhotoAction,
} from "../actions";

type Props = {
  missionId: string;
  initialUrls: string[];
  initialCaption: string;
  minPhotos: number;
  maxPhotos: number;
};

export function SubmittedPhotos({
  missionId,
  initialUrls,
  initialCaption,
  minPhotos,
  maxPhotos,
}: Props) {
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>(initialUrls);
  const [caption, setCaption] = useState<string>(initialCaption);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [msg, setMsg] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // 1장 미션이면 "다시 찍기" 원샷 플로우 사용.
  const isSinglePhoto = maxPhotos <= 1 || initialUrls.length === 1;

  /* ──────────────────────────────────────────────── */
  /* 1장 미션: 다시 찍기 (원샷 교체 + 자동 저장)          */
  /* ──────────────────────────────────────────────── */
  async function handleRetake(files: FileList) {
    if (files.length === 0) return;
    const file = files[0];
    setUploading(true);
    setUploadStatus("업로드 중…");
    setMsg(null);
    const fd = new FormData();
    fd.set("file", file);
    const uploadResult = await uploadMissionPhotoAction(missionId, fd);
    if (!uploadResult.ok) {
      setUploading(false);
      setUploadStatus(null);
      setMsg({ kind: "error", text: uploadResult.error });
      return;
    }
    setUploadStatus("저장 중…");
    const result = await replaceMissionPhotosAction(missionId, {
      photo_urls: [uploadResult.url],
      caption: caption.trim() || undefined,
    });
    setUploading(false);
    setUploadStatus(null);
    if (result.ok) {
      setPhotos([uploadResult.url]);
      setMsg({ kind: "ok", text: "다시 찍은 사진으로 바꿨어요" });
      router.refresh();
    } else {
      setMsg({ kind: "error", text: result.error });
    }
  }

  /* ──────────────────────────────────────────────── */
  /* 2장+ 미션: 사진 교체 (멀티 편집)                    */
  /* ──────────────────────────────────────────────── */
  function startEdit() {
    setEditing(true);
    setMsg(null);
  }
  function cancelEdit() {
    setEditing(false);
    setPhotos(initialUrls);
    setCaption(initialCaption);
    setMsg(null);
  }

  async function handleMultiFileUpload(files: FileList) {
    setUploading(true);
    setMsg(null);
    const newUrls: string[] = [];
    let succeeded = 0;
    const total = files.length;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setUploadStatus(`업로드 중 ${i + 1}/${total}…`);
      const fd = new FormData();
      fd.set("file", f);
      const result = await uploadMissionPhotoAction(missionId, fd);
      if (result.ok) {
        newUrls.push(result.url);
        succeeded++;
      } else {
        setMsg({ kind: "error", text: result.error });
      }
    }
    setUploading(false);
    setUploadStatus(null);
    if (succeeded > 0) {
      setPhotos((prev) => {
        const merged = [...prev, ...newUrls];
        return merged.slice(0, maxPhotos);
      });
    }
  }

  function removePhoto(url: string) {
    setPhotos((prev) => prev.filter((u) => u !== url));
  }

  function handleSave() {
    if (photos.length < minPhotos) {
      setMsg({
        kind: "error",
        text: `사진을 ${minPhotos}장 이상 남겨주세요`,
      });
      return;
    }
    startTransition(async () => {
      const result = await replaceMissionPhotosAction(missionId, {
        photo_urls: photos,
        caption: caption.trim() || undefined,
      });
      if (result.ok) {
        setMsg({ kind: "ok", text: "사진을 바꿨어요" });
        setEditing(false);
        router.refresh();
      } else {
        setMsg({ kind: "error", text: result.error });
      }
    });
  }

  const canAddMore = photos.length < maxPhotos;

  /* ──────────────────────────────────────────────── */
  /* 렌더링                                            */
  /* ──────────────────────────────────────────────── */

  // 1장 미션 — 중앙 정렬 + 다시 찍기 단일 액션
  if (isSinglePhoto) {
    const url = photos[0] ?? initialUrls[0];
    return (
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="flex items-center justify-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span aria-hidden>🖼</span>
          제출한 사진
        </h2>

        {url ? (
          <div className="mt-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="제출한 사진"
              className="aspect-square w-full max-w-xs rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] object-cover shadow-sm"
              loading="lazy"
            />
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-3 py-4 text-center text-xs text-[#8B7F75]">
            제출된 사진을 찾을 수 없어요
          </p>
        )}

        {caption && (
          <p className="mt-3 rounded-xl bg-[#FFF8F0] px-3 py-2 text-center text-xs text-[#3D3A36]">
            💬 {caption}
          </p>
        )}

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#2D5A3D] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <>
                <span className="animate-pulse">⏳</span>
                {uploadStatus ?? "처리 중…"}
              </>
            ) : (
              <>📷 다시 찍기</>
            )}
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-[#8B7F75]">
          💡 사진만 바꿔도 도토리·승인 상태는 그대로 유지돼요.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              void handleRetake(files);
            }
            e.target.value = "";
          }}
        />

        {msg && (
          <p
            role={msg.kind === "error" ? "alert" : "status"}
            className={`mt-3 rounded-xl px-3 py-2 text-center text-xs font-semibold ${
              msg.kind === "error"
                ? "border border-rose-200 bg-rose-50 text-rose-800"
                : "border border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {msg.text}
          </p>
        )}
      </section>
    );
  }

  // 2장+ 미션 — 그리드 + 멀티 편집 모드
  return (
    <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span aria-hidden>🖼</span>
          제출한 사진 ({photos.length}장)
        </h2>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1 rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] px-3 py-1.5 text-xs font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#E8DDC8]"
          >
            <span aria-hidden>📷</span>
            <span>사진 교체</span>
          </button>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-3 py-4 text-center text-xs text-[#8B7F75]">
          제출된 사진을 찾을 수 없어요
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((url) => (
            <li
              key={url}
              className="group relative aspect-square overflow-hidden rounded-xl border border-[#D4E4BC] bg-[#FFF8F0]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="제출한 사진"
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {editing && (
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  aria-label="이 사진 제거"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white opacity-0 transition-opacity hover:bg-rose-600 group-hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {caption && !editing && (
        <p className="mt-3 rounded-xl bg-[#FFF8F0] px-3 py-2 text-xs text-[#3D3A36]">
          💬 {caption}
        </p>
      )}

      {editing && (
        <div className="mt-4 space-y-3">
          {canAddMore && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || isPending}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm font-bold text-[#2D5A3D] transition hover:border-[#2D5A3D] hover:bg-[#F5F1E8] disabled:opacity-50"
            >
              {uploading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-pulse">⏳</span>
                  {uploadStatus ?? "업로드 중..."}
                </span>
              ) : (
                <>📷 카메라로 찍기</>
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
                void handleMultiFileUpload(files);
              }
              e.target.value = "";
            }}
          />

          <div>
            <label
              htmlFor="caption"
              className="block text-xs font-bold text-[#2D5A3D]"
            >
              한 줄 소감 (선택)
            </label>
            <textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="짧게 남겨보세요"
              className="mt-1 w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#3D3A36] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
            />
          </div>

          <p className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            💡 사진만 바꿔도 도토리·승인 상태는 그대로 유지돼요. 더 잘 나온
            사진으로 바꿔보세요.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isPending || uploading}
              className="flex-1 rounded-2xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-bold text-[#6B6560] transition hover:bg-[#FFF8F0] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || uploading || photos.length < minPhotos}
              className="flex-1 rounded-2xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52] disabled:opacity-50"
            >
              {isPending ? "저장 중..." : "💾 저장"}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p
          role={msg.kind === "error" ? "alert" : "status"}
          className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${
            msg.kind === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {msg.text}
        </p>
      )}
    </section>
  );
}
