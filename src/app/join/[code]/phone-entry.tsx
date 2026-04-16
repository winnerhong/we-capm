"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatKorean } from "@/lib/phone";
import { phoneLoginAction } from "./phone-login-action";

interface Props {
  eventId: string;
  eventName: string;
  location: string;
  joinCode: string;
}

export function PhoneEntry({ eventId, eventName, location, joinCode }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("올바른 전화번호를 입력해주세요");
      return;
    }

    startTransition(async () => {
      try {
        const result = await phoneLoginAction(joinCode, digits);
        if (!result.ok) {
          setError(result.message ?? "입장 실패");
          return;
        }
        router.push(`/event/${eventId}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "입장 실패");
      }
    });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-sm">행사 입장</p>
          <h1 className="text-2xl font-bold">{eventName}</h1>
          <p className="text-sm">📍 {location}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" className="text-sm font-medium">
            전화번호
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(formatKorean(e.target.value))}
            className="w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-violet-500"
            autoFocus
            required
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-violet-600 py-3 text-base font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {pending ? "확인 중..." : "입장하기"}
        </button>
      </form>
    </main>
  );
}
