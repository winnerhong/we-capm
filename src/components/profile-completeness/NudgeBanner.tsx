import Link from "next/link";
import type { CompletenessResult } from "@/lib/profile-completeness/types";

interface Props {
  result: CompletenessResult;
  href: string; // 이동할 내 정보 페이지
  /** 80% 이상이면 숨김 (완료에 가까우면 배너 무음) */
  hideThreshold?: number;
}

export function CompletenessNudgeBanner({
  result,
  href,
  hideThreshold = 80,
}: Props) {
  if (result.isComplete) return null;
  if (result.percent >= hideThreshold) return null;

  const critical = result.percent < 50;
  const toneClass = critical
    ? "from-rose-50 to-amber-50 border-rose-200 hover:border-rose-300"
    : "from-amber-50 to-orange-50 border-amber-200 hover:border-amber-300";
  const textClass = critical ? "text-rose-900" : "text-amber-900";

  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-3 rounded-2xl border bg-gradient-to-r p-4 shadow-sm transition-all hover:shadow-md ${toneClass}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-2xl ${
            critical ? "bg-rose-100" : "bg-amber-100"
          }`}
        >
          🌱
        </span>
        <div className="min-w-0">
          <div className={`text-sm font-bold ${textClass}`}>
            프로필이 <b>{result.percent}%</b>만 채워졌어요
          </div>
          <p className={`mt-0.5 text-[11px] ${textClass}/80`}>
            미완료 {result.missing.length}개 · 전부 채우면 모든 기능을 사용할
            수 있어요
          </p>
        </div>
      </div>
      <span
        className={`shrink-0 rounded-lg border bg-white px-3 py-1.5 text-xs font-bold ${
          critical
            ? "border-rose-300 text-rose-800"
            : "border-amber-300 text-amber-800"
        }`}
      >
        이어서 채우기 →
      </span>
    </Link>
  );
}
