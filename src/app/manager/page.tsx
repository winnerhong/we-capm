"use client";

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
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="text-4xl">🏢</div>
          <h1 className="text-2xl font-bold">행사 기관 로그인</h1>
          <p className="text-sm">부여받은 아이디와 비밀번호를 입력하세요</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">아이디</label>
          <input type="text" value={id} onChange={(e) => setId(e.target.value)}
            placeholder="행사 아이디" required autoFocus
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••" required
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={pending}
          className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
          {pending ? "로그인 중..." : "로그인"}
        </button>

        <a href="/join" className="block text-center text-xs text-neutral-400 hover:text-violet-600">
          ← 참가자 입장
        </a>
      </form>
    </main>
  );
}
