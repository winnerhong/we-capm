import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { loadPlatformAcornGuidelines } from "@/lib/missions/queries";
import { GuidelinesForm } from "./form";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

export default async function AcornGuidelinesPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const updated = sp.updated === "1";

  const row = await loadPlatformAcornGuidelines();

  // 안전한 기본값(행이 비어있을 때)
  const initial = {
    max_daily_suggested: row?.max_daily_suggested ?? 50,
    max_daily_hard_cap: row?.max_daily_hard_cap ?? 200,
    max_per_mission: row?.max_per_mission ?? 20,
    suggested_range_min: row?.suggested_range_min ?? 30,
    suggested_range_max: row?.suggested_range_max ?? 100,
    notes: row?.notes ?? "",
  };

  const updatedAt = row?.updated_at
    ? new Date(row.updated_at).toLocaleString("ko-KR")
    : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav
        aria-label="breadcrumb"
        className="flex items-center gap-2 text-xs text-[#6B6560]"
      >
        <Link href="/admin" className="hover:text-[#2D5A3D] hover:underline">
          관리자
        </Link>
        <span aria-hidden>›</span>
        <Link
          href="/admin/settings"
          className="hover:text-[#2D5A3D] hover:underline"
        >
          시스템 설정
        </Link>
        <span aria-hidden>›</span>
        <span className="font-semibold text-[#2D5A3D]">도토리 가이드라인</span>
      </nav>

      {/* Hero */}
      <header className="rounded-2xl border border-[#D4E4BC] bg-gradient-to-br from-[#F5F1E8] via-white to-[#E8F0E4] p-6">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#2D5A3D]">
          <span aria-hidden><AcornIcon size={24} /></span>
          <span>도토리 가이드라인</span>
        </h1>
        <p className="mt-1 text-sm text-[#6B6560]">
          플랫폼 전체에 적용되는 도토리 지급 정책과 절대 상한을 관리해요.
        </p>
        {updatedAt && (
          <p className="mt-2 text-[11px] text-[#6B6560]">
            마지막 수정: {updatedAt}
            {row?.updated_by ? ` · by ${row.updated_by}` : ""}
          </p>
        )}
      </header>

      {updated && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
        >
          ✅ 가이드라인이 저장됐어요
        </div>
      )}

      {/* Rules recap */}
      <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#6B4423]">
          <span aria-hidden>📐</span>
          <span>검증 규칙</span>
        </h2>
        <ul className="mt-2 space-y-1 text-xs text-[#8B6F47] leading-relaxed">
          <li>• 절대 하드캡 ≥ 권장 일일 상한</li>
          <li>• 권장 범위 Min ≤ Max ≤ 권장 일일 상한</li>
          <li>• 미션당 상한 ≤ 권장 일일 상한</li>
          <li>• 모든 값은 1 이상의 정수</li>
        </ul>
      </section>

      {/* Form */}
      <GuidelinesForm initial={initial} />
    </div>
  );
}
