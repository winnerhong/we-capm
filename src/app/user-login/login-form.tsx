"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)} - ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} - ${digits.slice(3, 7)} - ${digits.slice(7)}`;
}

export function LoginForm({ initialError }: { initialError?: string | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setError("연락처 10~11자리를 숫자로 입력해주세요");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/user-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ phone: phoneDigits }),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as {
            ok?: boolean;
            redirectTo?: string;
          } | null;
          const dest = data?.redirectTo ?? "/home";
          router.push(dest);
          router.refresh();
          return;
        }
        const errBody = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(errBody?.error ?? "로그인에 실패했어요");
      } catch {
        setError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
        >
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="user-phone"
          className="block text-sm font-semibold text-[#2D5A3D]"
        >
          학부모 연락처
        </label>
        <input
          id="user-phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="010 - 1234 - 5678"
          required
          disabled={pending}
          className="w-full rounded-2xl border border-[#D4E4BC] bg-white px-4 py-3.5 text-base text-[#2D5A3D] shadow-sm outline-none placeholder:text-[#8B7F75] focus:border-[#3A7A52] focus:ring-2 focus:ring-[#3A7A52]/30 disabled:opacity-50"
        />
        <p className="text-[11px] text-[#6B6560]">
          🌿 기관에 등록된 학부모 연락처로 바로 입장돼요. 비밀번호는 필요 없어요.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-[52px] w-full rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] py-3.5 text-base font-bold text-white shadow-md transition hover:shadow-lg active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "들어가는 중..." : "🌲 들어가기"}
      </button>
    </form>
  );
}
