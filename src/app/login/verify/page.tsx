"use client";

import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface OTPCredential extends Credential {
  code: string;
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyPageInner />
    </Suspense>
  );
}

function VerifyPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") ?? "";
  const nextPath = searchParams.get("next") ?? "/";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const abortRef = useRef<AbortController | null>(null);

  const verify = (token: string) => {
    if (!phone || token.length !== 6) return;
    startTransition(async () => {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("세션 생성 실패");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      if (!profile || profile.name === "참가자") {
        router.push(`/login/name?next=${encodeURIComponent(nextPath)}`);
      } else {
        router.push(nextPath);
      }
    });
  };

  useEffect(() => {
    if (!("OTPCredential" in window)) return;
    abortRef.current = new AbortController();
    const ctrl = abortRef.current;

    const credsGet = navigator.credentials.get.bind(navigator.credentials) as (
      o: { otp: { transport: string[] }; signal: AbortSignal }
    ) => Promise<OTPCredential | null>;

    credsGet({ otp: { transport: ["sms"] }, signal: ctrl.signal })
      .then((otp) => {
        if (otp?.code) {
          setCode(otp.code);
          verify(otp.code);
        }
      })
      .catch(() => {});

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    verify(code);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">인증코드 입력</h1>
          <p className="text-sm text-neutral-600">{phone}로 보낸 6자리 코드를 입력해주세요</p>
        </div>

        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          className="w-full rounded-lg border px-4 py-3 text-center text-2xl tracking-widest outline-none focus:ring-2 focus:ring-violet-500"
          autoFocus
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending || code.length !== 6}
          className="w-full rounded-lg bg-violet-600 py-3 text-base font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {pending ? "확인 중..." : "확인"}
        </button>
      </form>
    </main>
  );
}
