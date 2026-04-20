"use client";

import { useEffect, useRef, useState } from "react";

const STATS = [
  { target: 100, suffix: "+", label: "숲길 운영", emoji: "🌲" },
  { target: 5000, suffix: "+", label: "가족 참여", emoji: "👨‍👩‍👧" },
  { target: 200, suffix: "+", label: "협력 기관", emoji: "🏢" },
  { target: 50, suffix: "+", label: "숲지기 업체", emoji: "🏡" },
];

function useCountUp(target: number, start: boolean, duration = 1400) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!start) return;
    const startTs = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTs;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, start, duration]);

  return value;
}

function StatCard({
  stat,
  start,
}: {
  stat: (typeof STATS)[number];
  start: boolean;
}) {
  const value = useCountUp(stat.target, start);
  return (
    <div className="rounded-2xl border border-[#D4E4BC] bg-white p-6 text-center shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
      <div className="text-3xl md:text-4xl" aria-hidden="true">
        {stat.emoji}
      </div>
      <p className="mt-2 text-3xl font-extrabold text-[#2D5A3D] md:text-4xl">
        {value.toLocaleString("ko-KR")}
        <span className="text-[#8B6F47]">{stat.suffix}</span>
      </p>
      <p className="mt-1 text-xs text-[#6B6560] md:text-sm">{stat.label}</p>
    </div>
  );
}

export function StatsShowcase() {
  const ref = useRef<HTMLDivElement | null>(null);
  // If IntersectionObserver isn't available (very old browsers / SSR),
  // start the counter immediately. Otherwise wait until we scroll into view.
  const [start, setStart] = useState<boolean>(
    () => typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setStart(true);
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      aria-label="토리로 누적 통계"
      className="bg-[#E8F0E4]/50 py-14 md:py-20"
    >
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-8 text-center md:mb-12">
          <p className="text-xs font-semibold tracking-[0.3em] text-[#8B6F47]">
            BY THE NUMBERS
          </p>
          <h2 className="mt-2 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
            숲에서 쌓인 순간들
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {STATS.map((s) => (
            <StatCard key={s.label} stat={s} start={start} />
          ))}
        </div>
      </div>
    </section>
  );
}
