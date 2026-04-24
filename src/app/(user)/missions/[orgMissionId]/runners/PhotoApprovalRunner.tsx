"use client";

// PHOTO_APPROVAL runner — 사진을 올려 검토 대기 → 운영자 승인/반려 플로우.
// PhotoRunner 와 비슷하지만 submission 상태가 PENDING_REVIEW 로 고정이고
// REJECTED 상태일 때만 재제출 허용. APPROVED 나 PENDING 이면 상태 패널 노출.

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compress";
import type {
  MissionSubmissionRow,
  OrgMissionRow,
  PhotoApprovalMissionConfig,
  PhotoApprovalSubmissionPayload,
} from "@/lib/missions/types";
import { SUBMISSION_STATUS_META } from "@/lib/missions/types";
import { submitMissionAction } from "../../actions";
import { AcornIcon } from "@/components/acorn-icon";

interface Props {
  mission: OrgMissionRow;
  config: PhotoApprovalMissionConfig;
  existing?: MissionSubmissionRow | null;
}

const BUCKET = "submission-photos";
const MAX_PHOTOS = 5;

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function PhotoApprovalRunner({ mission, config, existing }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const minPhotos = Math.max(1, config.min_photos ?? 1);
  const slaHours = Math.max(1, config.sla_hours ?? 24);

  // 상태별 UI 분기
  const isPendingReview =
    existing?.status === "PENDING_REVIEW" ||
    existing?.status === "SUBMITTED";
  const isApproved =
    existing?.status === "APPROVED" ||
    existing?.status === "AUTO_APPROVED";
  const isRejected = existing?.status === "REJECTED";
  const canResubmit = !existing || isRejected;

  const handleFileUpload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (list.length === 0) return;

      const remaining = MAX_PHOTOS - photos.length;
      if (remaining <= 0) {
        setErrorMsg(`최대 ${MAX_PHOTOS}장까지 올릴 수 있어요`);
        return;
      }
      const toProcess = list.slice(0, remaining);

      setUploading(true);
      setErrorMsg(null);

      const supabase = createClient();
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
          const rand = Math.random().toString(36).slice(2, 8);
          const path = `missions/${mission.id}/${Date.now()}-${rand}.jpg`;
          const { error } = await supabase.storage
            .from(BUCKET)
            .upload(path, compressed, {
              contentType: compressed.type,
              upsert: false,
            });
          if (error) throw error;
          const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
          uploaded.push(data.publicUrl);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[PhotoApprovalRunner] upload failed", msg);
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

  // 기존 제출물의 photo_urls, caption 뽑기 (PhotoApprovalSubmissionPayload)
  const existingPayload = (existing?.payload_json ?? {}) as Partial<
    PhotoApprovalSubmissionPayload
  >;
  const existingUrls = Array.isArray(existingPayload.photo_urls)
    ? existingPayload.photo_urls
    : [];
  const existingCaption =
    typeof existingPayload.caption === "string"
      ? existingPayload.caption
      : "";

  const canSubmit =
    !uploading &&
    !isPending &&
    photos.length >= minPhotos;

  return (
    <div className="space-y-4">
      {/* 미션 안내 */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span aria-hidden>🍃</span>
          미션 안내
        </h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#3D3A36]">
          {config.prompt || "자연물을 찾아 사진을 찍어 보내주세요"}
        </p>
        {minPhotos > 1 && (
          <p className="mt-2 text-[11px] font-semibold text-[#6B6560]">
            사진 {minPhotos}장 이상 필요
          </p>
        )}
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
          🔍 운영자가 확인 후 승인하면 도토리를 드려요 (최대 {slaHours}시간)
        </p>
      </section>

      {/* 기존 제출 상태 패널 */}
      {existing && (
        <section
          className={`rounded-3xl border p-4 shadow-sm ${SUBMISSION_STATUS_META[existing.status].color}`}
        >
          <div className="flex items-start gap-3">
            <p className="text-2xl" aria-hidden>
              {SUBMISSION_STATUS_META[existing.status].icon}
            </p>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                {SUBMISSION_STATUS_META[existing.status].label}
              </p>
              <p className="mt-0.5 text-[11px]">
                제출 시각: {formatDateTime(existing.submitted_at)}
              </p>
              {isPendingReview && (
                <p className="mt-2 text-[12px] font-semibold">
                  ⏳ 검토 대기중 (최대 {slaHours}시간 내 승인)
                </p>
              )}
              {existing.reject_reason && (
                <p className="mt-2 rounded-2xl bg-white/60 px-3 py-2 text-[12px]">
                  💬 반려 사유: {existing.reject_reason}
                </p>
              )}
              {isApproved && existing.awarded_acorns != null && (
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/60 px-3 py-1 text-[12px] font-bold">
                  <AcornIcon /> +{existing.awarded_acorns} 도토리 획득
                </p>
              )}
            </div>
          </div>

          {/* 기존 제출 사진 */}
          {existingUrls.length > 0 && (
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {existingUrls.map((url, i) => (
                <li
                  key={`${url}-${i}`}
                  className="aspect-square overflow-hidden rounded-xl border border-white/60 bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`제출 사진 ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
          {existingCaption && (
            <p className="mt-2 rounded-2xl bg-white/60 px-3 py-2 text-[12px]">
              💬 {existingCaption}
            </p>
          )}

          {isRejected && (
            <p className="mt-3 text-[11px] font-bold">
              아래에서 다시 제출할 수 있어요
            </p>
          )}
        </section>
      )}

      {/* 업로드 영역 (재제출 가능 상태일 때만) */}
      {canResubmit && (
        <>
          <section className="rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-[#2D5A3D]">
              📷 사진 ({photos.length}/{MAX_PHOTOS})
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

            {photos.length < MAX_PHOTOS && (
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

          {/* Caption (optional) */}
          <section className="rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
            <label
              htmlFor="mission-caption"
              className="flex items-center justify-between text-sm font-bold text-[#2D5A3D]"
            >
              <span>💬 한 줄 소감 (선택)</span>
              <span className="text-[11px] font-normal text-[#8B7F75]">
                {caption.length}/200
              </span>
            </label>
            <textarea
              id="mission-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 200))}
              placeholder="어떤 자연물을 찾았나요? 짧게 남겨보세요"
              rows={3}
              maxLength={200}
              className="mt-2 w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
            />
          </section>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
            >
              ⚠️ {errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="min-h-[56px] w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#3A7A52] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#B8C7B0] disabled:text-white/80"
          >
            {isPending
              ? "제출 중..."
              : isRejected
                ? "🔄 다시 제출하기"
                : "📤 검토 요청하기"}
          </button>
        </>
      )}
    </div>
  );
}
