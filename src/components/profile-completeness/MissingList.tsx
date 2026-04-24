import Link from "next/link";
import type { CompletenessResult } from "@/lib/profile-completeness/types";

interface Props {
  result: CompletenessResult;
  id?: string; // anchor id (default "missing")
}

export function MissingList({ result, id = "missing" }: Props) {
  if (result.isComplete) {
    return (
      <section
        id={id}
        className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-yellow-50 p-6 text-center shadow-sm"
      >
        <div className="text-5xl" aria-hidden>
          🎉
        </div>
        <h3 className="mt-2 text-lg font-bold text-emerald-800">
          모든 항목을 완료했어요!
        </h3>
        <p className="mt-1 text-xs text-emerald-700">
          프로필이 완전히 준비됐어요. 더 이상 채울 항목이 없습니다.
        </p>
      </section>
    );
  }

  return (
    <section id={id} className="space-y-4">
      <header className="px-1">
        <h3 className="text-sm font-bold text-[#2D5A3D]">
          ❌ 미완료 항목 {result.missing.length}개
        </h3>
        <p className="mt-0.5 text-[11px] text-[#8B7F75]">
          하나씩 채워가면 완성도가 올라가요. 각 항목의 "입력하기"를 눌러 주세요.
        </p>
      </header>

      {result.groups
        .filter((g) => g.missing.length > 0)
        .map((g) => (
          <div
            key={g.id}
            className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-[#E8E0D0] bg-[#FFF8F0] px-4 py-2.5">
              <span className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
                <span aria-hidden>{g.icon}</span>
                <span>{g.label}</span>
              </span>
              <span className="text-[11px] font-semibold text-[#8B7F75]">
                {g.completed} / {g.total} 완료
              </span>
            </div>
            <ul className="divide-y divide-[#E8E0D0]">
              {g.missing.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-base" aria-hidden>
                      {f.icon ?? "📝"}
                    </span>
                    <span className="truncate text-sm text-[#2C2C2C]">
                      {f.label}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {f.downloadHref && (
                      <Link
                        href={f.downloadHref}
                        className="inline-flex items-center rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100"
                        title="양식 다운로드"
                      >
                        {f.downloadLabel ?? "📥 양식"}
                      </Link>
                    )}
                    {f.href ? (
                      <Link
                        href={f.href}
                        className="rounded-lg bg-[#2D5A3D] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3A7A52]"
                      >
                        입력하기 →
                      </Link>
                    ) : (
                      <span className="text-[11px] text-[#8B7F75]">
                        미완료
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}
