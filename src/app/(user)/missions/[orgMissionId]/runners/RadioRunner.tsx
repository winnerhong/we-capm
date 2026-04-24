"use client";

// RADIO runner — 신청곡 + 사연 제출 폼. 기관 운영자 승인 → 토리FM 방송 대기열.
// 제출 후 상태에 따라 메시지 분기.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  MissionSubmissionRow,
  OrgMissionRow,
  RadioMissionConfig,
  RadioSubmissionPayload,
} from "@/lib/missions/types";
import { submitMissionAction } from "../../actions";

interface Props {
  mission: OrgMissionRow;
  config: RadioMissionConfig;
  existing?: MissionSubmissionRow | null;
  kids?: Array<{ id: string; name: string }>;
  /** 연결된 큐의 played_at (있으면 오늘 방송된 것) */
  playedAt?: string | null;
}

export function RadioRunner({
  mission,
  config,
  existing,
  kids: childOptions,
  playedAt,
}: Props) {
  const router = useRouter();
  const [songTitle, setSongTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [childName, setChildName] = useState("");
  const [storyText, setStoryText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const maxLength = Math.max(20, Math.min(2000, config.max_length ?? 300));

  const isPendingReview =
    existing?.status === "PENDING_REVIEW" ||
    existing?.status === "SUBMITTED";
  const isApproved =
    existing?.status === "APPROVED" ||
    existing?.status === "AUTO_APPROVED";
  const wasPlayed = Boolean(playedAt);

  const existingPayload = (existing?.payload_json ?? {}) as Partial<
    RadioSubmissionPayload
  >;

  const canSubmit =
    !existing &&
    !isPending &&
    songTitle.trim().length > 0 &&
    storyText.trim().length > 0 &&
    storyText.trim().length <= maxLength;

  const handleSubmit = () => {
    if (songTitle.trim().length === 0) {
      setErrorMsg("신청곡 제목을 입력해 주세요");
      return;
    }
    if (storyText.trim().length === 0) {
      setErrorMsg("사연을 입력해 주세요");
      return;
    }
    if (storyText.trim().length > maxLength) {
      setErrorMsg(`사연은 ${maxLength}자 이내로 써주세요`);
      return;
    }
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const result = await submitMissionAction(mission.id, {
          song_title: songTitle.trim(),
          artist: artist.trim() || undefined,
          story_text: storyText.trim(),
          child_name: childName.trim() || undefined,
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

  // 이미 제출된 경우 상태 패널만 노출
  if (existing) {
    return (
      <div className="space-y-4">
        <section className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#1B2B3A] via-[#26394C] to-[#1B2B3A] p-5 text-white shadow-lg">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-amber-300"
              aria-hidden
            />
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200">
              토리FM · 신청곡 & 사연
            </p>
          </div>

          {wasPlayed ? (
            <>
              <h2 className="mt-2 text-xl font-bold">
                🎵 오늘 방송됐어요!
              </h2>
              <p className="mt-1 text-sm text-amber-100/80">
                이웃들이 당신의 사연을 들었어요
              </p>
            </>
          ) : isApproved ? (
            <>
              <h2 className="mt-2 text-xl font-bold">
                ✅ 승인됐어요
              </h2>
              <p className="mt-1 text-sm text-amber-100/80">
                곧 토리FM에서 들려드려요
              </p>
            </>
          ) : isPendingReview ? (
            <>
              <h2 className="mt-2 text-xl font-bold">
                📻 신청 완료!
              </h2>
              <p className="mt-1 text-sm text-amber-100/80">
                기관이 승인하면 토리FM에서 들을 수 있어요
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-2 text-xl font-bold">사연이 처리됐어요</h2>
            </>
          )}

          <div className="mt-4 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/80">
              🎵 신청곡
            </p>
            <p className="mt-1 text-base font-bold">
              {existingPayload.song_title ?? "(제목 없음)"}
              {existingPayload.artist && (
                <span className="ml-1 text-sm font-normal text-white/70">
                  — {existingPayload.artist}
                </span>
              )}
            </p>
            {existingPayload.story_text && (
              <>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-amber-200/80">
                  💌 사연
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                  {existingPayload.story_text}
                </p>
              </>
            )}
            {existingPayload.child_name && (
              <p className="mt-3 text-[11px] font-semibold text-amber-200/80">
                — {existingPayload.child_name}
              </p>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 안내 */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#1B2B3A] via-[#26394C] to-[#1B2B3A] p-5 text-white shadow-lg">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-amber-300"
            aria-hidden
          />
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200">
            토리FM · 신청곡 & 사연
          </p>
        </div>
        <h2 className="mt-2 text-lg font-bold">🎵 오늘의 노래를 들려주세요</h2>
        {config.prompt_song && (
          <p className="mt-2 text-sm leading-relaxed text-white/80">
            {config.prompt_song}
          </p>
        )}
        {config.prompt_story && (
          <p className="mt-1 text-sm leading-relaxed text-white/80">
            {config.prompt_story}
          </p>
        )}
      </section>

      {/* 폼 */}
      <section className="space-y-3 rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
        <div>
          <label
            htmlFor="radio-song"
            className="block text-sm font-bold text-[#2D5A3D]"
          >
            🎵 신청곡 제목 <span className="text-rose-500">*</span>
          </label>
          <input
            id="radio-song"
            type="text"
            value={songTitle}
            onChange={(e) => setSongTitle(e.target.value.slice(0, 100))}
            placeholder="예: 숲속의 노래"
            maxLength={100}
            autoComplete="off"
            className="mt-2 min-h-[48px] w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-sm text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>

        <div>
          <label
            htmlFor="radio-artist"
            className="block text-sm font-bold text-[#2D5A3D]"
          >
            🎤 아티스트 (선택)
          </label>
          <input
            id="radio-artist"
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value.slice(0, 100))}
            placeholder="예: 숲속의 작은 새"
            maxLength={100}
            autoComplete="off"
            className="mt-2 min-h-[48px] w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-sm text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>

        <div>
          <label
            htmlFor="radio-child"
            className="block text-sm font-bold text-[#2D5A3D]"
          >
            🪴 누가 들을 노래인가요 (선택)
          </label>
          {childOptions && childOptions.length > 0 ? (
            <select
              id="radio-child"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              className="mt-2 min-h-[48px] w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-sm text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
            >
              <option value="">선택 안 함</option>
              {childOptions.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
              <option value="__other__">직접 입력…</option>
            </select>
          ) : (
            <input
              id="radio-child"
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value.slice(0, 50))}
              placeholder="아이 이름 또는 별명 (선택)"
              maxLength={50}
              autoComplete="off"
              className="mt-2 min-h-[48px] w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-sm text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
            />
          )}
          {childName === "__other__" && (
            <input
              type="text"
              value=""
              onChange={(e) => setChildName(e.target.value.slice(0, 50))}
              placeholder="이름을 직접 입력해 주세요"
              maxLength={50}
              autoComplete="off"
              className="mt-2 min-h-[48px] w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 text-sm text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
            />
          )}
        </div>

        <div>
          <label
            htmlFor="radio-story"
            className="flex items-center justify-between text-sm font-bold text-[#2D5A3D]"
          >
            <span>
              💌 사연 <span className="text-rose-500">*</span>
            </span>
            <span className="text-[11px] font-normal text-[#8B7F75]">
              {storyText.length}/{maxLength}
            </span>
          </label>
          <textarea
            id="radio-story"
            value={storyText}
            onChange={(e) => setStoryText(e.target.value.slice(0, maxLength))}
            placeholder="토리FM 진행자가 읽어줄 사연을 적어주세요"
            rows={6}
            maxLength={maxLength}
            className="mt-2 w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm leading-relaxed text-[#3D3A36] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>
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
        {isPending ? "제출 중..." : "📻 토리FM에 사연 보내기"}
      </button>

      <p className="text-center text-[11px] text-[#6B6560]">
        기관 운영자 승인 후 토리FM에서 들려드려요
      </p>
    </div>
  );
}
