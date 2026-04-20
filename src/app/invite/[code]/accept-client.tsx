"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatKorean } from "@/lib/phone";
import { acceptInviteAction } from "./actions";

export function InviteAcceptClient({ code }: { code: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const digits = phone.replace(/\D/g, "");
    if (!name.trim()) {
      setError("이름을 입력해주세요");
      return;
    }
    if (digits.length < 10) {
      setError("올바른 전화번호를 입력해주세요");
      return;
    }

    startTransition(async () => {
      try {
        const result = await acceptInviteAction(code, digits, name.trim());
        if (!result.ok) {
          setError(result.message ?? "가입 실패");
          return;
        }
        setSuccess(true);
        setTimeout(() => {
          router.push(`/event/${result.eventId}`);
          router.refresh();
        }, 1200);
      } catch (err) {
        setError(err instanceof Error ? err.message : "가입 실패");
      }
    });
  };

  if (success) {
    return (
      <div className="mt-6 rounded-3xl border-2 border-[#A8C686] bg-[#D4E4BC] p-6 text-center">
        <div className="text-5xl mb-2" aria-hidden>
          🎊
        </div>
        <h2 className="text-lg font-bold text-[#2D5A3D]">환영합니다!</h2>
        <p className="mt-1 text-sm text-[#2D5A3D]">
          행사로 이동하고 있어요...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3" noValidate>
      <div>
        <label
          htmlFor="invite-name"
          className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
        >
          이름
        </label>
        <input
          id="invite-name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="홍길동"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-2xl border-2 border-[#C4956A]/40 bg-white px-4 py-3 text-base outline-none focus:border-[#C4956A] focus:ring-2 focus:ring-[#C4956A]/30"
          required
        />
      </div>

      <div>
        <label
          htmlFor="invite-phone"
          className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
        >
          전화번호
        </label>
        <input
          id="invite-phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="010-1234-5678"
          value={phone}
          onChange={(e) => setPhone(formatKorean(e.target.value))}
          className="w-full rounded-2xl border-2 border-[#C4956A]/40 bg-white px-4 py-3 text-base outline-none focus:border-[#C4956A] focus:ring-2 focus:ring-[#C4956A]/30"
          required
        />
      </div>

      {error && (
        <p className="text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-violet-600 py-4 text-base font-bold text-white shadow-md hover:bg-violet-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-colors"
      >
        {pending ? "가입 중..." : "🎁 도토리 받고 시작하기"}
      </button>
    </form>
  );
}
