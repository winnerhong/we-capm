// 서버/클라 공용 — 순수 UI 컴포넌트 (server component 가능)
import type { CompletenessResult } from "@/lib/profile-completeness/types";
import { toneForPercent } from "@/lib/profile-completeness/calculator";

const TONE_STYLES = {
  rose: {
    bar: "bg-rose-500",
    ring: "from-rose-100 via-white to-rose-50 border-rose-200",
    text: "text-rose-700",
    label: "시작해봐요",
  },
  amber: {
    bar: "bg-amber-500",
    ring: "from-amber-100 via-white to-amber-50 border-amber-200",
    text: "text-amber-700",
    label: "잘 진행 중",
  },
  emerald: {
    bar: "bg-emerald-500",
    ring: "from-emerald-100 via-white to-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    label: "거의 다 왔어요",
  },
  celebrate: {
    bar: "bg-gradient-to-r from-emerald-400 to-teal-400",
    ring: "from-emerald-50 via-white to-yellow-50 border-emerald-300",
    text: "text-emerald-700",
    label: "🎉 완성",
  },
} as const;

interface Props {
  result: CompletenessResult;
  missingAnchor?: string; // 클릭 시 이동할 앵커 (기본 #missing)
  heading?: string;
}

export function CompletenessCard({
  result,
  missingAnchor = "#missing",
  heading = "프로필 완성도",
}: Props) {
  const tone = toneForPercent(result.percent);
  const style = TONE_STYLES[tone];

  return (
    <section
      className={`rounded-3xl border bg-gradient-to-br p-5 shadow-sm ${style.ring} md:p-6`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#6B6560]">{heading}</h2>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-4xl font-extrabold ${style.text}`}>
              {result.percent}%
            </span>
            <span className="text-xs text-[#8B7F75]">
              ({result.completedCount} / {result.totalCount} 완료)
            </span>
          </div>
          <p className={`mt-0.5 text-xs font-semibold ${style.text}`}>
            {style.label}
          </p>
        </div>
        {!result.isComplete && (
          <a
            href={missingAnchor}
            className="shrink-0 rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            이어서 완성 ↓
          </a>
        )}
      </header>

      {/* 프로그레스 바 */}
      <div className="mt-4">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/60">
          <div
            className={`h-full rounded-full transition-all ${style.bar}`}
            style={{ width: `${Math.max(3, result.percent)}%` }}
            aria-valuenow={result.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
      </div>

      {/* 그룹별 요약 — 칩 라인 */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {result.groups.map((g) => {
          const gDone = g.percent === 100;
          return (
            <span
              key={g.id}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                gDone
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-[#D4E4BC] bg-white/80 text-[#6B6560]"
              }`}
              title={`${g.label} ${g.completed}/${g.total}`}
            >
              <span aria-hidden>{g.icon}</span>
              <span>{g.label}</span>
              <span className="text-[10px] text-[#8B7F75]">
                {g.completed}/{g.total}
              </span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
