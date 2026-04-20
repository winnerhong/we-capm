"use client";

import { useTransition, useState } from "react";
import { submitB2BInquiryAction } from "./actions";

type PackageKey = "BASIC" | "PREMIUM" | "ENTERPRISE";
const PACKAGE_OPTIONS: Array<{ value: PackageKey; emoji: string; label: string; tone: string }> = [
  { value: "BASIC", emoji: "🥉", label: "베이직", tone: "border-[#D4E4BC] bg-white" },
  { value: "PREMIUM", emoji: "🥈", label: "프리미엄", tone: "border-[#E5D3B8] bg-[#FFF8F0]" },
  { value: "ENTERPRISE", emoji: "🥇", label: "엔터프라이즈", tone: "border-[#B8860B] bg-[#FFF6D9]" },
];

export function InquiryForm({ defaultPackage }: { defaultPackage?: PackageKey }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      try {
        await submitB2BInquiryAction(fd);
      } catch (err) {
        // redirect throws a NEXT_REDIRECT; ignore
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("NEXT_REDIRECT")) return;
        setError(msg || "문의 접수에 실패했어요. 잠시 후 다시 시도해주세요.");
      }
    });
  }

  return (
    <form
      id="inquiry"
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm md:p-8"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-[#2D5A3D]">
            회사명 <span className="text-red-500">*</span>
          </span>
          <input
            name="company_name"
            required
            autoComplete="organization"
            placeholder="예) 위너홍 주식회사"
            className="mt-1 block w-full rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[#2D5A3D]">
            담당자 이름 <span className="text-red-500">*</span>
          </span>
          <input
            name="contact_name"
            required
            autoComplete="name"
            placeholder="홍길동"
            className="mt-1 block w-full rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[#2D5A3D]">담당자 이메일</span>
          <input
            name="contact_email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="contact@company.com"
            className="mt-1 block w-full rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[#2D5A3D]">담당자 연락처</span>
          <input
            name="contact_phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="010-1234-5678"
            pattern="[0-9\-+ ]{9,20}"
            className="mt-1 block w-full rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[#2D5A3D]">예상 참여 인원</span>
          <select
            name="expected_attendees"
            defaultValue="50~100"
            className="mt-1 block w-full rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          >
            <option value="~50">~50명</option>
            <option value="50~100">50~100명</option>
            <option value="100~200">100~200명</option>
            <option value="200+">200명 이상</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[#2D5A3D]">희망 일정</span>
          <input
            name="preferred_date"
            type="datetime-local"
            className="mt-1 block w-full rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-[#2D5A3D]">관심 패키지</legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PACKAGE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${opt.tone} hover:border-[#2D5A3D]`}
            >
              <input
                type="checkbox"
                name="interested_packages"
                value={opt.value}
                defaultChecked={defaultPackage === opt.value}
                className="h-4 w-4 rounded border-[#D4E4BC] text-[#2D5A3D] focus:ring-[#2D5A3D]"
              />
              <span className="text-lg">{opt.emoji}</span>
              <span className="font-semibold text-[#2C2C2C]">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-semibold text-[#2D5A3D]">문의 내용</span>
        <textarea
          name="message"
          rows={4}
          placeholder="원하시는 행사 형태, 목표, 예산 범위 등을 자유롭게 알려주세요"
          className="mt-1 block w-full rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
        />
      </label>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[#6B6560]">
          제출 시 개인정보는 상담 목적으로만 사용되며, 영업일 기준 1~2일 내 연락드립니다.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="whitespace-nowrap rounded-xl bg-[#2D5A3D] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#3A7A52] disabled:opacity-60"
        >
          {pending ? "접수 중..." : "상담 신청 →"}
        </button>
      </div>
    </form>
  );
}
