"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitVideoAction } from "../actions";

interface Props {
  eventId: string;
  missionId: string;
  participantId: string;
  maxDurationSec: number;
}

export function VideoForm({ eventId, missionId, participantId, maxDurationSec }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError(null);

    startTransition(async () => {
      try {
        const supabase = createClient();
        const ext = file.name.split(".").pop() ?? "mp4";
        const folderId = crypto.randomUUID();
        const path = `${eventId}/${participantId}/${folderId}/video.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("submission-videos")
          .upload(path, file, { contentType: file.type });

        if (upErr) throw upErr;
        setProgress(100);

        await submitVideoAction(eventId, missionId, path);
        router.push(`/event/${eventId}/missions?result=pending`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "업로드 실패");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-6">
      <div>
        <label htmlFor="video" className="mb-1 block text-sm font-medium">
          영상 선택 (최대 {maxDurationSec}초)
        </label>
        <input
          id="video"
          type="file"
          accept="video/*"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      {file && <p className="text-xs">{file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)</p>}

      {pending && progress > 0 && (
        <div className="h-2 overflow-hidden rounded bg-neutral-200">
          <div className="h-full bg-violet-600" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || !file}
        className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {pending ? "업로드 중..." : "제출"}
      </button>
    </form>
  );
}
