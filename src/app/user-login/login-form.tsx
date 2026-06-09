"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)} - ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} - ${digits.slice(3, 7)} - ${digits.slice(7)}`;
}

// 로그인 후 돌아갈 URL 안전 검증 — open redirect 방지.
function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (raw.length > 500) return null;
  return raw;
}

// /invitation/<eventId>(/...) 형태에서 eventId 추출.
//   초대장 링크 진입에서만 셀프 등록 분기를 활성화하기 위함.
function extractInvitationEventId(returnTo: string | null): string | null {
  if (!returnTo) return null;
  const m = returnTo.match(/^\/invitation\/([0-9a-fA-F-]{8,})/);
  return m?.[1] ?? null;
}

export function LoginForm({
  initialError,
  liveEventId,
}: {
  initialError?: string | null;
  // 라이브 이벤트가 정확히 1개일 때 그 행사 ID. 로그인 후 초대장으로 자연스럽게
  // 안내하기 위한 기본 목적지.
  liveEventId?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 초대장 등에서 ?return=/invitation/xxx 로 넘어온 경우 그쪽으로 복귀.
  const returnTo = safeReturnPath(searchParams.get("return"));
  // 초대장 진입 시 self-register 시도에 쓸 eventId (event.allow_self_register=true
  // + LIVE 인 경우에만 서버가 신규 가입 허용).
  const invitationEventId = useMemo(
    () => extractInvitationEventId(returnTo),
    [returnTo]
  );
  const [phone, setPhone] = useState("");
  const [parentName, setParentName] = useState("");
  const [childName, setChildName] = useState("");
  // 서버가 needs_signup 응답을 주면 이름 입력 필드(보호자 + 원아)를 추가로 노출.
  const [needsSignup, setNeedsSignup] = useState(false);
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
    if (needsSignup) {
      if (!parentName.trim()) {
        setError("보호자 이름을 입력해 주세요");
        return;
      }
      if (!childName.trim()) {
        setError("원아 이름을 입력해 주세요");
        return;
      }
    }
    startTransition(async () => {
      try {
        const body: Record<string, string> = { phone: phoneDigits };
        // 초대장 링크 진입에서만 event_id 동봉 — 서버가 미등록 번호일 때
        // 셀프 등록 흐름으로 분기 (행사가 allow_self_register=true + LIVE 일 때).
        if (invitationEventId) body.event_id = invitationEventId;
        if (needsSignup) {
          body.parent_name = parentName.trim();
          body.child_name = childName.trim();
        }

        const res = await fetch("/api/auth/user-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as {
            ok?: boolean;
            redirectTo?: string;
          } | null;
          // 우선순위:
          //  1) URL ?return= — 초대장 링크에서 직접 진입 (가장 명시적)
          //  2) liveEventId — 라이브 이벤트가 1개면 그 행사 초대장 보여주고 입장
          //  3) API redirectTo
          //  4) /home
          const dest =
            returnTo ??
            (liveEventId ? `/invitation/${liveEventId}` : null) ??
            data?.redirectTo ??
            "/home";
          router.push(dest);
          router.refresh();
          return;
        }
        // 422 needs_signup → 이름 필드 노출 후 재제출 유도.
        if (res.status === 422) {
          const errBody = (await res.json().catch(() => null)) as {
            needs_signup?: boolean;
            error?: string;
          } | null;
          if (errBody?.needs_signup) {
            setNeedsSignup(true);
            setError(null);
            return;
          }
          setError(errBody?.error ?? "다시 시도해 주세요");
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

      {/* 셀프 등록 분기 안내 — 미등록 번호로 시도했고 행사가 허용 상태일 때만 */}
      {needsSignup && (
        <div
          role="status"
          className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p className="font-bold">🌱 처음이시군요!</p>
          <p className="mt-0.5 text-xs">
            보호자 이름과 원아 이름을 알려주시면 바로 입장돼요.
          </p>
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

      {needsSignup && (
        <>
          <div className="space-y-2">
            <label
              htmlFor="user-parent-name"
              className="block text-sm font-semibold text-[#2D5A3D]"
            >
              보호자 이름
            </label>
            <input
              id="user-parent-name"
              name="parent_name"
              type="text"
              autoComplete="name"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="예) 홍길동"
              maxLength={50}
              required
              autoFocus
              disabled={pending}
              className="w-full rounded-2xl border border-amber-300 bg-white px-4 py-3.5 text-base text-[#2D5A3D] shadow-sm outline-none placeholder:text-[#8B7F75] focus:border-amber-500 focus:ring-2 focus:ring-amber-300/40 disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="user-child-name"
              className="block text-sm font-semibold text-[#2D5A3D]"
            >
              원아 이름
            </label>
            <input
              id="user-child-name"
              name="child_name"
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="예) 홍유빈"
              maxLength={50}
              required
              disabled={pending}
              className="w-full rounded-2xl border border-amber-300 bg-white px-4 py-3.5 text-base text-[#2D5A3D] shadow-sm outline-none placeholder:text-[#8B7F75] focus:border-amber-500 focus:ring-2 focus:ring-amber-300/40 disabled:opacity-50"
            />
            <p className="text-[11px] text-[#6B6560]">
              👶 입장 후 형제·자매가 더 있다면 마이페이지에서 추가할 수 있어요.
            </p>
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-[52px] w-full rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] py-3.5 text-base font-bold text-white shadow-md transition hover:shadow-lg active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "들어가는 중..." : needsSignup ? "🌱 등록하고 입장" : "🌲 들어가기"}
      </button>
    </form>
  );
}
