"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminLoginAction } from "./admin-login-action";

export default function LoginPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await adminLoginAction(id.trim(), password);
      if (!result.ok) {
        setError(result.message ?? "로그인 실패");
        return;
      }
      router.push("/admin");
      router.refresh();
    });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">관리자 로그인</h1>
          <p className="text-sm">행사 관리를 위한 관리자 전용</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="admin-id" className="text-sm font-medium">아이디</label>
          <input
            id="admin-id"
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="admin"
            className="w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-violet-500"
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="admin-pw" className="text-sm font-medium">비밀번호</label>
          <input
            id="admin-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
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
          {pending ? "로그인 중..." : "로그인"}
        </button>

        <Link href="/join" className="block text-center text-xs text-neutral-400 hover:text-violet-600">
          ← 참가자 입장으로 돌아가기
        </Link>
      </form>
    </main>
  );
}
