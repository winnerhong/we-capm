"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitPhotoAction } from "../actions";

interface Props {
  eventId: string;
  missionId: string;
  participantId: string;
  config: { minPhotos?: number; maxPhotos?: number };
}

export function PhotoForm({ eventId, missionId, participantId, config }: Props) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const minPhotos = config.minPhotos ?? 1;
  const maxPhotos = config.maxPhotos ?? 3;

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const selected = Array.from(list).slice(0, maxPhotos);
    setFiles(selected);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (files.length < minPhotos) {
      setError(`최소 ${minPhotos}장 필요합니다`);
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const urls: string[] = [];
        const hashes: string[] = [];
        const submissionFolderId = crypto.randomUUID();

        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          const buf = await file.arrayBuffer();
          const digest = await crypto.subtle.digest("SHA-256", buf);
          const hash = Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          hashes.push(hash);

          const ext = file.name.split(".").pop() ?? "jpg";
          const path = `${eventId}/${participantId}/${submissionFolderId}/${i}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from("submission-photos")
            .upload(path, file, { contentType: file.type });

          if (upErr) throw upErr;
          urls.push(path);
          setProgress(Math.round(((i + 1) / files.length) * 100));
        }

        const result = await submitPhotoAction(eventId, missionId, urls, hashes);
        if (result && !result.ok) {
          setError(result.message ?? "중복 사진이 감지되었습니다");
          return;
        }
        router.push(`/event/${eventId}/missions?result=pending`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "업로드 실패");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-6">
      <div>
        <label htmlFor="photos" className="mb-1 block text-sm font-medium">
          사진 선택 ({minPhotos}~{maxPhotos}장)
        </label>
        <input
          id="photos"
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={(e) => handleFiles(e.target.files)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
        {files.length > 0 && (
          <p className="mt-2 text-xs text-neutral-500">{files.length}장 선택됨</p>
        )}
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {files.map((file, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={URL.createObjectURL(file)}
              alt={`preview ${i}`}
              className="aspect-square w-full rounded object-cover"
            />
          ))}
        </div>
      )}

      {pending && progress > 0 && (
        <div className="h-2 overflow-hidden rounded bg-neutral-200">
          <div className="h-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || files.length === 0}
        className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {pending ? "업로드 중..." : "제출"}
      </button>
    </form>
  );
}
