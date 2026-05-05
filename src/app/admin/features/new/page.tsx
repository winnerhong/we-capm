import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import {
  FEATURE_CATEGORIES,
  FEATURE_CATEGORY_META,
  PACK_TIERS,
  PACK_TIER_META,
  FEATURE_STATUSES,
  FEATURE_STATUS_META,
} from "@/lib/features/types";
import { createFeatureAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewFeaturePage() {
  await requireAdmin();

  async function action(formData: FormData) {
    "use server";
    const res = await createFeatureAction(formData);
    if (!res.ok) {
      throw new Error(res.message);
    }
    redirect("/admin/features");
  }

  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/admin" className="hover:text-[#2D5A3D]">
          관리자
        </Link>
        <span className="mx-2">/</span>
        <Link href="/admin/features" className="hover:text-[#2D5A3D]">
          기능 카탈로그
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">새 기능</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <h1 className="flex items-center gap-2 text-xl font-bold text-[#2D5A3D] md:text-2xl">
          <span aria-hidden>🧩</span>
          <span>새 기능 만들기</span>
        </h1>
        <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
          기능을 등재하면 분류에 따라 지사에 자동 부여되거나 수동 부여 대상이
          됩니다.
        </p>
      </header>

      <form
        action={action}
        className="space-y-5 rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-7"
      >
        {/* 코드 */}
        <Field
          label="코드 (고유키)"
          hint="대문자/숫자/언더스코어. 예: TORI_FM, ANALYTICS_PRO"
        >
          <input
            name="code"
            required
            pattern="[A-Z][A-Z0-9_]{1,49}"
            maxLength={50}
            placeholder="ANALYTICS_PRO"
            className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </Field>

        {/* 이름 */}
        <Field label="이름" hint="지사·기관에 표시될 한글 이름">
          <input
            name="name"
            required
            maxLength={80}
            placeholder="고급 분석 (Analytics Pro)"
            className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </Field>

        {/* 아이콘 */}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="아이콘" hint="이모지 1자 권장">
            <input
              name="icon"
              maxLength={4}
              placeholder="📊"
              className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
            />
          </Field>

          <Field label="카테고리">
            <select
              name="category"
              defaultValue="OTHER"
              className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
            >
              {FEATURE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {FEATURE_CATEGORY_META[c]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* 짧은 설명 */}
        <Field label="짧은 설명" hint="목록 카드에 노출 (1줄)">
          <input
            name="short_desc"
            maxLength={120}
            placeholder="예: 행사별 매출·이탈·코호트 분석"
            className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </Field>

        {/* 긴 설명 */}
        <Field label="긴 설명" hint="상세 페이지·스토어에 노출">
          <textarea
            name="long_desc"
            rows={4}
            maxLength={2000}
            className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </Field>

        {/* 분류 + 상태 */}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="분류 (pack_tier)">
            <select
              name="pack_tier"
              defaultValue="OPTIONAL"
              className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
            >
              {PACK_TIERS.map((t) => (
                <option key={t} value={t}>
                  {PACK_TIER_META[t].emoji} {PACK_TIER_META[t].label} —{" "}
                  {PACK_TIER_META[t].desc}
                </option>
              ))}
            </select>
          </Field>

          <Field label="상태">
            <select
              name="status"
              defaultValue="DRAFT"
              className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
            >
              {FEATURE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {FEATURE_STATUS_META[s].label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* 가격 (OPTIONAL 일 때만 의미 있음 — 서버에서 강제) */}
        <fieldset className="rounded-2xl border border-[#F0EBE3] bg-[#FFF8F0] p-4">
          <legend className="px-1 text-xs font-semibold text-[#2D5A3D]">
            💰 가격 (유료팩 OPTIONAL 일 때만 적용 · VAT 별도 · 결제 미구현
            단계에서는 메타데이터)
          </legend>
          <div className="mt-2 grid gap-4 md:grid-cols-3">
            <Field label="초기 세팅비 (KRW)">
              <input
                name="setup_fee_krw"
                type="number"
                min={0}
                step={10000}
                defaultValue={0}
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </Field>
            <Field label="월 구독료 (KRW)">
              <input
                name="monthly_fee_krw"
                type="number"
                min={0}
                step={1000}
                defaultValue={0}
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </Field>
            <Field label="체험 기간 (일)">
              <input
                name="trial_days"
                type="number"
                min={0}
                max={365}
                defaultValue={0}
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </Field>
          </div>
        </fieldset>

        {/* 정렬 */}
        <Field label="정렬 순서" hint="작을수록 위에 표시">
          <input
            name="sort_order"
            type="number"
            min={0}
            max={99999}
            defaultValue={100}
            className="w-32 rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </Field>

        {/* 액션 */}
        <div className="flex justify-end gap-2 pt-4">
          <Link
            href="/admin/features"
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="rounded-xl bg-[#2D5A3D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#3A7A52]"
          >
            등재하기
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-[#2D5A3D]">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[#8B7F75]">{hint}</p>}
    </div>
  );
}
