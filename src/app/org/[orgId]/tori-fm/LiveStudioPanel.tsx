"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ListenerPresence } from "@/components/tori-fm/ListenerPresence";

interface Props {
  sessionName: string;
  scheduledStart: string;
  scheduledEnd: string;
  startedAt: string | null;
  song: string | null;
  artist: string | null;
  story: string | null;
  parentName: string | null;
  orgId: string;
  controls: ReactNode;
}

/**
 * 실시간 방송국 느낌의 LIVE 패널.
 *  - 3 타이머: 경과 · 남은 시간 · 벽시계
 *  - ON AIR 펄스
 *  - VU 미터 애니메이션 (가짜 — 분위기용)
 *  - YouTube 검색 바로 열기 (운영자가 현장 스피커로 재생)
 */
export function LiveStudioPanel({
  sessionName,
  scheduledStart,
  scheduledEnd,
  startedAt,
  song,
  artist,
  story,
  parentName,
  orgId,
  controls,
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const startedMs = useMemo(() => {
    if (!startedAt) return null;
    const t = new Date(startedAt).getTime();
    return Number.isNaN(t) ? null : t;
  }, [startedAt]);

  const endMs = useMemo(() => {
    const t = new Date(scheduledEnd).getTime();
    return Number.isNaN(t) ? null : t;
  }, [scheduledEnd]);

  const elapsedSec = startedMs ? Math.max(0, Math.floor((now - startedMs) / 1000)) : 0;
  const remainingSec = endMs ? Math.max(0, Math.floor((endMs - now) / 1000)) : 0;
  const isEndingSoon = remainingSec > 0 && remainingSec <= 300; // 5분
  const isCritical = remainingSec > 0 && remainingSec <= 60; // 1분

  const clockText = useMemo(
    () =>
      new Date(now).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
    [now]
  );

  const youtubeUrl = useMemo(() => {
    if (!song) return null;
    const q = [song, artist].filter(Boolean).join(" ");
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  }, [song, artist]);

  return (
    <section className="overflow-hidden rounded-3xl border border-rose-400/40 bg-gradient-to-br from-[#1B2B3A] via-[#26394C] to-[#1B2B3A] p-5 text-white shadow-xl md:p-6">
      {/* 상단: ON AIR · 제목 · 벽시계 */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-lg shadow-rose-500/40">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            ON AIR
          </span>
          <h2 className="text-base font-bold text-white md:text-lg">
            {sessionName}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-sm text-amber-200">
          <ListenerPresence orgId={orgId} variant="light" />
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-amber-200/60">
            📻 STUDIO
          </span>
          <time
            aria-live="polite"
            className="tabular-nums text-amber-100"
            suppressHydrationWarning
          >
            🕐 {clockText}
          </time>
        </div>
      </header>

      {/* 타이머 2개: 경과 · 남은 시간 */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <TimerTile
          label="경과"
          value={formatHMS(elapsedSec)}
          accent="emerald"
          icon="⏱"
        />
        <TimerTile
          label="남은 시간"
          value={formatHMS(remainingSec)}
          accent={isCritical ? "rose" : isEndingSoon ? "amber" : "sky"}
          icon={isCritical ? "⚠️" : "⏳"}
          pulse={isCritical}
        />
      </div>

      {/* 메인: 현재 곡 + VU 미터 */}
      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200/80">
            ♪ NOW PLAYING
          </p>
          {song ? (
            <>
              <p className="mt-1.5 truncate text-xl font-extrabold tracking-tight text-white">
                {song}
              </p>
              {artist && (
                <p className="text-sm font-semibold text-amber-200/80">
                  — {artist}
                </p>
              )}
              {story && (
                <blockquote className="mt-3 border-l-2 border-amber-300/60 pl-3 text-[13px] leading-relaxed text-white/85">
                  “{story}”
                </blockquote>
              )}
              {parentName && (
                <p className="mt-2 text-right text-[11px] font-semibold text-amber-200/80">
                  — {parentName}
                </p>
              )}
              {youtubeUrl && (
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-bold text-[#1B2B3A] shadow-md transition hover:bg-amber-300"
                >
                  ▶ YouTube에서 음원 재생
                </a>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-white/60">
              재생 중인 사연이 없어요. &ldquo;다음 곡&rdquo;을 눌러 시작하세요.
            </p>
          )}
        </div>

        {/* VU 미터 */}
        <VuMeter playing={!!song} />
      </div>

      {/* 컨트롤 */}
      <div className="mt-5 border-t border-white/10 pt-4">{controls}</div>

      {/* 시간 정보 푸터 */}
      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[11px] text-amber-200/60">
        <span>📅 예정: {fmtShort(scheduledStart)} ~ {fmtShort(scheduledEnd)}</span>
        {startedAt && <span>🎙 방송 시작: {fmtShort(startedAt)}</span>}
      </footer>
    </section>
  );
}

/* ---------------- Helpers ---------------- */

function formatHMS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(r)}`;
}

function fmtShort(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TimerTile({
  label,
  value,
  accent,
  icon,
  pulse,
}: {
  label: string;
  value: string;
  accent: "emerald" | "sky" | "amber" | "rose";
  icon: string;
  pulse?: boolean;
}) {
  const color: Record<typeof accent, string> = {
    emerald: "text-emerald-300 border-emerald-400/30",
    sky: "text-sky-300 border-sky-400/30",
    amber: "text-amber-300 border-amber-400/40",
    rose: "text-rose-300 border-rose-400/50",
  };
  return (
    <div
      className={`rounded-2xl border bg-black/30 p-3 backdrop-blur-sm ${color[accent]} ${pulse ? "animate-pulse" : ""}`}
    >
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
        <span aria-hidden>{icon}</span>
        <span>{label}</span>
      </p>
      <p
        className="mt-1 font-mono text-2xl font-extrabold tabular-nums"
        suppressHydrationWarning
      >
        {value}
      </p>
    </div>
  );
}

/** CSS 기반 가짜 VU 미터 — 실제 오디오 분석 아닌 분위기용 */
function VuMeter({ playing }: { playing: boolean }) {
  const bars = 14;
  return (
    <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-sm">
      {[0, 1].map((ch) => (
        <div key={ch} className="flex flex-col items-center gap-1">
          <span className="text-[9px] font-bold tracking-widest text-white/50">
            {ch === 0 ? "L" : "R"}
          </span>
          <div className="flex h-24 items-end gap-[2px]">
            {Array.from({ length: bars }).map((_, i) => (
              <VuBar key={i} index={i} total={bars} playing={playing} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function VuBar({
  index,
  total,
  playing,
}: {
  index: number;
  total: number;
  playing: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const step = (t: number) => {
      if (t - last > 120 + index * 7) {
        last = t;
        const el = ref.current;
        if (el) {
          // 하위 bar 는 항상 높음, 위쪽은 랜덤
          const base = playing
            ? 0.3 + ((total - index) / total) * 0.4
            : 0.05 + ((total - index) / total) * 0.1;
          const jitter = playing ? Math.random() * 0.4 : Math.random() * 0.08;
          const h = Math.max(0.04, Math.min(1, base + jitter));
          el.style.height = `${h * 100}%`;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [index, total, playing]);

  const color =
    index < total * 0.5
      ? "bg-emerald-400"
      : index < total * 0.8
        ? "bg-amber-400"
        : "bg-rose-400";

  return (
    <span
      ref={ref}
      aria-hidden
      className={`block w-1.5 rounded-sm ${color} transition-[height] duration-100 ease-out`}
      style={{ height: "10%" }}
    />
  );
}
