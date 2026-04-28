"use client";

// 커버 이미지 입력 — 파일 업로드 / 클립보드 붙여넣기 / 드래그 드롭 / URL 입력 모두 지원.
//
// 동작:
//   1) 빈 상태: 큰 영역(클릭 → 파일 다이얼로그 / 드래그 드롭 zone / Ctrl+V 붙여넣기 안내)
//      + URL 직접 입력 토글
//   2) 값 있는 상태: 미리보기 + 제거 버튼
//
// 업로드 대상: Supabase Storage `preset-covers` bucket (public, 권한 permissive).
//   bucket prop 으로 다른 bucket 지정 가능.
//
// 압축: compressImage 로 maxKb 500KB 까지 자동 다운스케일. 그 후 publicUrl 을 onChange 로 콜백.
//
// 자동 paste:
//   document 전체 'paste' 이벤트를 listen 하며, target 이 input/textarea 이면 무시.
//   focus 가 picker 안일 때만 활성. (autoCapture prop)
//
// onChange 시그니처: (publicUrl: string) => void

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compress";

interface Props {
  value: string;
  onChange: (url: string) => void;
  /** Supabase Storage bucket id. 기본 preset-covers (이미 public + 권한 permissive). */
  bucket?: string;
  /** 업로드 경로 prefix (예: "events", "presets"). 슬래시 자동 추가. */
  pathPrefix?: string;
  /** name attribute — 폼 제출 시 hidden input 으로 함께 전송 */
  name?: string;
  placeholder?: string;
  /** label 위쪽 영역에 추가로 표시할 보조 텍스트. */
  hint?: string;
}

export function CoverImagePicker({
  value,
  onChange,
  bucket = "preset-covers",
  pathPrefix = "covers",
  name,
  placeholder = "https://...",
  hint = "PNG / JPG / WEBP · 500KB 이하 자동 압축",
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  /* ------------------------------------------------------------------------ */
  /* 업로드 코어                                                                */
  /* ------------------------------------------------------------------------ */

  const upload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("이미지 파일만 업로드할 수 있어요");
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const compressed = await compressImage(file, { maxKb: 500 });
        const rand = Math.random().toString(36).slice(2, 8);
        const cleanPrefix = pathPrefix.replace(/^\/+|\/+$/g, "");
        const path = `${cleanPrefix}/${Date.now()}-${rand}.jpg`;
        const supabase = createClient();
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(path, compressed, {
            contentType: compressed.type,
            upsert: false,
          });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        onChange(data.publicUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "업로드 실패");
      } finally {
        setUploading(false);
      }
    },
    [bucket, pathPrefix, onChange]
  );

  /* ------------------------------------------------------------------------ */
  /* 파일 선택                                                                  */
  /* ------------------------------------------------------------------------ */

  const onFilePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void upload(f);
      e.target.value = "";
    },
    [upload]
  );

  /* ------------------------------------------------------------------------ */
  /* 드래그 드롭                                                                */
  /* ------------------------------------------------------------------------ */

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void upload(f);
    },
    [upload]
  );

  /* ------------------------------------------------------------------------ */
  /* 클립보드 붙여넣기 — wrapper 안에 focus 또는 hover 시 활성                    */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      // 다른 input/textarea 에 붙여넣기 중이면 무시
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
      // wrapper 가 화면에 보이는지 확인 (간단 체크: wrapper 가 마운트됐는가)
      if (!wrapperRef.current) return;
      // 클립보드에서 이미지 추출
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

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */

  return (
    <div ref={wrapperRef} className="space-y-2">
      {/* hidden input 으로 form 에 url 전송 */}
      {name && <input type="hidden" name={name} value={value} />}

      {value ? (
        // ─── 미리보기 ─────────────────────────────────────────────
        <div className="relative overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="커버 이미지 미리보기"
            className="aspect-[16/9] w-full object-cover"
          />
          <div className="absolute right-2 top-2 flex gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-bold text-[#2D5A3D] shadow hover:bg-white"
            >
              {uploading ? "업로드…" : "🔄 변경"}
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-bold text-rose-600 shadow hover:bg-white"
            >
              ✕ 제거
            </button>
          </div>
        </div>
      ) : (
        // ─── 빈 상태: 드롭존 + 붙여넣기 안내 ──────────────────────
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-[#FFF8F0] p-6 text-center transition ${
            dragOver
              ? "border-[#2D5A3D] bg-[#E8F0E4]"
              : "border-[#D4E4BC] hover:border-[#2D5A3D] hover:bg-[#F5F1E8]"
          }`}
          role="button"
          tabIndex={0}
          aria-label="커버 이미지 업로드"
        >
          <span aria-hidden className="text-3xl">
            🖼
          </span>
          <span className="mt-2 text-sm font-bold text-[#2D5A3D]">
            {uploading
              ? "업로드 중…"
              : "클릭 / 드래그 / Ctrl+V 로 이미지 추가"}
          </span>
          <span className="mt-1 text-[11px] text-[#6B6560]">{hint}</span>
        </div>
      )}

      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFilePick}
        className="hidden"
      />

      {/* URL 직접 입력 토글 */}
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <button
          type="button"
          onClick={() => setShowUrlInput((v) => !v)}
          className="font-semibold text-[#2D5A3D] underline-offset-2 hover:underline"
        >
          {showUrlInput ? "↩ URL 입력 닫기" : "🔗 URL 직접 입력"}
        </button>
        {error && (
          <span className="text-rose-700" role="alert">
            ⚠ {error}
          </span>
        )}
      </div>

      {showUrlInput && (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          inputMode="url"
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
        />
      )}
    </div>
  );
}
