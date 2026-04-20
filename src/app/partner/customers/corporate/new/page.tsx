import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { createCompanyAction } from "../actions";
import { BizNumberInput } from "./biz-number-input";

const INDUSTRIES = [
  "IT/SW",
  "제조업",
  "유통/물류",
  "금융/보험",
  "건설/건축",
  "교육",
  "의료/헬스케어",
  "미디어/콘텐츠",
  "F&B",
  "컨설팅",
  "공공기관",
  "비영리/재단",
  "기타",
];

const EMPLOYEE_RANGES = [
  { value: "5", label: "1-10명" },
  { value: "30", label: "11-50명" },
  { value: "100", label: "51-200명" },
  { value: "500", label: "201-1,000명" },
  { value: "2000", label: "1,000명 이상" },
];

const INTERESTS = [
  { value: "ESG", label: "ESG", emoji: "🌱" },
  { value: "TEAMBUILDING", label: "팀빌딩", emoji: "🏃" },
  { value: "FAMILY_DAY", label: "가족데이", emoji: "👨‍👩‍👧" },
  { value: "SENIOR", label: "시니어", emoji: "🌸" },
  { value: "YOUTH", label: "청년", emoji: "⚡" },
];

const CONTACT_ROLES = [
  { value: "HR", label: "인사 (HR)" },
  { value: "ESG", label: "ESG" },
  { value: "FINANCE", label: "재무" },
  { value: "CEO", label: "대표" },
  { value: "MARKETING", label: "마케팅" },
  { value: "OTHER", label: "기타" },
];

export default async function NewCorporatePage() {
  await requirePartner();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link
          href="/partner/customers/corporate"
          className="hover:text-[#1E3A5F]"
        >
          기업 고객
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#1E3A5F]">새 기업 등록</span>
      </nav>

      <header className="rounded-3xl border border-[#1E3A5F]/20 bg-gradient-to-br from-[#E8F0E4] via-white to-[#DEE7F1] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🏢
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#1E3A5F] md:text-2xl">
              새 기업 고객 등록
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              파트너십 기회를 리드 단계로 등록해 파이프라인을 시작하세요.
            </p>
          </div>
        </div>
      </header>

      <form action={createCompanyAction} className="space-y-6">
        {/* Section 1: 회사 기본정보 */}
        <section className="rounded-2xl border border-[#1E3A5F]/20 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1E3A5F]">
            <span aria-hidden>📋</span>
            <span>회사 기본정보</span>
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label
                htmlFor="company_name"
                className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
              >
                회사명 <span className="text-rose-600">*</span>
              </label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                required
                autoComplete="organization"
                placeholder="(주)위캠프"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
              />
            </div>

            <div>
              <label
                htmlFor="business_number"
                className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
              >
                사업자등록번호 <span className="text-rose-600">*</span>
              </label>
              <BizNumberInput />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                숫자만 입력하면 자동으로 XXX-XX-XXXXX 형식으로 표시됩니다.
              </p>
            </div>

            <div>
              <label
                htmlFor="industry"
                className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
              >
                업종
              </label>
              <select
                id="industry"
                name="industry"
                defaultValue=""
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
              >
                <option value="">선택...</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="employee_count"
                className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
              >
                직원수
              </label>
              <select
                id="employee_count"
                name="employee_count"
                defaultValue=""
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
              >
                <option value="">선택...</option>
                {EMPLOYEE_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="website"
                className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
              >
                홈페이지 URL
              </label>
              <input
                id="website"
                name="website"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://example.com"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
              />
            </div>

            <div>
              <label
                htmlFor="company_email"
                className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
              >
                대표 이메일
              </label>
              <input
                id="company_email"
                name="company_email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="contact@example.com"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
              />
            </div>
          </div>
        </section>

        {/* Section 2: 대표자 정보 */}
        <section className="rounded-2xl border border-[#1E3A5F]/20 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1E3A5F]">
            <span aria-hidden>👔</span>
            <span>대표자 정보</span>
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="representative_name"
                className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
              >
                대표자 이름
              </label>
              <input
                id="representative_name"
                name="representative_name"
                type="text"
                autoComplete="name"
                placeholder="홍길동"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
              />
            </div>

            <div>
              <label
                htmlFor="representative_phone"
                className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
              >
                대표자 연락처
              </label>
              <input
                id="representative_phone"
                name="representative_phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="010-XXXX-XXXX"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
              />
            </div>
          </div>
        </section>

        {/* Section 3: 관심 분야 */}
        <section className="rounded-2xl border border-[#1E3A5F]/20 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1E3A5F]">
            <span aria-hidden>🎯</span>
            <span>관심 분야</span>
          </h2>
          <p className="mb-3 text-[11px] text-[#6B6560]">
            여러 개 선택할 수 있어요. 맞춤 제안을 만들 때 활용됩니다.
          </p>

          <fieldset>
            <legend className="sr-only">관심 분야 선택</legend>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {INTERESTS.map((i) => (
                <label
                  key={i.value}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] hover:bg-[#E8F0E4] has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#DEE7F1] has-[:checked]:text-[#1E3A5F] has-[:checked]:font-semibold"
                >
                  <input
                    type="checkbox"
                    name="interests"
                    value={i.value}
                    className="h-4 w-4 rounded border-[#D4E4BC] text-[#1E3A5F] focus:ring-[#1E3A5F]/30"
                  />
                  <span aria-hidden>{i.emoji}</span>
                  <span>{i.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        {/* Section 4: 기본 담당자 */}
        <section className="rounded-2xl border border-[#1E3A5F]/20 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#1E3A5F]">
              <span aria-hidden>👤</span>
              <span>기본 담당자</span>
            </h2>
            <span className="text-[11px] text-[#8B7F75]">
              등록 후 상세 페이지에서 더 추가할 수 있어요
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="contact_name"
                className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
              >
                담당자 이름
              </label>
              <input
                id="contact_name"
                name="contact_name"
                type="text"
                autoComplete="name"
                placeholder="김담당"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
              />
            </div>

            <div>
              <label
                htmlFor="contact_role"
                className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
              >
                역할
              </label>
              <select
                id="contact_role"
                name="contact_role"
                defaultValue="HR"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
              >
                {CONTACT_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="contact_phone"
                className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
              >
                담당자 연락처
              </label>
              <input
                id="contact_phone"
                name="contact_phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="010-XXXX-XXXX"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
              />
            </div>

            <div>
              <label
                htmlFor="contact_email"
                className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
              >
                담당자 이메일
              </label>
              <input
                id="contact_email"
                name="contact_email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="contact@example.com"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="contact_department"
                className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
              >
                부서
              </label>
              <input
                id="contact_department"
                name="contact_department"
                type="text"
                autoComplete="off"
                placeholder="예) 인사팀, ESG기획팀"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
              />
            </div>
          </div>
        </section>

        {/* Section 5: 메모 */}
        <section className="rounded-2xl border border-[#1E3A5F]/20 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1E3A5F]">
            <span aria-hidden>📝</span>
            <span>내부 메모</span>
          </h2>
          <label htmlFor="memo" className="sr-only">
            메모
          </label>
          <textarea
            id="memo"
            name="memo"
            rows={4}
            placeholder="발견 경로, 특이사항, 예상 예산 등을 자유롭게 기록하세요."
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
          />
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/partner/customers/corporate"
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#1E3A5F] to-[#2D5A3D] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/40"
          >
            <span aria-hidden>🏢</span>
            <span>기업 등록</span>
          </button>
        </div>
      </form>
    </div>
  );
}
