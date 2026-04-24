"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compress";

interface Props {
  partnerId: string;
  docType: string;
  /** 최대 파일 크기 (MB). 기본 5 */
  maxMb?: number;
}

type UploadedFile = {
  path: string;
  name: string;
  size: number;
  mime: string;
  /** 이미지일 때만 */
  previewUrl?: string;
};

const BUCKET = "partner-documents";
const ACCEPT_MIME =
  "application/pdf,image/jpeg,image/png,image/webp,image/jpg";

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function extFromMime(mime: string, fallbackName: string) {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  // fallback: from name
  const m = fallbackName.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "bin";
}

export function DocFileUploader({ partnerId, docType, maxMb = 5 }: Props) {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const maxBytes = maxMb * 1024 * 1024;

  const uploadFile = useCallback(
    async (incoming: File) => {
      setErr(null);
      const isPdf = incoming.type === "application/pdf";
      const isImage = incoming.type.startsWith("image/");

      if (!isPdf && !isImage) {
        setErr("PDF · JPG · PNG · WebP만 업로드 가능해요");
        return;
      }
      if (incoming.size > maxBytes && !isImage) {
        // PDF는 리사이즈 불가 — 크기 초과 즉시 에러
        setErr(`파일이 ${maxMb}MB를 초과했어요 (${fmtSize(incoming.size)})`);
        return;
      }

      setBusy(true);
      setProgress(10);

      try {
        // 이미지면 500KB로 압축, PDF는 그대로
        const finalFile = isImage
          ? await compressImage(incoming, { maxKb: 500 })
          : incoming;

        setProgress(40);

        // 압축 후에도 초과면 에러
        if (finalFile.size > maxBytes) {
          setErr(`압축 후에도 ${maxMb}MB 초과 (${fmtSize(finalFile.size)})`);
          setBusy(false);
          setProgress(0);
          return;
        }

        const supabase = createClient();
        const rand = Math.random().toString(36).slice(2, 10);
        const ext = extFromMime(finalFile.type, incoming.name);
        const ts = Date.now();
        const path = `${partnerId}/${docType}/${ts}-${rand}.${ext}`;

        setProgress(60);

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, finalFile, {
            contentType: finalFile.type,
            upsert: false,
          });

        if (upErr) {
          console.error("[DocFileUploader] upload failed", upErr);
          setErr(`업로드 실패: ${upErr.message}`);
          setBusy(false);
          setProgress(0);
          return;
        }

        setProgress(85);

        // 미리보기용 signed URL (이미지일 때만)
        let previewUrl: string | undefined;
        if (isImage) {
          const { data: signed } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(path, 3600);
          previewUrl = signed?.signedUrl;
        }

        setFile({
          path,
          name: incoming.name,
          size: finalFile.size,
          mime: finalFile.type,
          previewUrl,
        });
        setProgress(100);
      } catch (e) {
        console.error("[DocFileUploader] error", e);
        setErr(e instanceof Error ? e.message : "업로드 중 문제 발생");
      } finally {
        setBusy(false);
        setTimeout(() => setProgress(0), 600);
      }
    },
    [partnerId, docType, maxBytes, maxMb]
  );

  // 붙여넣기 지원
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const active = document.activeElement;
      if (!containerRef.current?.contains(active) && active !== containerRef.current)
        return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/") || item.type === "application/pdf") {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            void uploadFile(f);
            return;
          }
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [uploadFile]);

  const reset = () => {
    setFile(null);
    setErr(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      {/* 폼 제출용 hidden inputs */}
      {file && (
        <>
          <input type="hidden" name="file_url" value={file.path} />
          <input type="hidden" name="file_name" value={file.name} />
          <input type="hidden" name="file_size" value={String(file.size)} />
          <input type="hidden" name="mime_type" value={file.mime} />
        </>
      )}

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
          const f = e.dataTransfer.files?.[0];
          if (f) void uploadFile(f);
        }}
        className={`rounded-2xl border-2 border-dashed p-4 outline-none transition focus:ring-2 focus:ring-[#2D5A3D]/30 ${
          dragOver
            ? "border-[#2D5A3D] bg-[#E8F0E4]"
            : file
              ? "border-[#4A7C59] bg-white"
              : "border-[#D4E4BC] bg-[#FFF8F0]"
        }`}
      >
        {!file ? (
          <div className="space-y-3 py-6 text-center">
            <div className="text-4xl" aria-hidden>
              📤
            </div>
            <div>
              <p className="text-sm font-semibold text-[#2D5A3D]">
                파일을 선택하거나 여기로 드래그하세요
              </p>
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                PDF · JPG · PNG · WebP · 최대 {maxMb}MB · Ctrl+V 붙여넣기 가능
              </p>
              <p className="mt-0.5 text-[11px] text-[#8B7F75]">
                이미지는 자동으로 500KB 이하로 압축돼요
              </p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="rounded-xl bg-[#2D5A3D] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3A7A52] disabled:opacity-60"
            >
              {busy ? "업로드 중…" : "📁 파일 선택"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D4E4BC] bg-[#FFF8F0]">
              {file.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.previewUrl}
                  alt="미리보기"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-4xl" aria-hidden>
                  📄
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#2D5A3D]">
                {file.name}
              </p>
              <p className="mt-0.5 text-xs text-[#6B6560]">
                {fmtSize(file.size)} ·{" "}
                {file.mime === "application/pdf" ? "PDF" : "이미지"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
                >
                  🔄 변경
                </button>
                {file.previewUrl && (
                  <a
                    href={file.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
                  >
                    🔍 원본 보기
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {busy && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E8F0E4]">
              <div
                className="h-full bg-gradient-to-r from-[#2D5A3D] to-[#4A7C59] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-center text-[11px] text-[#6B6560]">
              업로드 중… {progress}%
            </p>
          </div>
        )}

        {err && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            ⚠️ {err}
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_MIME}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
