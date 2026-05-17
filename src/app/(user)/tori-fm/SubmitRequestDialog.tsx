"use client";

// 토리FM 즉석 신청곡 폼 — LIVE 세션에서만 노출.
//  - 기본은 닫힘. 버튼 클릭 시 인라인 확장.
//  - 단일 모드: 신청곡 + 사연 (곡명·가수·사연 모두 필수). kind 는 항상 song_request.
//  - 추천 곡 칩 클릭 시 song_title/artist 자동 채움.
//  - submitSessionRequestAction 호출 → 성공 시 닫고 2초 배너.

import { useCallback, useRef, useState, useTransition } from "react";
import { submitSessionRequestAction } from "@/lib/tori-fm/actions";
import { RADIO_REWARD_DEFAULTS } from "@/lib/missions/types";
import { AcornIcon } from "@/components/acorn-icon";

type TrendingSong = { song_title: string; artist: string };

type Props = {
  sessionId: string;
  isLive: boolean;
  trendingSongs: TrendingSong[];
  /**
   * "OOO 가족" 자동 표시값. 폼이 child_name 으로 hidden 전송.
   * 비어있으면 child_name 미전송.
   */
  familyLabel: string;
  /**
   * RADIO 미션 config 의 PLAYED 보상 — 신청곡(기본) + 사연(보너스).
   * 부모(page.tsx) 가 추출해 전달. 없으면 RADIO_REWARD_DEFAULTS.
   */
  rewardSong?: number;
  rewardStory?: number;
};

export function SubmitRequestDialog({
  sessionId,
  isLive,
  trendingSongs,
  familyLabel,
  rewardSong = RADIO_REWARD_DEFAULTS.song,
  rewardStory = RADIO_REWARD_DEFAULTS.story,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // 사연 입력값 — 신청하기 버튼 라벨 동적 계산용 (사연 있으면 +N 보너스)
  const [storyInput, setStoryInput] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);
  // 인기곡 칩 부스트 상태 — 한 번 누르면 즉시 +1 신청 들어감.
  const [boostingId, setBoostingId] = useState<string | null>(null);
  const [boostedIds, setBoostedIds] = useState<Set<string>>(new Set());
  const [boostFeedback, setBoostFeedback] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      const form = e.currentTarget;
      const formData = new FormData(form);
      // 단일 모드 — 항상 song_request kind.
      formData.set("kind", "song_request");

      const song = String(formData.get("song_title") ?? "").trim();
      const artist = String(formData.get("artist") ?? "").trim();
      const story = String(formData.get("story") ?? "").trim();
      if (!song) {
        setError("노래 제목을 입력해 주세요");
        return;
      }
      if (!artist) {
        setError("가수를 입력해 주세요");
        return;
      }
      // 사연은 선택 — 비어도 OK, 단 너무 길면 거부.
      if (story.length > 800) {
        setError("사연은 800자까지 작성할 수 있어요");
        return;
      }

      startTransition(async () => {
        try {
          await submitSessionRequestAction(sessionId, formData);
          form.reset();
          setStoryInput("");
          setOpen(false);
          setShowBanner(true);
          setTimeout(() => setShowBanner(false), 2000);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "제출에 실패했어요";
          setError(msg);
        }
      });
    },
    [sessionId]
  );

  // 신청하기 버튼 라벨에 표시할 보상 — 사연 있으면 song+story, 없으면 song.
  const previewReward =
    storyInput.trim().length > 0 ? rewardSong + rewardStory : rewardSong;

  /**
   * 인기곡 칩 부스트 — 한 번 클릭 = "나도 이 노래가 듣고싶다!" 동참.
   * 사연 없이 song_title + artist + child_name(가족) 만으로 즉시 신청 INSERT 발생.
   * 같은 곡에 신청이 누적되면 trending 순위가 올라간다.
   */
  const onBoostSong = useCallback(
    (song: TrendingSong, idx: number) => {
      const id = `${song.song_title}-${idx}`;
      if (boostingId || boostedIds.has(id)) return;
      setBoostingId(id);
      setError(null);

      const fd = new FormData();
      fd.set("kind", "song_request");
      fd.set("song_title", song.song_title);
      fd.set("artist", song.artist);
      if (familyLabel) fd.set("child_name", familyLabel);

      startTransition(async () => {
        try {
          await submitSessionRequestAction(sessionId, fd);
          setBoostedIds((prev) => new Set(prev).add(id));
          setBoostFeedback(`🔥 ${song.song_title} +1 신청 완료!`);
          setTimeout(() => setBoostFeedback(null), 2200);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "신청 실패";
          setError(msg);
        } finally {
          setBoostingId(null);
        }
      });
    },
    [boostingId, boostedIds, familyLabel, sessionId]
  );

  if (!isLive) {
    return (
      <section className="rounded-2xl border border-dashed border-amber-300/40 bg-amber-50/30 p-3 text-center text-[12px] text-amber-800">
        라이브 방송이 시작되면 신청·사연을 보낼 수 있어요
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-50 to-rose-50 p-3 shadow-md">
      {showBanner && (
        <div
          role="status"
          className="mb-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-center text-[12px] font-bold text-emerald-800"
        >
          ✅ 신청이 도착했어요!
        </div>
      )}
      {boostFeedback && (
        <div
          role="status"
          className="mb-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-center text-[12px] font-bold text-violet-800"
        >
          {boostFeedback}
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 py-3 text-sm font-bold text-white shadow-md transition hover:from-rose-600 hover:to-orange-600 active:scale-[0.99]"
        >
          🎵 지금 바로 신청곡·사연 보내기
          <span className="inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">
            <AcornIcon size={10} />
            +{rewardSong}~{rewardSong + rewardStory}
          </span>
        </button>
      ) : (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="space-y-2.5"
        >
          <header className="mb-1 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#2D5A3D]">
              🎵 신청곡 + 사연 보내기
            </h3>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={isPending}
              aria-label="신청곡 보내기 접기"
              className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-[11px] font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-50"
            >
              <span aria-hidden>↑</span>
              <span>접기</span>
            </button>
          </header>

          {/* 보내는 이 — child_name hidden 전송 (작성자 표시). */}
          {familyLabel && (
            <input type="hidden" name="child_name" value={familyLabel} />
          )}

          {/* 작성자 라벨 미리보기 */}
          <div className="rounded-xl border border-dashed border-[#D4E4BC] bg-white/60 px-3 py-2 text-[11px] text-[#6B6560]">
            <span className="font-semibold text-[#2D5A3D]">보내는 이 · </span>
            {familyLabel ? familyLabel : "(가족 이름 미설정)"}
          </div>

          {/* 인기 곡 칩 + 곡명/아티스트 입력 */}
          {trendingSongs.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[#2D5A3D]">
                🔥 오늘 많이 신청된 곡
              </p>
              <p className="mt-0.5 text-[10px] text-[#8B7F75]">
                👇 클릭하면 &ldquo;나도 듣고 싶어요&rdquo; +1 신청이 들어가요
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {trendingSongs.slice(0, 6).map((s, i) => {
                  const id = `${s.song_title}-${i}`;
                  const isBoosting = boostingId === id;
                  const isBoosted = boostedIds.has(id);
                  const disabled = isBoosting || isBoosted || isPending;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onBoostSong(s, i)}
                      disabled={disabled}
                      title={
                        isBoosted
                          ? "이미 +1 했어요"
                          : "나도 이 노래가 듣고 싶어요!"
                      }
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                        isBoosted
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : isBoosting
                            ? "animate-pulse border-violet-300 bg-violet-50 text-violet-700"
                            : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:border-rose-400 hover:bg-rose-50 active:scale-[0.97]"
                      }`}
                    >
                      <span aria-hidden className="mr-1">
                        {isBoosted ? "✅" : isBoosting ? "⏳" : "🔥"}
                      </span>
                      {s.song_title}
                      {s.artist ? ` · ${s.artist}` : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="fm-req-song"
              className="block text-[11px] font-bold text-[#2D5A3D]"
            >
              노래 제목 <span className="text-rose-500">*</span>
            </label>
            <input
              id="fm-req-song"
              name="song_title"
              type="text"
              required
              maxLength={200}
              autoComplete="off"
              inputMode="text"
              className="mt-1 block min-h-[44px] w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              placeholder="예: 봄날"
            />
          </div>
          <div>
            <label
              htmlFor="fm-req-artist"
              className="block text-[11px] font-bold text-[#2D5A3D]"
            >
              가수 <span className="text-rose-500">*</span>
            </label>
            <input
              id="fm-req-artist"
              name="artist"
              type="text"
              required
              maxLength={200}
              autoComplete="off"
              inputMode="text"
              className="mt-1 block min-h-[44px] w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              placeholder="예: 방탄소년단"
            />
          </div>

          {/* 사연 — 선택 (보너스 +N 도토리) */}
          <div>
            <label
              htmlFor="fm-req-story"
              className="block text-[11px] font-bold text-[#2D5A3D]"
            >
              사연{" "}
              <span className="font-normal text-[#6B6560]">
                (선택, 800자 이내)
              </span>
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">
                <AcornIcon size={9} /> +{rewardStory} 보너스
              </span>
            </label>
            <textarea
              id="fm-req-story"
              name="story"
              rows={3}
              maxLength={800}
              value={storyInput}
              onChange={(e) => setStoryInput(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              placeholder="아이와의 추억, 선곡 이유를 들려주세요 (없어도 OK)"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-rose-50 p-2 text-xs text-rose-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={isPending}
              className="min-h-[44px] flex-1 rounded-xl border border-[#D4E4BC] bg-white px-4 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#FFF8F0] disabled:opacity-50"
            >
              ↑ 접기
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              {isPending ? (
                "보내는 중"
              ) : (
                <>
                  신청하기 <AcornIcon size={11} /> +{previewReward}
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
