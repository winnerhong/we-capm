import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  loadOrgDailyAcornCap,
  loadPlatformAcornGuidelines,
} from "@/lib/missions/queries";
import { OrgAcornCapForm } from "./form";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

export default async function OrgAcornCapSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const updated = sp.updated === "1";

  const org = await requireOrg();

  const [guidelines, orgCap] = await Promise.all([
    loadPlatformAcornGuidelines(),
    loadOrgDailyAcornCap(orgId),
  ]);

  const suggestedDefault = guidelines?.max_daily_suggested ?? 50;
  const hardCap = guidelines?.max_daily_hard_cap ?? 200;
  const suggestedMin = guidelines?.suggested_range_min ?? 30;
  const suggestedMax = guidelines?.suggested_range_max ?? 100;
  const notes = guidelines?.notes ?? null;
  const currentCap = orgCap?.daily_cap ?? suggestedDefault;

  const updatedAt = orgCap?.updated_at
    ? new Date(orgCap.updated_at).toLocaleString("ko-KR")
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      {/* Breadcrumb */}
      <nav
        aria-label="breadcrumb"
        className="flex items-center gap-2 text-xs text-[#6B6560]"
      >
        <Link
          href={`/org/${orgId}`}
          className="hover:text-[#2D5A3D] hover:underline"
        >
          기관 홈
        </Link>
        <span aria-hidden>›</span>
        <span className="text-[#6B6560]">설정</span>
        <span aria-hidden>›</span>
        <span className="font-semibold text-[#2D5A3D]">도토리 일일 상한</span>
      </nav>

      {/* Header */}
      <header className="rounded-2xl border border-[#D4E4BC] bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <AcornIcon size={24} />
          <span>도토리 일일 상한 설정</span>
        </h1>
        <p className="mt-1 text-sm text-[#D4E4BC]">
          한 아이가 하루에 받을 수 있는 도토리의 최대치를 정해요.
        </p>
        {updatedAt && (
          <p className="mt-2 text-[11px] text-[#D4E4BC]">
            마지막 수정: {updatedAt}
            {orgCap?.updated_by ? ` · by ${orgCap.updated_by}` : ""}
          </p>
        )}
      </header>

      {updated && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
        >
          ✅ 일일 상한이 저장됐어요
        </div>
      )}

      {/* 플랫폼 가이드 카드 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📐</span>
          <span>플랫폼 가이드</span>
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] p-3">
            <dt className="text-[11px] font-semibold text-[#6B6560]">
              권장 범위
            </dt>
            <dd className="mt-0.5 text-base font-extrabold text-[#2D5A3D]">
              {suggestedMin} ~ {suggestedMax} <AcornIcon />
            </dd>
          </div>
          <div className="rounded-xl border border-[#D4E4BC] bg-[#E8F0E4] p-3">
            <dt className="text-[11px] font-semibold text-[#6B6560]">
              권장 기본값
            </dt>
            <dd className="mt-0.5 text-base font-extrabold text-[#2D5A3D]">
              {suggestedDefault} <AcornIcon />
            </dd>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <dt className="text-[11px] font-semibold text-rose-600">
              절대 하드캡 (변경 불가)
            </dt>
            <dd className="mt-0.5 text-base font-extrabold text-rose-700">
              {hardCap} <AcornIcon />
            </dd>
          </div>
        </dl>
        {notes && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="text-[11px] font-semibold text-amber-800">
              📝 관리자 메모
            </div>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-amber-900">
              {notes}
            </p>
          </div>
        )}
      </section>

      {/* 폼 */}
      <OrgAcornCapForm
        orgId={orgId}
        initialCap={currentCap}
        suggestedMin={suggestedMin}
        suggestedMax={suggestedMax}
        suggestedDefault={suggestedDefault}
        hardCap={hardCap}
      />
    </div>
  );
}
