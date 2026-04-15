"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatKorean, toE164Korean } from "@/lib/phone";

export default function LoginPage() {
  const router = useRouter();
  const [phoneInput, setPhoneInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const e164 = toE164Korean(phoneInput);
    if (!e164) {
      setError("올바른 휴대폰 번호를 입력해주세요");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: e164,
        options: { channel: "sms" },
      });
      if (otpError) {
        setError(otpError.message);
        return;
      }
      const qs = new URLSearchParams({ phone: e164 });
      router.push(`/login/verify?${qs.toString()}`);
    });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">캠프닉 입장</h1>
          <p className="text-sm text-neutral-600">전화번호로 빠르게 입장하세요</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" className="text-sm font-medium">
            휴대폰 번호
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="010-1234-5678"
            value={phoneInput}
            onChange={(e) => setPhoneInput(formatKorean(e.target.value))}
            className="w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-violet-500"
            required
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-violet-600 py-3 text-base font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {pending ? "발송 중..." : "입장하기"}
        </button>
      </form>
    </main>
  );
}
