"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compress";
import type {
  BroadcastMissionConfig,
  MissionBroadcastRow,
  MissionSubmissionRow,
  OrgMissionRow,
} from "@/lib/missions/types";
import { submitMissionAction } from "../../actions";
import { Countdown } from "./Countdown";
import { AcornIcon } from "@/components/acorn-icon";

const BUCKET = "submission-photos";

interface Props {
  mission: OrgMissionRow;
  config: BroadcastMissionConfig;
  broadcast: MissionBroadcastRow;
  existing: MissionSubmissionRow | null;
}

export function BroadcastRunner({
  mission,
  config,
  broadcast,
  existing,
}: Props) {
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const submissionKind = config.submission_kind ?? "PHOTO";
  const maxTextLen = 500;

  const alreadySubmitted = useMemo(() => {
    if (!existing) return false;
    const activeStatus =
      existing.status === "AUTO_APPROVED" ||
      existing.status === "APPROVED" ||
      existing.status === "SUBMITTED" ||
      existing.status === "PENDING_REVIEW";
    if (!activeStatus) return false;
    // 이전 broadcast 에 대한 제출이면 무시 — 현재 broadcast_id 와 일치해야 함
    const payload = existing.payload_json as { broadcast_id?: unknown };
    return payload.broadcast_id === broadcast.id;
  }, [existing, broadcast.id]);

  const isExpired = new Date(broadcast.expires_at).getTime() <= Date.now();

  const handlePhotoUpload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (list.length === 0) return;
      const file = list[0];

      setUploading(true);
      setErrorMsg(null);
      setUploadStatus("압축 중...");

      try {
        const compressed = await compressImage(file, { maxKb: 500 });
        setUploadStatus("업로드 중...");
        const supabase = createClient();
        const rand = Math.random().toString(36).slice(2, 8);
        const path = `broadcasts/${broadcast.id}/${Date.now()}-${rand}.jpg`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, compressed, {
            contentType: compressed.type,
            upsert: false,
          });
        if (error) throw error;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        setPhotoUrl(data.publicUrl);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(`업로드 실패: ${msg}`);
      } finally {
        setUploading(false);
        setUploadStatus(null);
      }
    },
    [broadcast.id]
  );

  const handleSubmit = () => {
    if (submissionKind === "PHOTO") {
      if (!photoUrl) {
        setErrorMsg("사진을 업로드해 주세요");
        return;
      }
    } else {
      if (text.trim().length === 0) {
        setErrorMsg("내용을 입력해 주세요");
        return;
      }
    }

    setErrorMsg(null);
    startTransition(async () => {
      try {
        const content =
          submissionKind === "PHOTO" ? (photoUrl ?? "") : text.trim();
        const result = await submitMissionAction(mission.id, {
          broadcast_id: broadcast.id,
          content_type: submissionKind,
          content,
        });
        if (result.redirectTo) {
          router.push(result.redirectTo);
          router.refresh();
        } else {
          router.refresh();
        }
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : String(e));
      }
    });
  };

  /* ---------------- Render ---------------- */

  // 이미 제출됨
  if (alreadySubmitted && existing) {
    return (
      <div className="space-y-4">
        <section className="relative overflow-hidden rounded-3xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-amber-50 p-5 shadow-sm">
          <p className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
            ⚡ 돌발 미션
          </p>
          <h2 className="mt-2 text-lg font-bold text-emerald-900">
            ✅ 참여 완료!
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-emerald-900/80">
            {broadcast.prompt_snapshot}
          </p>
          {existing.awarded_acorns != null && existing.awarded_acorns > 0 && (
            <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-emerald-800">
              <AcornIcon size={18} /> +{existing.awarded_acorns} 도토리 획득
            </p>
          )}
        </section>
        <a
          href="/broadcasts"
          className="block w-full rounded-2xl border-2 border-rose-300 bg-white px-4 py-3 text-center text-sm font-bold text-rose-700 transition hover:bg-rose-50"
        >
          ⚡ 다른 돌발 미션 보기 →
        </a>
      </div>
    );
  }

  // 만료됨 + 미제출
  if (isExpired) {
    return (
      <div className="space-y-4">
        <section className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5 text-center shadow-sm">
          <p className="text-5xl" aria-hidden>
            ⚰️
          </p>
          <h2 className="mt-2 text-base font-bold text-zinc-700">
            시간이 다 됐어요
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            이 돌발 미션은 종료되었어요
          </p>
        </section>
        <a
          href="/broadcasts"
          className="block w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52]"
        >
          ⚡ 진행 중인 돌발 미션 보기
        </a>
      </div>
    );
  }

  // 참여 UI (긴급 스타일)
  return (
    <div className="space-y-4">
      {/* 프롬프트 */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 via-amber-50 to-rose-50 p-5 shadow-lg">
        <div
          className="pointer-events-none absolute inset-0 animate-pulse bg-rose-400/5"
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2.5 w-2.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-rose-700">
              LIVE · 돌발 미션
            </p>
            <span className="ml-auto">
              <Countdown expiresAt={broadcast.expires_at} urgentSec={30} />
            </span>
          </div>
          <h2 className="mt-3 text-lg font-bold text-rose-900">
            ⚡ {mission.title}
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-rose-900/90">
            {broadcast.prompt_snapshot}
          </p>
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold text-amber-800">
            <AcornIcon className="text-amber-700" /> +{mission.acorns}
          </p>
        </div>
      </section>

      {/* 제출 입력 */}
      {submissionKind === "PHOTO" ? (
        <section className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-rose-900">📷 사진 한 장</h3>

          {photoUrl ? (
            <div className="mt-3 space-y-2">
              <div className="relative overflow-hidden rounded-2xl border border-rose-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt="업로드한 사진"
                  className="h-auto w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  disabled={isPending}
                  className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border border-rose-300 bg-white/90 text-sm text-rose-600 shadow-sm disabled:opacity-50"
                  aria-label="사진 제거"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || isPending}
              className="mt-3 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50/50 px-4 py-3 text-base font-bold text-rose-800 transition hover:border-rose-500 hover:bg-rose-50 disabled:opacity-50"
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
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) {
                void handlePhotoUpload(files);
              }
              e.target.value = "";
            }}
          />
        </section>
      ) : (
        <section className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm">
          <label
            htmlFor="bc-text"
            className="flex items-center justify-between text-sm font-bold text-rose-900"
          >
            <span>✍️ 지금 바로 답변</span>
            <span className="text-[11px] font-normal text-rose-700/70">
              {text.length}/{maxTextLen}
            </span>
          </label>
          <textarea
            id="bc-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, maxTextLen))}
            placeholder="지금 떠오르는 답을 짧게 적어보세요"
            rows={4}
            maxLength={maxTextLen}
            className="mt-2 w-full rounded-2xl border border-rose-200 bg-rose-50/40 px-3 py-2 text-sm text-rose-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-400/30"
          />
        </section>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900"
        >
          ⚠️ {errorMsg}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={
          isPending ||
          uploading ||
          (submissionKind === "PHOTO" ? !photoUrl : text.trim().length === 0)
        }
        className="min-h-[56px] w-full rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 px-4 py-3 text-base font-bold text-white shadow-lg transition hover:from-rose-700 hover:to-amber-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-zinc-300 disabled:to-zinc-300"
      >
        {isPending
          ? "제출 중..."
          : <>⚡ 지금 제출 · <AcornIcon /> +{mission.acorns} 받기</>}
      </button>
    </div>
  );
}
