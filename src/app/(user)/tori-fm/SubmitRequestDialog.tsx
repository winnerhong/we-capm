"use client";

// 토리FM 즉석 신청곡 폼 — LIVE 세션에서만 노출.
//  - 기본은 닫힘. 버튼 클릭 시 인라인 확장.
//  - 추천 곡 칩 클릭 시 song_title/artist 자동 채움.
//  - submitSessionRequestAction 호출 → 성공 시 닫고 2초 배너.

import { useCallback, useRef, useState, useTransition } from "react";
import { submitSessionRequestAction } from "@/lib/tori-fm/actions";

type TrendingSong = { song_title: string; artist: string };

type Props = {
  sessionId: string;
  isLive: boolean;
  trendingSongs: TrendingSong[];
};

export function SubmitRequestDialog({
  sessionId,
  isLive,
  trendingSongs,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);
  const songInputRef = useRef<HTMLInputElement | null>(null);
  const artistInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      const form = e.currentTarget;
      const formData = new FormData(form);
      const song = String(formData.get("song_title") ?? "").trim();
      if (!song) {
        setError("노래 제목을 입력해 주세요");
        return;
      }
      const story = String(formData.get("story") ?? "");
      if (story.length > 800) {
        setError("사연은 800자까지 작성할 수 있어요");
        return;
      }
      startTransition(async () => {
        try {
          await submitSessionRequestAction(sessionId, formData);
          form.reset();
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

  const fillFromTrending = useCallback((song: TrendingSong) => {
    if (songInputRef.current) {
      songInputRef.current.value = song.song_title;
    }
    if (artistInputRef.current) {
      artistInputRef.current.value = song.artist ?? "";
    }
  }, []);

  if (!isLive) return null;

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

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-violet-700 active:scale-[0.99]"
        >
          ✏ 지금 바로 신청곡 보내기
        </button>
      ) : (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="fm-req-song"
              className="block text-[11px] font-bold text-[#2D5A3D]"
            >
              노래 제목 <span className="text-rose-500">*</span>
            </label>
            <input
              id="fm-req-song"
              ref={songInputRef}
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
              가수
            </label>
            <input
              id="fm-req-artist"
              ref={artistInputRef}
              name="artist"
              type="text"
              maxLength={200}
              autoComplete="off"
              inputMode="text"
              className="mt-1 block min-h-[44px] w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              placeholder="예: 방탄소년단"
            />
          </div>
          <div>
            <label
              htmlFor="fm-req-story"
              className="block text-[11px] font-bold text-[#2D5A3D]"
            >
              사연 (선택, 800자 이내)
            </label>
            <textarea
              id="fm-req-story"
              name="story"
              rows={3}
              maxLength={800}
              className="mt-1 block w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              placeholder="아이와의 추억, 선곡 이유를 들려주세요"
            />
          </div>
          <div>
            <label
              htmlFor="fm-req-child"
              className="block text-[11px] font-bold text-[#2D5A3D]"
            >
              아이 이름 (선택)
            </label>
            <input
              id="fm-req-child"
              name="child_name"
              type="text"
              maxLength={50}
              autoComplete="off"
              className="mt-1 block min-h-[44px] w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              placeholder="예: 하늘"
            />
          </div>

          {trendingSongs.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[#2D5A3D]">
                🔥 오늘 많이 신청된 곡
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {trendingSongs.slice(0, 6).map((s, i) => (
                  <button
                    key={`${s.song_title}-${i}`}
                    type="button"
                    onClick={() => fillFromTrending(s)}
                    className="rounded-full border border-[#D4E4BC] bg-white px-3 py-1 text-[11px] text-[#2D5A3D] transition hover:border-violet-400 hover:bg-violet-50"
                  >
                    {s.song_title}
                    {s.artist ? ` · ${s.artist}` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

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
              취소
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="min-h-[44px] flex-1 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              {isPending ? "보내는 중" : "신청하기"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
