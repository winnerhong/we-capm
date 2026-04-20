"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { partnerSignupAction } from "./actions";

export function PartnerSignupForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = (formData: FormData) => {
    setError(null);
    start(async () => {
      const result = await partnerSignupAction(formData);
      if (result.ok) {
        setDone(true);
      } else {
        setError(result.error);
      }
    });
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-[#D4E4BC] bg-white p-8 text-center shadow-sm">
        <div className="text-5xl">🌱</div>
        <h2 className="mt-3 text-xl font-bold text-[#2D5A3D]">신청이 접수되었어요</h2>
        <p className="mt-2 text-sm text-[#6B6560]">
          관리자 승인 후 로그인할 수 있어요.
          <br />
          결과는 등록하신 연락처/이메일로 안내드립니다.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/partner"
            className="rounded-xl bg-[#2D5A3D] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3A7A52]"
          >
            🏡 숲지기 로그인으로 가기
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-3 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
          >
            홈으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      action={onSubmit}
      className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm md:p-8"
    >
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          ⚠️ {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
          🏷️ 상호 <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          required
          autoComplete="organization"
          placeholder="예) 자라섬 글램핑"
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
        />
      </div>

      <div>
        <label htmlFor="business_name" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
          🏢 사업자명
        </label>
        <input
          id="business_name"
          name="business_name"
          autoComplete="organization"
          placeholder="예) (주)자라섬레저"
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
        />
      </div>

      <div>
        <label htmlFor="username" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
          👤 아이디 <span className="text-red-500">*</span>
        </label>
        <input
          id="username"
          name="username"
          required
          minLength={3}
          autoComplete="username"
          inputMode="text"
          pattern="[a-zA-Z0-9_\-.]+"
          placeholder="영문/숫자 3자 이상"
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
            🔒 비밀번호 <span className="text-red-500">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={4}
            autoComplete="new-password"
            placeholder="4자 이상"
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>
        <div>
          <label htmlFor="password_confirm" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
            🔒 비밀번호 확인 <span className="text-red-500">*</span>
          </label>
          <input
            id="password_confirm"
            name="password_confirm"
            type="password"
            required
            minLength={4}
            autoComplete="new-password"
            placeholder="한 번 더 입력"
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
          ✉️ 이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="owner@example.com"
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
        />
      </div>

      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-semibold text-[#2D5A3D]">
          📞 연락처
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="010-1234-5678"
          pattern="[0-9\-]*"
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
        />
      </div>

      <label
        htmlFor="agree"
        className="flex items-start gap-2 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 text-xs text-[#6B6560]"
      >
        <input
          id="agree"
          name="agree"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 accent-[#2D5A3D]"
        />
        <span>
          토리로의 <b className="text-[#2D5A3D]">이용약관</b>과{" "}
          <b className="text-[#2D5A3D]">개인정보 처리방침</b>에 동의하며,
          입력한 정보가 숲지기 심사에 사용되는 것에 동의합니다.
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[#2D5A3D] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/50 disabled:opacity-60"
      >
        {pending ? "신청 중…" : "🌲 숲지기 신청하기"}
      </button>

      <p className="text-center text-xs text-[#8B6F47]">
        신청 후 관리자 승인이 완료되면 로그인할 수 있어요 🌱
      </p>
    </form>
  );
}
