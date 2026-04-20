"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { partnerLoginAction } from "./login-action";

export function PartnerLoginForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onSubmit = (formData: FormData) => {
    setError(null);
    start(async () => {
      const result = await partnerLoginAction(formData);
      if (result.ok) {
        router.push("/partner/dashboard");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form action={onSubmit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          ⚠️ {error}
        </div>
      )}

      <div>
        <label
          htmlFor="partner-id"
          className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
        >
          아이디
        </label>
        <input
          id="partner-id"
          name="username"
          type="text"
          required
          autoComplete="username"
          inputMode="text"
          placeholder="숲지기 아이디"
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
        />
      </div>

      <div>
        <label
          htmlFor="partner-pw"
          className="mb-1 block text-sm font-semibold text-[#2D5A3D]"
        >
          비밀번호
        </label>
        <input
          id="partner-pw"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="비밀번호"
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#B5AFA8] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[#2D5A3D] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/50 disabled:opacity-60"
      >
        {pending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
