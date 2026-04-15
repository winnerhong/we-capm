"use client";

import { useState, useTransition, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { approveSubmissionAction, rejectSubmissionAction } from "./actions";

interface Props {
  eventId: string;
  submission: {
    id: string;
    status: string;
    photo_urls: string[];
    text_content: string | null;
    submitted_at: string;
    reject_reason: string | null;
  };
  missionTitle: string;
  missionType: string;
  missionPoints: number;
  participantName: string;
}

export function SubmissionCard({
  eventId,
  submission,
  missionTitle,
  missionType,
  missionPoints,
  participantName,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [photoSignedUrls, setPhotoSignedUrls] = useState<string[]>([]);

  useEffect(() => {
    if (submission.photo_urls.length === 0) return;
    const supabase = createClient();
    Promise.all(
      submission.photo_urls.map((path) =>
        supabase.storage.from("submission-photos").createSignedUrl(path, 3600)
      )
    ).then((results) => {
      setPhotoSignedUrls(results.map((r) => r.data?.signedUrl ?? ""));
    });
  }, [submission.photo_urls]);

  const isPending = submission.status === "PENDING";

  return (
    <li className="rounded-lg border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{missionTitle}</span>
            <span className="text-sm text-violet-600">{missionPoints}점</span>
          </div>
          <div className="text-xs text-neutral-500">
            {participantName} · {new Date(submission.submitted_at).toLocaleString("ko-KR")}
          </div>
        </div>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{submission.status}</span>
      </div>

      {submission.text_content && (
        <div className="rounded bg-neutral-50 p-3 text-sm">{submission.text_content}</div>
      )}

      {photoSignedUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photoSignedUrls.map((url, i) =>
            url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`photo ${i}`}
                className="aspect-square w-full rounded object-cover"
              />
            ) : null
          )}
        </div>
      )}

      {submission.reject_reason && (
        <div className="text-sm text-red-600">반려 사유: {submission.reject_reason}</div>
      )}

      {isPending && (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await approveSubmissionAction(eventId, submission.id);
                });
              }}
              className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              승인
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowReject(!showReject)}
              className="flex-1 rounded-lg border border-red-300 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              반려
            </button>
          </div>

          {showReject && (
            <div className="space-y-2">
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="반려 사유 (선택)"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    await rejectSubmissionAction(eventId, submission.id, reason);
                    setShowReject(false);
                    setReason("");
                  });
                }}
                className="w-full rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                반려 확정
              </button>
            </div>
          )}
        </>
      )}
    </li>
  );
}
