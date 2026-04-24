import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { updateOrgAction, regenerateOrgAccountAction } from "../../actions";
import { ORG_TYPE_OPTIONS, type OrgRow } from "../../meta";

export const dynamic = "force-dynamic";

const INPUT_CLASS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";
const LABEL_CLASS = "mb-1 block text-xs font-semibold text-[#2D5A3D]";

const COLUMNS =
  "id,partner_id,org_name,org_type,org_phone,representative_name,representative_phone,email,address,children_count,class_count,teacher_count,business_number,tax_email,commission_rate,discount_rate,contract_start,contract_end,tags,internal_memo,auto_username,status,created_at";

async function loadOrg(id: string): Promise<OrgRow | null> {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: OrgRow | null; error: unknown }>;
        };
      };
    };
  };
  try {
    const { data, error } = await sb
      .from("partner_orgs")
      .select(COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export default async function EditOrgPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ regen?: string }>;
}) {
  await requirePartner();
  const { id } = await params;
  const sp = await searchParams;
  const org = await loadOrg(id);
  if (!org) notFound();

  async function action(formData: FormData) {
    "use server";
    await updateOrgAction(id, formData);
  }

  async function regenAction() {
    "use server";
    await regenerateOrgAccountAction(id);
  }

  const tagsText = (org.tags ?? []).join(", ");

  // 아이디 미리보기 (기관 전화번호 숫자만)
  const usernamePreview = (org.org_phone ?? "").replace(/\D/g, "") || null;
  // 비밀번호 미리보기 (담당자 핸드폰 뒷 4자리)
  const repDigits = (org.representative_phone ?? "").replace(/\D/g, "");
  const passwordPreview = repDigits.length >= 4 ? repDigits.slice(-4) : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/customers/org" className="hover:text-[#2D5A3D]">
          기관 고객
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/partner/customers/org/${org.id}`}
          className="hover:text-[#2D5A3D]"
        >
          {org.org_name}
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">편집</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-sky-50 p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            ✏️
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              {org.org_name} 편집
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              기관 정보를 수정하고 저장하세요. 변경사항은 즉시 반영됩니다.
            </p>
          </div>
        </div>
      </header>

      <form action={action} className="space-y-6">
        {/* Section 1: 기본정보 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>📝</span>
            <span>기본 정보</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="org_name" className={LABEL_CLASS}>
                기관명 <span className="text-rose-600">*</span>
              </label>
              <input
                id="org_name"
                name="org_name"
                type="text"
                required
                autoComplete="organization"
                defaultValue={org.org_name}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="org_type" className={LABEL_CLASS}>
                기관 유형 <span className="text-rose-600">*</span>
              </label>
              <select
                id="org_type"
                name="org_type"
                required
                defaultValue={org.org_type}
                className={INPUT_CLASS}
              >
                {ORG_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.icon} {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="org_phone" className={LABEL_CLASS}>
                기관 전화번호 <span className="text-rose-600">*</span>
              </label>
              <input
                id="org_phone"
                name="org_phone"
                type="tel"
                inputMode="tel"
                required
                autoComplete="tel"
                defaultValue={org.org_phone ?? ""}
                placeholder="예) 02-123-4567"
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                🔑 로그인 아이디로 사용됩니다 (숫자만 추출)
              </p>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="email" className={LABEL_CLASS}>
                대표 이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                defaultValue={org.email ?? ""}
                className={INPUT_CLASS}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="address" className={LABEL_CLASS}>
                주소
              </label>
              <input
                id="address"
                name="address"
                type="text"
                autoComplete="street-address"
                defaultValue={org.address ?? ""}
                className={INPUT_CLASS}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="tags" className={LABEL_CLASS}>
                태그 (쉼표로 구분)
              </label>
              <input
                id="tags"
                name="tags"
                type="text"
                autoComplete="off"
                defaultValue={tagsText}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* Section 2: 규모 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>👥</span>
            <span>규모</span>
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="children_count" className={LABEL_CLASS}>
                아동 수
              </label>
              <input
                id="children_count"
                name="children_count"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={org.children_count}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="class_count" className={LABEL_CLASS}>
                반 수
              </label>
              <input
                id="class_count"
                name="class_count"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={org.class_count}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="teacher_count" className={LABEL_CLASS}>
                교사 수
              </label>
              <input
                id="teacher_count"
                name="teacher_count"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={org.teacher_count}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* Section 3: 사업자 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🧾</span>
            <span>사업자 정보</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="business_number" className={LABEL_CLASS}>
                사업자등록번호
              </label>
              <input
                id="business_number"
                name="business_number"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                defaultValue={org.business_number ?? ""}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="tax_email" className={LABEL_CLASS}>
                세금계산서 이메일
              </label>
              <input
                id="tax_email"
                name="tax_email"
                type="email"
                inputMode="email"
                autoComplete="off"
                defaultValue={org.tax_email ?? ""}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* Section 4: 계약 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>📜</span>
            <span>계약 조건</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="commission_rate" className={LABEL_CLASS}>
                수수료율 (%)
              </label>
              <input
                id="commission_rate"
                name="commission_rate"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.1"
                defaultValue={org.commission_rate}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="discount_rate" className={LABEL_CLASS}>
                할인율 (%)
              </label>
              <input
                id="discount_rate"
                name="discount_rate"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.1"
                defaultValue={org.discount_rate}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="contract_start" className={LABEL_CLASS}>
                계약 시작일
              </label>
              <input
                id="contract_start"
                name="contract_start"
                type="date"
                defaultValue={org.contract_start ?? ""}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="contract_end" className={LABEL_CLASS}>
                계약 종료일
              </label>
              <input
                id="contract_end"
                name="contract_end"
                type="date"
                defaultValue={org.contract_end ?? ""}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* Section 5: 담당자 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>👤</span>
            <span>대표 담당자</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="representative_name" className={LABEL_CLASS}>
                담당자 이름
              </label>
              <input
                id="representative_name"
                name="representative_name"
                type="text"
                autoComplete="name"
                defaultValue={org.representative_name ?? ""}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="representative_phone" className={LABEL_CLASS}>
                담당자 핸드폰 <span className="text-rose-600">*</span>
              </label>
              <input
                id="representative_phone"
                name="representative_phone"
                type="tel"
                inputMode="tel"
                required
                autoComplete="tel"
                defaultValue={org.representative_phone ?? ""}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                🔑 뒷 4자리가 초기 비밀번호
              </p>
            </div>
          </div>
        </section>

        {/* Section 6: 자동 발급 계정 */}
        <section className="rounded-2xl border border-[#D4A15A] bg-[#FFF8F0] p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#8B6B3F]">
            <span aria-hidden>🔐</span>
            <span>로그인 계정 (/manager)</span>
          </h2>

          {sp.regen === "1" && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              ✅ 계정이 재발급되었어요. 아래 정보를 기관에 전달하세요.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* 아이디 */}
            <div className="rounded-xl border border-[#D4E4BC] bg-white p-3">
              <p className="text-[10px] font-semibold text-[#8B7F75]">아이디</p>
              <p className="mt-1 break-all font-mono text-sm font-bold text-[#2D5A3D]">
                {org.auto_username ?? (
                  usernamePreview ? (
                    <span className="text-amber-600">미발급 (저장 시 {usernamePreview})</span>
                  ) : (
                    <span className="text-rose-600">기관 전화번호 필요</span>
                  )
                )}
              </p>
              <p className="mt-1 text-[10px] text-[#8B7F75]">
                🏢 기관 전화번호 (숫자만 추출)
              </p>
            </div>

            {/* 비밀번호 */}
            <div className="rounded-xl border border-[#D4E4BC] bg-white p-3">
              <p className="text-[10px] font-semibold text-[#8B7F75]">초기 비밀번호</p>
              <p className="mt-1 font-mono text-sm font-bold text-[#2D5A3D]">
                {passwordPreview ? (
                  <span className="rounded bg-[#FFF0D9] px-2 py-0.5">
                    {passwordPreview}
                  </span>
                ) : (
                  <span className="text-rose-600">담당자 핸드폰 필요</span>
                )}
              </p>
              <p className="mt-1 text-[10px] text-[#8B7F75]">
                📱 담당자 핸드폰 뒷 4자리 (초기 셋팅)
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/60 p-3">
            <p className="text-[11px] text-[#6B6560]">
              💡 기관 전화번호 또는 담당자 핸드폰을 수정한 뒤 <strong>먼저 저장</strong>하고,
              <br className="sm:hidden" /> 이 버튼으로 계정을 갱신하세요.
            </p>
            <button
              type="submit"
              formAction={regenAction}
              formNoValidate
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4A15A] bg-[#FFF0D9] px-4 py-2 text-xs font-bold text-[#8B6B3F] hover:bg-[#F5E8D3]"
            >
              <span aria-hidden>🔄</span>
              <span>이 기관 계정 재발급</span>
            </button>
          </div>
        </section>

        {/* Section 7: 메모 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>📝</span>
            <span>내부 메모</span>
          </h2>
          <textarea
            id="internal_memo"
            name="internal_memo"
            rows={4}
            defaultValue={org.internal_memo ?? ""}
            className={INPUT_CLASS}
          />
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`/partner/customers/org/${org.id}`}
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-sky-700 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40"
          >
            <span aria-hidden>💾</span>
            <span>변경사항 저장</span>
          </button>
        </div>
      </form>
    </div>
  );
}
