"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NamePage() {
  return (
    <Suspense fallback={null}>
      <NamePageInner />
    </Suspense>
  );
}

function NamePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (trimmed.length < 1) {
      setError("이름을 입력해주세요");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ name: trimmed, phone_verified: true, last_login_at: new Date().toISOString() })
        .eq("id", user.id);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.push(nextPath);
    });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">환영합니다</h1>
          <p className="text-sm text-neutral-600">행사에서 사용할 이름을 알려주세요</p>
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="홍길동"
          className="w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-violet-500"
          maxLength={20}
          autoFocus
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-violet-600 py-3 text-base font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {pending ? "저장 중..." : "시작하기"}
        </button>
      </form>
    </main>
  );
}
