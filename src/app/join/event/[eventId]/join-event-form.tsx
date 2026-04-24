"use client";

// 미로그인 참가자용 폰 입력 폼.
// form POST /api/auth/user-login?redirect=/join/event/{eventId}
//  → 성공 시 브라우저가 이 페이지로 redirect 되고, 서버 컴포넌트가 쿠키를 읽어
//    AutoJoinPanel 을 렌더.
//
// self-register 분기:
//  - event 가 allow_self_register=true 이고 번호가 app_users 에 없을 때,
//    서버가 401 { ok:false, needs_signup:true } 를 반환. 이 경우 폼이 보호자 이름
//    필드를 노출하고 parent_name 포함해 재요청. 서버가 신규 app_user 를 만들며
//    로그인까지 완료.
//  - JS 비활성 환경 fallback: 서버가 redirect 로 ?err=needs_signup 을 붙여 돌려주면
//    page.tsx 가 `initialNeedsSignup` prop 으로 이름 필드를 미리 노출.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  eventId: string;
  orgName: string;
  /** 서버에서 ?err=... 로 전달된 초기 에러 메시지. no-JS form 제출 실패 복귀 시 사용. */
  initialError?: string | null;
  /** no-JS fallback: 서버가 needs_signup 으로 리다이렉트했을 때 이름 필드 선노출. */
  initialNeedsSignup?: boolean;
};

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function JoinEventForm({
  eventId,
  orgName,
  initialError = null,
  initialNeedsSignup = false,
}: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [parentName, setParentName] = useState("");
  const [needsSignup, setNeedsSignup] = useState(initialNeedsSignup);
  const [error, setError] = useState<string | null>(initialError);
  const [pending, startTransition] = useTransition();

  // initialNeedsSignup 이 바뀌면 state 동기화 (props 변경 대응).
  useEffect(() => {
    if (initialNeedsSignup) setNeedsSignup(true);
  }, [initialNeedsSignup]);

  const redirectTarget = `/join/event/${eventId}`;
  const loginUrl = `/api/auth/user-login?redirect=${encodeURIComponent(
    redirectTarget
  )}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setError("연락처 10~11자리를 숫자로 입력해 주세요");
      return;
    }
    // needsSignup 모드에서는 이름 검증.
    const trimmedName = parentName.trim();
    if (needsSignup && trimmedName.length < 1) {
      setError("보호자 이름을 입력해 주세요");
      return;
    }
    if (needsSignup && trimmedName.length > 50) {
      setError("이름은 50자 이내로 입력해 주세요");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(loginUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            phone: phoneDigits,
            event_id: eventId,
            parent_name: needsSignup ? trimmedName : undefined,
          }),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as {
            ok?: boolean;
            redirectTo?: string;
          } | null;
          const dest = data?.redirectTo ?? redirectTarget;
          // 세션 쿠키가 이미 세팅됐으므로, 같은 페이지로 돌아가 AutoJoinPanel 을 렌더
          router.push(dest);
          router.refresh();
          return;
        }
        const errBody = (await res.json().catch(() => null)) as {
          error?: string;
          needs_signup?: boolean;
        } | null;

        // 자체 가입 가능 행사 — 이름 입력으로 재도전.
        if (errBody?.needs_signup) {
          setNeedsSignup(true);
          setError(null);
          return;
        }

        setError(
          errBody?.error ?? "로그인에 실패했어요. 잠시 후 다시 시도해 주세요."
        );
      } catch {
        setError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  return (
    <section className="rounded-3xl border border-[#D4E4BC] bg-white p-6 shadow-sm">
      <div className="text-center">
        <p className="text-3xl" aria-hidden>
          🌱
        </p>
        <h2 className="mt-2 text-lg font-bold text-[#2D5A3D]">
          {needsSignup ? "처음 오셨네요!" : "참가자 정보 확인"}
        </h2>
        <p className="mt-1 text-xs text-[#6B6560]">
          {needsSignup
            ? "연락처와 이름을 알려주시면 바로 참여하실 수 있어요."
            : `${orgName}에 등록된 연락처를 입력해 주세요.`}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        action={loginUrl}
        method="post"
        className="mt-5 space-y-3"
        noValidate
      >
        {/* no-JS fallback 용 hidden field — 서버가 event_id 로 self-register 가능 여부 판단 */}
        <input type="hidden" name="event_id" value={eventId} />

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
          >
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="join-phone"
            className="block text-sm font-semibold text-[#2D5A3D]"
          >
            📞 학부모 연락처
          </label>
          <input
            id="join-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-1234-5678"
            required
            disabled={pending}
            aria-describedby="join-phone-hint"
            className="w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3.5 text-base text-[#2D5A3D] shadow-sm outline-none placeholder:text-[#8B7F75] focus:border-[#3A7A52] focus:ring-2 focus:ring-[#3A7A52]/30 disabled:opacity-50"
          />
          <p id="join-phone-hint" className="text-[11px] text-[#6B6560]">
            🌿 비밀번호 없이 연락처만으로 바로 입장돼요.
          </p>
        </div>

        {needsSignup && (
          <div className="space-y-1.5">
            <label
              htmlFor="join-name"
              className="block text-sm font-semibold text-[#2D5A3D]"
            >
              👋 보호자 이름
            </label>
            <input
              id="join-name"
              name="parent_name"
              type="text"
              autoComplete="name"
              required
              maxLength={50}
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="홍길동"
              disabled={pending}
              aria-describedby="join-name-hint"
              className="w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3.5 text-base text-[#2D5A3D] shadow-sm outline-none placeholder:text-[#8B7F75] focus:border-[#3A7A52] focus:ring-2 focus:ring-[#3A7A52]/30 disabled:opacity-50"
            />
            <p id="join-name-hint" className="text-[11px] text-[#6B6560]">
              🌱 처음이시군요! 이름을 알려주시면 바로 참여하실 수 있어요.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="min-h-[52px] w-full rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] py-3.5 text-base font-bold text-white shadow-md transition hover:shadow-lg active:scale-[0.99] disabled:opacity-60"
        >
          {pending
            ? "확인 중..."
            : needsSignup
              ? "🌱 가입하고 참가하기"
              : "🌲 참가하기"}
        </button>
      </form>

      <p className="mt-4 text-center text-[11px] text-[#8B7F75]">
        {needsSignup
          ? `다른 계정이시면 ${orgName} 담당자에게 문의해 주세요.`
          : `등록된 연락처가 없으면 ${orgName} 담당자에게 문의해 주세요.`}
      </p>
    </section>
  );
}
