import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { updateOrgAction } from "../../actions";
import { ORG_TYPE_OPTIONS, type OrgRow } from "../../meta";

export const dynamic = "force-dynamic";

const INPUT_CLASS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";
const LABEL_CLASS = "mb-1 block text-xs font-semibold text-[#2D5A3D]";

const COLUMNS =
  "id,partner_id,org_name,org_type,representative_name,representative_phone,email,address,children_count,class_count,teacher_count,business_number,tax_email,commission_rate,discount_rate,contract_start,contract_end,tags,internal_memo,auto_username,status,created_at";

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
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePartner();
  const { id } = await params;
  const org = await loadOrg(id);
  if (!org) notFound();

  async function action(formData: FormData) {
    "use server";
    await updateOrgAction(id, formData);
  }

  const tagsText = (org.tags ?? []).join(", ");

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
                담당자 연락처 <span className="text-rose-600">*</span>
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
            </div>
          </div>
        </section>

        {/* Section 6: 메모 */}
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
