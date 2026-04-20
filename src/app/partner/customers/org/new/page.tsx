import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createOrgAction } from "../actions";
import { ORG_TYPE_OPTIONS } from "../meta";

export const dynamic = "force-dynamic";

const INPUT_CLASS =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

const LABEL_CLASS = "mb-1 block text-xs font-semibold text-[#2D5A3D]";

export default async function NewOrgPage() {
  await requirePartner();

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
        <span className="font-semibold text-[#2D5A3D]">새 기관 등록</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-sky-50 p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🏫
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              새 기관 등록
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              저장하면 자동 계정이 발급되고 대표자에게 환영 SMS가 전송됩니다.
            </p>
          </div>
        </div>
      </header>

      <form action={createOrgAction} className="space-y-6">
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
                placeholder="예) 토리로 어린이집"
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
                defaultValue="DAYCARE"
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
                placeholder="contact@example.com"
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
                placeholder="예) 서울특별시 종로구 자하문로 ○○"
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
                placeholder="예) VIP, 유치원연합, 2026계약"
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
                defaultValue={0}
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
                defaultValue={0}
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
                defaultValue={0}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* Section 3: 사업자정보 */}
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
                placeholder="000-00-00000"
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
                placeholder="tax@example.com"
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
              <div className="relative">
                <input
                  id="commission_rate"
                  name="commission_rate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.1"
                  defaultValue={20}
                  className={`${INPUT_CLASS} pr-10`}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B6560]"
                >
                  %
                </span>
              </div>
            </div>
            <div>
              <label htmlFor="discount_rate" className={LABEL_CLASS}>
                할인율 (%)
              </label>
              <div className="relative">
                <input
                  id="discount_rate"
                  name="discount_rate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.1"
                  defaultValue={0}
                  className={`${INPUT_CLASS} pr-10`}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B6560]"
                >
                  %
                </span>
              </div>
            </div>
            <div>
              <label htmlFor="contract_start" className={LABEL_CLASS}>
                계약 시작일
              </label>
              <input
                id="contract_start"
                name="contract_start"
                type="date"
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
                placeholder="예) 김숲지기"
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
                placeholder="010-0000-0000"
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                이 번호로 환영 SMS와 자동 계정 정보가 전송됩니다.
              </p>
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
            placeholder="특이사항, 연락 주의점, 담당 영업 등 내부용 기록"
            className={INPUT_CLASS}
          />
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/partner/customers/org"
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-sky-700 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/40"
          >
            <span aria-hidden>🌱</span>
            <span>기관 등록 + 계정 발급</span>
          </button>
        </div>
      </form>
    </div>
  );
}
