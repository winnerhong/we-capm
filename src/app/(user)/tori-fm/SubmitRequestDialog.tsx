"use client";

// 토리FM 즉석 신청곡 폼 — LIVE 세션에서만 노출.
//  - 기본은 닫힘. 버튼 클릭 시 인라인 확장.
//  - 카테고리 토글: [신청곡 + 사연] / [사연만 (익명)]
//  - 추천 곡 칩 클릭 시 song_title/artist 자동 채움 (song_request 모드 전용).
//  - submitSessionRequestAction 호출 → 성공 시 닫고 2초 배너.

import { useCallback, useRef, useState, useTransition } from "react";
import { submitSessionRequestAction } from "@/lib/tori-fm/actions";
import type { FmRequestKind } from "@/lib/tori-fm/types";

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
};

export function SubmitRequestDialog({
  sessionId,
  isLive,
  trendingSongs,
  familyLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<FmRequestKind>("song_request");
  const [showBanner, setShowBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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
      // 모드는 controlled state 우선 — hidden input 이 실수로 빠져도 안전.
      formData.set("kind", mode);

      const story = String(formData.get("story") ?? "").trim();
      if (mode === "song_request") {
        const song = String(formData.get("song_title") ?? "").trim();
        const artist = String(formData.get("artist") ?? "").trim();
        if (!song) {
          setError("노래 제목을 입력해 주세요");
          return;
        }
        if (!artist) {
          setError("가수를 입력해 주세요");
          return;
        }
        if (story.length > 800) {
          setError("사연은 800자까지 작성할 수 있어요");
          return;
        }
      } else {
        // story_only: song_title/artist 무시, story 필수. child_name 은 유지(작성자 표시).
        formData.delete("song_title");
        formData.delete("artist");
        if (!story) {
          setError("사연을 입력해 주세요");
          return;
        }
        if (story.length > 800) {
          setError("사연은 800자까지 작성할 수 있어요");
          return;
        }
      }

      startTransition(async () => {
        try {
          await submitSessionRequestAction(sessionId, formData);
          form.reset();
          setOpen(false);
          setMode("song_request");
          setShowBanner(true);
          setTimeout(() => setShowBanner(false), 2000);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "제출에 실패했어요";
          setError(msg);
        }
      });
    },
    [sessionId, mode]
  );

  /**
   * 인기곡 칩 부스트 — 한 번 클릭 = "나도 이 노래가 듣고싶다!" 동참.
   * 사연 없이 song_title + artist + child_name(가족) 만으로 즉시 신청 INSERT 발생.
   * 같은 곡에 신청이 누적되면 trending 순위가 올라간다.
   * (story_only 모드와는 무관 — 항상 song_request kind 로 전송)
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
      if (song.artist) fd.set("artist", song.artist);
      if (familyLabel) fd.set("child_name", familyLabel);

      startTransition(async () => {
        try {
          await submitSessionRequestAction(sessionId, fd);
          setBoostedIds((prev) => {
            const nx = new Set(prev);
            nx.add(id);
            return nx;
          });
          setBoostFeedback("🔥 나도 듣고 싶어요! 순위가 올라가요");
          setTimeout(() => setBoostFeedback(null), 2500);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "처리에 실패했어요";
          setError(msg);
        } finally {
          setBoostingId(null);
        }
      });
    },
    [sessionId, familyLabel, boostingId, boostedIds]
  );

  // LIVE 인 동안에만 신청 폼 노출 — OFF 상태엔 다이얼로그 자체가 안 보임.
  if (!isLive) return null;
  const isStoryOnly = mode === "story_only";

  return (
    <section className="rounded-3xl border border-amber-300/60 bg-amber-50 p-4 shadow-sm">
      {showBanner && (
        <div
          className="mb-3 rounded-xl bg-emerald-100 p-3 text-center text-sm font-bold text-emerald-700"
          role="status"
          aria-live="polite"
        >
          🎵 신청 완료! 승인되면 방송에 들려드려요
        </div>
      )}
      {boostFeedback && (
        <div
          className="mb-3 rounded-xl bg-rose-100 p-3 text-center text-sm font-bold text-rose-700"
          role="status"
          aria-live="polite"
        >
          {boostFeedback}
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-violet-700 active:scale-[0.99]"
        >
          ✏ 지금 바로 신청곡·사연 보내기
        </button>
      ) : (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          {/* 헤더 — 제목 + 우측 접기 버튼 */}
          <header className="flex items-center justify-between gap-2 border-b border-[#D4E4BC] pb-2">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
              <span aria-hidden>{isStoryOnly ? "💌" : "🎵"}</span>
              <span>{isStoryOnly ? "사연 보내기" : "신청곡 보내기"}</span>
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

          {/* 카테고리 토글 — 신청곡+사연 / 사연만(익명) */}
          <div
            role="tablist"
            aria-label="보낼 카테고리 선택"
            className="grid grid-cols-2 gap-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isStoryOnly}
              onClick={() => {
                setMode("song_request");
                setError(null);
              }}
              disabled={isPending}
              className={`min-h-[44px] rounded-xl border px-3 py-2 text-[12px] font-bold transition active:scale-[0.98] ${
                !isStoryOnly
                  ? "border-amber-400 bg-amber-100 text-amber-800 shadow-sm"
                  : "border-[#D4E4BC] bg-white text-[#6B6560] hover:bg-[#FFF8F0]"
              } disabled:opacity-50`}
            >
              <span aria-hidden className="mr-1">🎵</span>
              신청곡 + 사연
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isStoryOnly}
              onClick={() => {
                setMode("story_only");
                setError(null);
              }}
              disabled={isPending}
              className={`min-h-[44px] rounded-xl border px-3 py-2 text-[12px] font-bold transition active:scale-[0.98] ${
                isStoryOnly
                  ? "border-indigo-400 bg-indigo-100 text-indigo-800 shadow-sm"
                  : "border-[#D4E4BC] bg-white text-[#6B6560] hover:bg-[#FFF8F0]"
              } disabled:opacity-50`}
            >
              <span aria-hidden className="mr-1">📝</span>
              사연만
            </button>
          </div>

          {/* kind hidden — controlled state 와 함께 안전망 */}
          <input type="hidden" name="kind" value={mode} />

          {/* 보내는 이 — child_name hidden 전송 (양쪽 모드 모두 작성자 표시). */}
          {familyLabel && (
            <input type="hidden" name="child_name" value={familyLabel} />
          )}

          {/* 작성자 라벨 미리보기 */}
          <div className="rounded-xl border border-dashed border-[#D4E4BC] bg-white/60 px-3 py-2 text-[11px] text-[#6B6560]">
            <span className="font-semibold text-[#2D5A3D]">보내는 이 · </span>
            {familyLabel ? familyLabel : "(가족 이름 미설정)"}
          </div>

          {/* song_request 전용 — 인기 곡 칩 + 곡명/아티스트 입력 */}
          {!isStoryOnly && (
            <>
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
                  required={!isStoryOnly}
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
            </>
          )}

          {/* 사연 — 두 모드 모두에서 노출. story_only 면 필수, 라벨/플레이스홀더 변경 */}
          <div>
            <label
              htmlFor="fm-req-story"
              className="block text-[11px] font-bold text-[#2D5A3D]"
            >
              사연{" "}
              {isStoryOnly ? (
                <span className="text-rose-500">*</span>
              ) : (
                <span className="font-normal text-[#6B6560]">(선택, 800자 이내)</span>
              )}
            </label>
            <textarea
              id="fm-req-story"
              name="story"
              rows={isStoryOnly ? 5 : 3}
              required={isStoryOnly}
              maxLength={800}
              className="mt-1 block w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              placeholder={
                isStoryOnly
                  ? "따뜻한 사연을 들려주세요"
                  : "아이와의 추억, 선곡 이유를 들려주세요"
              }
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
              className={`min-h-[44px] flex-1 rounded-xl px-4 text-sm font-bold text-white transition disabled:opacity-50 ${
                isStoryOnly
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-violet-600 hover:bg-violet-700"
              }`}
            >
              {isPending
                ? "보내는 중"
                : isStoryOnly
                  ? "사연 보내기"
                  : "신청하기"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
