import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { getFeatureByCode } from "@/lib/features/queries";
import {
  FEATURE_CATEGORIES,
  FEATURE_CATEGORY_META,
  PACK_TIER_META,
} from "@/lib/features/types";
import {
  updateFeatureAction,
  setFeatureRequiresAction,
} from "../../actions";
import { TierToggle } from "../../tier-toggle";
import { StatusToggle } from "../../status-toggle";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ code: string }> };

export default async function EditFeaturePage({ params }: PageProps) {
  await requireAdmin();
  const { code } = await params;
  const feature = await getFeatureByCode(code);
  if (!feature) notFound();

  async function updateMeta(formData: FormData) {
    "use server";
    const res = await updateFeatureAction(code, formData);
    if (!res.ok) throw new Error(res.message);
    redirect(`/admin/features/${code}/edit?ok=meta`);
  }

  async function updateRequires(formData: FormData) {
    "use server";
    const csv = String(formData.get("requires_features") ?? "");
    const res = await setFeatureRequiresAction(code, csv);
    if (!res.ok) throw new Error(res.message);
    redirect(`/admin/features/${code}/edit?ok=requires`);
  }

  const tierMeta = PACK_TIER_META[feature.pack_tier];

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
        <span className="font-semibold text-[#2D5A3D]">
          {feature.name} 편집
        </span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              {feature.icon ?? "🧩"}
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                {feature.name}
              </h1>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="font-mono text-[11px] text-[#8B7F75]">
                  {feature.code}
                </span>
                <span className="text-[11px] text-[#6B6560]">
                  {FEATURE_CATEGORY_META[feature.category]}
                </span>
              </div>
            </div>
          </div>
          <Link
            href={`/admin/features/${code}/grants`}
            className="shrink-0 rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            👥 보유 지사 관리
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <TierToggle code={feature.code} current={feature.pack_tier} />
          <StatusToggle code={feature.code} current={feature.status} />
        </div>

        <p className="mt-3 text-[11px] text-[#6B6560]">
          {tierMeta.desc} · 등록 {fmt(feature.created_at)} · 마지막 수정{" "}
          {fmt(feature.updated_at)}
        </p>
      </header>

      {/* 메타데이터 편집 */}
      <form
        action={updateMeta}
        className="space-y-5 rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-7"
      >
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>✏️</span>
          <span>기본 정보 / 가격</span>
        </h2>

        <Field label="이름">
          <input
            name="name"
            required
            maxLength={80}
            defaultValue={feature.name}
            className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="아이콘">
            <input
              name="icon"
              maxLength={4}
              defaultValue={feature.icon ?? ""}
              className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
            />
          </Field>
          <Field label="카테고리">
            <select
              name="category"
              defaultValue={feature.category}
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

        <Field label="짧은 설명">
          <input
            name="short_desc"
            maxLength={120}
            defaultValue={feature.short_desc ?? ""}
            className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </Field>

        <Field label="긴 설명">
          <textarea
            name="long_desc"
            rows={5}
            maxLength={2000}
            defaultValue={feature.long_desc ?? ""}
            className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </Field>

        <fieldset
          className={`rounded-2xl border border-[#F0EBE3] p-4 ${
            feature.pack_tier === "OPTIONAL" ? "bg-[#FFF8F0]" : "bg-slate-50"
          }`}
        >
          <legend className="px-1 text-xs font-semibold text-[#2D5A3D]">
            💰 가격 (현재 분류:{" "}
            {feature.pack_tier === "OPTIONAL"
              ? "유료팩 — 활성"
              : `${tierMeta.label} — 무시됨`}
            )
          </legend>
          <div className="mt-2 grid gap-4 md:grid-cols-3">
            <Field label="초기 세팅비 (KRW)">
              <input
                name="setup_fee_krw"
                type="number"
                min={0}
                step={10000}
                disabled={feature.pack_tier !== "OPTIONAL"}
                defaultValue={feature.setup_fee_krw}
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </Field>
            <Field label="월 구독료 (KRW)">
              <input
                name="monthly_fee_krw"
                type="number"
                min={0}
                step={1000}
                disabled={feature.pack_tier !== "OPTIONAL"}
                defaultValue={feature.monthly_fee_krw}
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </Field>
            <Field label="체험 기간 (일)">
              <input
                name="trial_days"
                type="number"
                min={0}
                max={365}
                defaultValue={feature.trial_days}
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </Field>
          </div>
        </fieldset>

        <Field label="정렬 순서">
          <input
            name="sort_order"
            type="number"
            min={0}
            max={99999}
            defaultValue={feature.sort_order}
            className="w-32 rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-[#2D5A3D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#3A7A52]"
          >
            저장
          </button>
        </div>
      </form>

      {/* 의존성 */}
      <form
        action={updateRequires}
        className="space-y-3 rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-7"
      >
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>🔗</span>
          <span>의존 기능</span>
        </h2>
        <p className="text-[11px] text-[#6B6560]">
          이 기능을 사용하려면 미리 보유해야 하는 기능 코드를 콤마로 구분하여
          입력하세요. 예: <span className="font-mono">EVENT_BASIC,QR_STAMP</span>
        </p>
        <input
          name="requires_features"
          defaultValue={feature.requires_features.join(", ")}
          placeholder="EVENT_BASIC, QR_STAMP"
          className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            의존성 저장
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-[#2D5A3D]">
        {label}
      </label>
      {children}
    </div>
  );
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
