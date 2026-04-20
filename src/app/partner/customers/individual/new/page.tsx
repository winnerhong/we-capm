"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createCustomerAction } from "../actions";

const INTEREST_OPTIONS = [
  { value: "숲체험", icon: "🌲" },
  { value: "캠핑", icon: "⛺" },
  { value: "미술", icon: "🎨" },
  { value: "요리", icon: "🍳" },
  { value: "운동", icon: "⚽" },
  { value: "자연관찰", icon: "🔍" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "선택해 주세요" },
  { value: "SEARCH", label: "검색 (네이버/구글)" },
  { value: "SNS", label: "SNS (인스타그램/블로그)" },
  { value: "FRIEND", label: "지인 소개" },
  { value: "PARTNER", label: "파트너 기관 추천" },
  { value: "EVENT", label: "오프라인 행사" },
  { value: "WALKIN", label: "현장 방문" },
  { value: "OTHER", label: "기타" },
];

function formatPhone(raw: string): string {
  const d = raw.replace(/[^0-9]/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

export default function NewCustomerPage() {
  const [childCount, setChildCount] = useState(1);
  const [phone, setPhone] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggleInterest = (v: string) => {
    setInterests((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  };

  const addChild = () => setChildCount((c) => Math.min(10, c + 1));
  const removeChild = (index: number) => {
    setChildCount((c) => Math.max(1, c - 1));
    // 간단히 count만 줄이고 렌더는 index-based로 유지
    // (실제 입력 shift 로직은 폼 submit 시 서버에서 1..n까지 스캔하므로 문제 없음)
    void index;
  };

  const handleSubmit = (formData: FormData) => {
    setError(null);
    // interests는 상태 기반이므로 formData에 수동 주입
    for (const key of Array.from(formData.keys())) {
      if (key === "interests") formData.delete(key);
    }
    for (const v of interests) formData.append("interests", v);

    startTransition(async () => {
      try {
        await createCustomerAction(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "등록 중 오류가 발생했어요");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/customers/individual" className="hover:text-[#2D5A3D]">
          개인 고객
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">새 고객 등록</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            👨‍👩‍👧
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              새 고객 등록
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              가족 정보를 입력하면 자동으로 계정이 생성되고 안내 SMS가 발송돼요.
            </p>
          </div>
        </div>
      </header>

      <form
        action={handleSubmit}
        className="space-y-6"
        aria-describedby={error ? "form-error" : undefined}
      >
        {error ? (
          <div
            id="form-error"
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {error}
          </div>
        ) : null}

        {/* 보호자 기본정보 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#2D5A3D]">
            <span className="mr-1.5" aria-hidden>
              👤
            </span>
            보호자 기본정보
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="이름" required htmlFor="parent_name">
              <input
                id="parent_name"
                name="parent_name"
                type="text"
                required
                autoComplete="name"
                placeholder="홍길동"
                className="mt-1 w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2.5 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
              />
            </Field>
            <Field label="전화번호" required htmlFor="parent_phone">
              <input
                id="parent_phone"
                name="parent_phone"
                type="tel"
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="010-1234-5678"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2.5 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
              />
            </Field>
            <Field label="이메일" htmlFor="email">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="parent@example.com"
                className="mt-1 w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2.5 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
              />
            </Field>
            <Field label="주소" htmlFor="address">
              <input
                id="address"
                name="address"
                type="text"
                autoComplete="address-line1"
                placeholder="서울시 ○○구 ○○로"
                className="mt-1 w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2.5 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
              />
            </Field>
          </div>
        </section>

        {/* 아이 정보 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#2D5A3D]">
              <span className="mr-1.5" aria-hidden>
                👶
              </span>
              아이 정보
            </h2>
            <span className="text-[11px] text-[#6B6560]">
              최대 10명까지 등록 가능
            </span>
          </div>
          <ul className="mt-4 space-y-3">
            {Array.from({ length: childCount }, (_, i) => i + 1).map((n) => (
              <li
                key={n}
                className="grid gap-3 rounded-xl border border-[#F4EFE8] bg-[#FFF8F0] p-3 md:grid-cols-[1fr_140px_auto] md:items-end"
              >
                <Field label={`아이 ${n} 이름`} htmlFor={`child_name_${n}`}>
                  <input
                    id={`child_name_${n}`}
                    name={`child_name_${n}`}
                    type="text"
                    autoComplete="off"
                    placeholder="예) 홍지호"
                    className="mt-1 w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
                  />
                </Field>
                <Field label="나이" htmlFor={`child_age_${n}`}>
                  <input
                    id={`child_age_${n}`}
                    name={`child_age_${n}`}
                    type="number"
                    min={0}
                    max={19}
                    inputMode="numeric"
                    placeholder="7"
                    className="mt-1 w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
                  />
                </Field>
                <div className="flex items-end">
                  {n === childCount && childCount > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeChild(n)}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      삭제
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addChild}
            disabled={childCount >= 10}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] hover:bg-[#E8F0E4] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden>+</span>
            <span>아이 추가</span>
          </button>
        </section>

        {/* 관심사 태그 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#2D5A3D]">
            <span className="mr-1.5" aria-hidden>
              🌿
            </span>
            관심사 태그
          </h2>
          <p className="mt-1 text-[11px] text-[#6B6560]">
            선택하신 관심사를 기준으로 맞춤 체험을 추천해 드려요.
          </p>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="group"
            aria-label="관심사 태그"
          >
            {INTEREST_OPTIONS.map((opt) => {
              const active = interests.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleInterest(opt.value)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-[#2D5A3D] bg-[#2D5A3D] text-white shadow"
                      : "border-[#E5D3B8] bg-white text-[#6B4423] hover:bg-[#FFF8F0]"
                  }`}
                >
                  <span aria-hidden>{opt.icon}</span>
                  {opt.value}
                </button>
              );
            })}
          </div>
        </section>

        {/* 마케팅 동의 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#2D5A3D]">
            <span className="mr-1.5" aria-hidden>
              📬
            </span>
            마케팅 수신 동의
          </h2>
          <ul className="mt-3 space-y-2">
            <Consent name="marketing_sms" label="SMS 수신 동의 (필수 안내는 동의 여부와 무관)" defaultChecked />
            <Consent name="marketing_email" label="이메일 수신 동의" />
            <Consent name="marketing_kakao" label="카카오톡 알림 수신 동의" defaultChecked />
          </ul>
        </section>

        {/* 유입 경로 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#2D5A3D]">
            <span className="mr-1.5" aria-hidden>
              🧭
            </span>
            유입 경로
          </h2>
          <Field label="어떻게 알고 오셨나요?" htmlFor="source">
            <select
              id="source"
              name="source"
              className="mt-1 w-full rounded-lg border border-[#E5D3B8] bg-white px-3 py-2.5 text-sm text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/30"
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </section>

        {/* Submit */}
        <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-end">
          <Link
            href="/partner/customers/individual"
            className="rounded-xl border border-[#E5D3B8] bg-white px-5 py-2.5 text-sm font-semibold text-[#6B4423] hover:bg-[#FFF8F0]"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "등록 중..." : "등록하고 안내 SMS 발송"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-[11px] font-semibold text-[#6B6560]">
        {label}
        {required ? <span className="ml-0.5 text-rose-600" aria-hidden>*</span> : null}
      </span>
      {children}
    </label>
  );
}

function Consent({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#F4EFE8] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2D5A3D] hover:bg-[#F4EFE8]">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="h-4 w-4 rounded border-[#E5D3B8] text-[#2D5A3D] focus:ring-[#2D5A3D]"
        />
        <span>{label}</span>
      </label>
    </li>
  );
}
