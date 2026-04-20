"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatKorean } from "@/lib/phone";
import { directPhoneLoginAction } from "./actions";
import {
  ConsentCheckboxes,
  defaultConsent,
  isConsentValid,
  type ConsentState,
} from "@/components/consent-checkboxes";

export default function DirectJoinPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState<ConsentState>(defaultConsent);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const consentOk = isConsentValid(consent);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!consentOk) {
      setError("필수 항목에 동의해주세요");
      return;
    }

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("올바른 전화번호를 입력해주세요");
      return;
    }

    startTransition(async () => {
      try {
        const result = (await directPhoneLoginAction(digits, {
          terms: consent.terms,
          privacy: consent.privacy,
          marketing: consent.marketing,
          thirdParty: consent.thirdParty,
          ageConfirm: consent.ageConfirm,
        })) as { ok: boolean; message?: string; eventId?: string; name?: string };
        if (!result.ok) {
          setError(result.message ?? "입장 실패");
          return;
        }
        setWelcomeName(result.name ?? "참가자");
        setTimeout(() => {
          router.push(`/event/${result.eventId}`);
          router.refresh();
        }, 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "입장 실패");
      }
    });
  };

  if (welcomeName) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="text-5xl">🎉</div>
          <h1 className="text-2xl font-bold">{welcomeName}님 환영합니다!</h1>
          <p className="text-sm">행사에 입장합니다...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <div className="text-5xl">🌰</div>
          <h1 className="text-3xl font-extrabold text-forest tracking-tight">토리로</h1>
          <p className="text-xs text-acorn tracking-[0.4em] font-light">TORIRO</p>
          <p className="text-sm text-warm-gray mt-4">오늘, 어디로 걸어볼까요?</p>
        </div>

        <ConsentCheckboxes value={consent} onChange={setConsent} showChildGuardian />

        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="010-1234-5678"
          value={phone}
          onChange={(e) => setPhone(formatKorean(e.target.value))}
          className="w-full rounded-2xl border-2 px-4 py-4 text-lg text-center outline-none focus:border-violet-500"
          required
        />

        {error && <p className="text-sm text-center text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending || !consentOk}
          className="w-full rounded-2xl bg-violet-600 py-4 text-lg font-bold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {pending ? "확인 중..." : "입장하기"}
        </button>

        <div className="flex justify-center gap-4 text-xs text-neutral-400">
          <Link href="/manager" className="hover:text-violet-600">
            행사 기관 →
          </Link>
          <Link href="/login" className="hover:text-violet-600">
            관리자 →
          </Link>
        </div>
      </form>
    </main>
  );
}
