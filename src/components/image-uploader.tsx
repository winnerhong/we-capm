"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compress";

interface Props {
  name: string;
  defaultValue?: string;
  label?: string;
  bucket?: string;
  folder?: string;
  maxKb?: number;
  hint?: string;
}

export function ImageUploader({
  name,
  defaultValue = "",
  label,
  bucket = "event-assets",
  folder = "trails",
  maxKb = 500,
  hint,
}: Props) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setStatus("이미지 파일만 업로드 가능합니다");
        setTimeout(() => setStatus(""), 3000);
        return;
      }
      setBusy(true);
      try {
        setStatus(`압축 중... (원본 ${Math.round(file.size / 1024)}KB)`);
        const compressed = await compressImage(file, { maxKb });

        setStatus(`업로드 중... (${Math.round(compressed.size / 1024)}KB)`);
        const supabase = createClient();
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
        setUrl(data.publicUrl);
        setStatus(`✅ 완료 (${Math.round(compressed.size / 1024)}KB)`);
        setTimeout(() => setStatus(""), 3000);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(`❌ 오류: ${msg}`);
        setTimeout(() => setStatus(""), 6000);
      } finally {
        setBusy(false);
      }
    },
    [bucket, folder, maxKb]
  );

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const active = document.activeElement;
      if (!containerRef.current?.contains(active) && active !== containerRef.current)
        return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void upload(file);
            return;
          }
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [upload]);

  return (
    <div>
      {label && (
        <label className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
          {label}
        </label>
      )}
      <input type="hidden" name={name} value={url} />

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
          const f = e.dataTransfer.files[0];
          if (f) void upload(f);
        }}
        className={`rounded-2xl border-2 border-dashed p-5 text-center transition-colors outline-none focus:ring-2 focus:ring-[#2D5A3D]/30 ${
          dragOver
            ? "border-[#2D5A3D] bg-[#E8F0E4]"
            : "border-[#D4E4BC] bg-[#FFF8F0]"
        }`}
      >
        {url ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="미리보기"
              className="mx-auto max-h-60 rounded-xl object-cover"
            />
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8] disabled:opacity-50"
              >
                📷 이미지 변경
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrl("");
                  setStatus("");
                }}
                disabled={busy}
                className="rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                🗑️ 제거
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-4">
            <div className="text-4xl" aria-hidden>
              📷
            </div>
            <p className="text-sm font-semibold text-[#2D5A3D]">
              클릭하거나 이미지를 드래그 · 붙여넣기 (Ctrl+V)
            </p>
            <p className="text-[11px] text-[#8B7F75]">
              자동 리사이즈 · 최대 {maxKb}KB · JPG/PNG/WebP
              {hint ? ` · ${hint}` : ""}
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3A7A52] disabled:opacity-50"
            >
              파일 선택
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />

        {status && (
          <p
            className={`mt-3 text-xs ${
              busy ? "text-[#8B6B3F]" : "text-[#2D5A3D]"
            }`}
          >
            {busy && <span className="mr-1 inline-block animate-pulse">⏳</span>}
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
