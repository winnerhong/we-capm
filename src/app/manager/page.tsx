"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { managerLoginAction } from "./actions";

export default function ManagerLoginPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await managerLoginAction(id.trim(), password) as { ok: boolean; message?: string; eventId?: string; eventName?: string };
      if (!result.ok) {
        setError(result.message ?? "로그인 실패");
        return;
      }
      router.push(`/manager/${result.eventId}`);
      router.refresh();
    });
  };

  return (
    <main className="min-h-dvh bg-neutral-50">
      {/* Forest gradient header */}
      <div className="bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] px-6 pt-12 pb-20 text-white">
        <div className="mx-auto max-w-sm text-center">
          <div className="mb-2 text-5xl" aria-hidden>🌲</div>
          <h1 className="text-2xl font-bold">토리로 기관 로그인</h1>
          <p className="mt-2 text-sm text-[#D4E4BC]">숲길 운영을 시작해보세요</p>
        </div>
      </div>

      {/* Login card */}
      <div className="mx-auto -mt-12 max-w-sm px-6 pb-10">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-[#E8F0E4] bg-white p-6 shadow-[0_10px_30px_-12px_rgba(45,90,61,0.25)]"
        >
          <div className="space-y-2 text-center">
            <div className="text-2xl" aria-hidden>🌰</div>
            <h2 className="text-lg font-bold text-[#2C2C2C]">운영자 입장</h2>
            <p className="text-xs text-[#6B6560]">부여받은 아이디와 비밀번호를 입력하세요</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="manager-id" className="text-sm font-medium text-[#2C2C2C]">아이디</label>
            <input
              id="manager-id"
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="행사 아이디"
              required
              autoFocus
              autoComplete="username"
              className="w-full rounded-xl border border-[#E8F0E4] bg-neutral-50 px-4 py-3 outline-none transition-colors focus:border-[#4A7C59] focus:ring-2 focus:ring-[#D4E4BC]"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="manager-password" className="text-sm font-medium text-[#2C2C2C]">비밀번호</label>
            <input
              id="manager-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-[#E8F0E4] bg-neutral-50 px-4 py-3 outline-none transition-colors focus:border-[#4A7C59] focus:ring-2 focus:ring-[#D4E4BC]"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:opacity-50"
          >
            {pending ? "숲길을 여는 중..." : "로그인"}
          </button>

          <Link
            href="/join"
            className="block text-center text-xs text-[#6B6560] hover:text-[#2D5A3D]"
          >
            ← 참가자 입장
          </Link>
        </form>

        <p className="mt-5 text-center text-[11px] text-[#6B6560]">
          🍃 자연 속에서 함께 만드는 하루
        </p>
      </div>
    </main>
  );
}
