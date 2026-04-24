"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compress";

interface Props {
  name: string;
  defaultValues?: string[];
  label?: string;
  bucket?: string;
  folder?: string;
  maxKb?: number;
  maxImages?: number;
  hint?: string;
}

export function MultiImageUploader({
  name,
  defaultValues = [],
  label,
  bucket = "event-assets",
  folder = "trails/gallery",
  maxKb = 500,
  maxImages = 10,
  hint,
}: Props) {
  const [urls, setUrls] = useState<string[]>(defaultValues.filter(Boolean));
  const [dragOver, setDragOver] = useState(false);
  const [processingCount, setProcessingCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      const remaining = maxImages - urls.length;
      if (remaining <= 0) {
        setErrorMsg(`최대 ${maxImages}장까지 업로드 가능합니다`);
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      const toProcess = imageFiles.slice(0, remaining);
      if (imageFiles.length > remaining) {
        setErrorMsg(
          `최대 ${maxImages}장 — ${toProcess.length}장만 업로드합니다 (${imageFiles.length - remaining}장 초과)`
        );
      } else {
        setErrorMsg(null);
      }

      setProcessingCount(toProcess.length);
      setDoneCount(0);

      const supabase = createClient();
      // 병렬 업로드 (최대 3개씩 batch 해도 되지만 단순하게 Promise.allSettled)
      const uploadOne = async (file: File): Promise<string | null> => {
        try {
          const compressed = await compressImage(file, { maxKb });
          const rand = Math.random().toString(36).slice(2, 8);
          const path = `${folder}/${Date.now()}-${rand}.jpg`;
          const { error } = await supabase.storage
            .from(bucket)
            .upload(path, compressed, {
              contentType: compressed.type,
              upsert: false,
            });
          if (error) throw error;
          const { data } = supabase.storage.from(bucket).getPublicUrl(path);
          return data.publicUrl;
        } catch (e) {
          console.error("[MultiImageUploader] upload failed", e);
          return null;
        }
      };

      // 순차로 진행하면서 카운터 업데이트
      const results: string[] = [];
      for (const f of toProcess) {
        const u = await uploadOne(f);
        if (u) {
          results.push(u);
          setUrls((prev) => [...prev, u]);
        }
        setDoneCount((c) => c + 1);
      }

      setProcessingCount(0);
      setDoneCount(0);
      const failed = toProcess.length - results.length;
      if (failed > 0) {
        setErrorMsg(`${failed}장 업로드 실패`);
        setTimeout(() => setErrorMsg(null), 5000);
      }
    },
    [bucket, folder, maxKb, maxImages, urls.length]
  );

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const active = document.activeElement;
      if (!containerRef.current?.contains(active) && active !== containerRef.current)
        return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        void uploadFiles(files);
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [uploadFiles]);

  const removeAt = (idx: number) => {
    setUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const isBusy = processingCount > 0;
  const canAddMore = urls.length < maxImages;

  return (
    <div>
      {label && (
        <p className="mb-1 text-xs font-semibold text-[#2D5A3D]">{label}</p>
      )}

      {/* 숨김 inputs (form submit 시 name="images" 반복) */}
      {urls.map((u, i) => (
        <input key={`${u}-${i}`} type="hidden" name={name} value={u} />
      ))}

      <div
        ref={containerRef}
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length) void uploadFiles(files);
        }}
        className={`rounded-2xl border-2 border-dashed p-3 outline-none focus:ring-2 focus:ring-[#2D5A3D]/30 ${
          dragOver
            ? "border-[#2D5A3D] bg-[#E8F0E4]"
            : "border-[#D4E4BC] bg-[#FFF8F0]"
        }`}
      >
        {urls.length === 0 && !isBusy ? (
          <div className="space-y-2 py-6 text-center">
            <div className="text-4xl" aria-hidden>
              📷
            </div>
            <p className="text-sm font-semibold text-[#2D5A3D]">
              여러 장 선택 · 드래그 · Ctrl+V로 붙여넣기
            </p>
            <p className="text-[11px] text-[#8B7F75]">
              자동 {maxKb}KB 리사이즈 · JPG/PNG/WebP · 최대 {maxImages}장
              {hint ? ` · ${hint}` : ""}
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3A7A52]"
            >
              📁 폴더에서 여러 장 선택
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {urls.map((u, i) => (
                <div
                  key={`${u}-${i}`}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-[#D4E4BC] bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={`${i + 1}번째`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-rose-300 bg-white/90 text-xs text-rose-600 opacity-0 transition group-hover:opacity-100"
                    aria-label="제거"
                    title="제거"
                  >
                    ✕
                  </button>
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                </div>
              ))}

              {canAddMore && !isBusy && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-[#D4E4BC] bg-white text-2xl text-[#6B6560] transition hover:border-[#2D5A3D] hover:bg-[#F5F1E8] hover:text-[#2D5A3D]"
                  title="더 추가"
                >
                  +
                </button>
              )}

              {isBusy &&
                Array.from({ length: processingCount - doneCount }).map((_, i) => (
                  <div
                    key={`pending-${i}`}
                    className="flex aspect-square animate-pulse items-center justify-center rounded-lg border border-[#D4E4BC] bg-[#F5F1E8] text-2xl"
                  >
                    ⏳
                  </div>
                ))}
            </div>
          </>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) void uploadFiles(files);
            e.target.value = "";
          }}
        />

        {/* 상태 표시 */}
        {(isBusy || errorMsg || urls.length > 0) && (
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className={errorMsg ? "text-rose-600" : "text-[#6B6560]"}>
              {errorMsg ??
                (isBusy
                  ? `⏳ ${doneCount}/${processingCount} 업로드 중...`
                  : `✅ ${urls.length}장 업로드됨 / 최대 ${maxImages}장`)}
            </span>
            {urls.length > 0 && !isBusy && canAddMore && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-md border border-[#D4E4BC] bg-white px-2 py-1 text-[10px] font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
              >
                📁 더 추가
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
