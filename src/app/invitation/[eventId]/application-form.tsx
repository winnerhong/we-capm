"use client";

// 초대장 하단 참가 신청서.
//
// 로그인 없이 제출한다 — 초대장 링크(UUID)가 곧 자격이다. 서버 액션이
// rate limit + 검증을 다시 하므로 여기 검증은 "즉시 피드백" 용도이고,
// 규칙 자체는 application-core 를 공유해 두 벌로 갈라지지 않게 한다.
//
// 이 컴포넌트는 leaf 라 입력 state 를 전부 안에서 들고 있는다. 부모(서버 컴포넌트)
// 는 리렌더되지 않으므로 타이핑이 무거워지지 않는다.

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  submitEventApplicationAction,
  lookupMyApplicationAction,
} from "@/lib/org-events/application-actions";
import {
  computeHeadcount,
  digitsOnly,
  validateApplicationInput,
} from "@/lib/org-events/application-core";
import {
  checkConsentAgreed,
  consentFingerprint,
  type OrgConsent,
} from "@/lib/org-events/consent-core";
import {
  COMPANION_PRESETS,
  MAX_APPLICATION_CHILDREN,
  MAX_APPLICATION_COMPANIONS,
  MAX_COMPANION_LABEL_LENGTH,
  type ApplicationCompanion,
  type CompanionKind,
  type OrgEventApplicationStatus,
} from "@/lib/org-events/types";

type ChildRow = { name: string; className: string };

type Props = {
  eventId: string;
  /** 정원이 찼는지 — 접수는 계속 받되 "대기 접수" 로 안내한다. */
  atCapacity: boolean;
  capacity: number | null;
  approvedPeople: number;
  /** "2026.09.10 18:00 까지" 같은 마감 안내. 없으면 숨김. */
  closeLabel: string | null;
  /**
   * 이 기관의 동의 문구 — {기관명} 치환까지 끝난 상태.
   * optional 이 null 이면 기관이 선택 동의를 꺼둔 것이라 그 줄을 띄우지 않는다.
   */
  consent: OrgConsent;
};

/** 010-1234-5678 자동 하이픈 — join-event-form 과 같은 규칙. */
function formatPhone(raw: string): string {
  const d = digitsOnly(raw).slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

const INPUT_CLS =
  "w-full rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3.5 text-base text-[#2D5A3D] shadow-sm outline-none placeholder:text-[#8B7F75] focus:border-[#3A7A52] focus:ring-2 focus:ring-[#3A7A52]/30 disabled:opacity-50";

export function ApplicationForm({
  eventId,
  atCapacity,
  capacity,
  approvedPeople,
  closeLabel,
  consent,
}: Props) {
  const router = useRouter();
  const [children, setChildren] = useState<ChildRow[]>([
    { name: "", className: "" },
  ]);
  const [phone, setPhone] = useState("");
  // 함께 오시는 분. 총 인원은 여기서 계산되므로 인원 state 를 따로 두지 않는다
  // (자녀를 추가했는데 숫자가 안 따라오는 어긋남이 생길 수 없게).
  const [companions, setCompanions] = useState<ApplicationCompanion[]>([]);
  // 개인정보 동의. 필수는 제출 조건, 선택(계열사 공동이용)은 아니다 —
  // 선택 미동의를 이유로 참가를 막으면 개인정보보호법 제22조 제5항 위반이다.
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [optionalAgreed, setOptionalAgreed] = useState(false);
  // 동의 항목 목록의 접힘. 폼이 길어서 기본은 접어둔다.
  // 펼치면 전문까지 한 번에 보인다 — 항목 이름만 보고 체크하지 않도록.
  const [consentOpen, setConsentOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | {
    updated: boolean;
    waitlisted: boolean;
  }>(null);
  const [alreadyIn, setAlreadyIn] = useState(false);
  const [pending, startTransition] = useTransition();

  function patchChild(idx: number, patch: Partial<ChildRow>) {
    setChildren((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  }

  function addChild() {
    setChildren((prev) =>
      prev.length >= MAX_APPLICATION_CHILDREN
        ? prev
        : [...prev, { name: "", className: "" }]
    );
  }

  function removeChild(idx: number) {
    setChildren((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)
    );
  }

  /** 칩 탭 = 한 명 추가. 같은 칩을 두 번 누르면 2명이 들어간다(삼촌 ×2). */
  function addCompanion(c: ApplicationCompanion) {
    setCompanions((prev) =>
      prev.length >= MAX_APPLICATION_COMPANIONS ? prev : [...prev, { ...c }]
    );
  }

  function patchCompanion(idx: number, patch: Partial<ApplicationCompanion>) {
    setCompanions((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  }

  function removeCompanion(idx: number) {
    setCompanions((prev) => prev.filter((_, i) => i !== idx));
  }

  // 매 렌더 계산 — 상태로 들고 있지 않으니 어긋날 수가 없다.
  const head = computeHeadcount(children, companions);

  // 지금 화면에 띄운 문구의 지문. 서버가 자기 문구와 대조해, 읽는 사이 기관이
  // 문구를 고쳤으면 되돌린다 (읽지 않은 글에 동의한 기록이 남지 않게).
  const fingerprint = consentFingerprint(consent);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const check = validateApplicationInput({ phone, children, companions });
    if (!check.ok) {
      setError(check.message);
      return;
    }

    const consentCheck = checkConsentAgreed(consentAgreed);
    if (!consentCheck.ok) {
      // 접혀 있으면 무엇을 체크해야 하는지 안 보인다 — 열어서 가리킨다.
      setConsentOpen(true);
      setError(consentCheck.message);
      return;
    }

    startTransition(async () => {
      const res = await submitEventApplicationAction(
        eventId,
        { phone, children, companions },
        { agreed: consentAgreed, optionalAgreed, fingerprint }
      );
      if (res.ok) {
        setDone({ updated: res.updated, waitlisted: res.waitlisted });
        router.refresh();
        return;
      }
      if (res.kind === "ALREADY_PARTICIPANT") {
        setAlreadyIn(true);
        return;
      }
      if (res.kind === "CONSENT_CHANGED") {
        // 새 문구를 받아오고 체크를 풀어 다시 읽게 한다.
        setConsentAgreed(false);
        setOptionalAgreed(false);
        setConsentOpen(true);
        router.refresh();
      }
      setError(res.message);
    });
  }

  /* ── 제출 완료 ── */
  if (done) {
    return (
      <section className="mx-auto max-w-md px-6 pb-14 pt-2">
        <div className="rounded-3xl border-2 border-[#D4E4BC] bg-white p-6 text-center shadow-sm">
          <p className="text-4xl" aria-hidden>
            🌱
          </p>
          <h2 className="mt-3 text-lg font-bold text-[#2D5A3D]">
            {done.updated ? "신청서를 수정했어요" : "신청서를 보냈어요"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#6B6560]">
            기관에서 확인 후 승인하면 참가가 확정돼요.
            <br />
            이 초대장을 다시 열면 진행 상태를 볼 수 있어요.
          </p>
          {done.waitlisted && (
            <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900">
              ⏳ 현재 정원이 찼어요. 대기 접수로 등록됐습니다.
            </p>
          )}
        </div>
      </section>
    );
  }

  /* ── 이미 참가 중인 연락처 ── */
  if (alreadyIn) {
    return (
      <section className="mx-auto max-w-md px-6 pb-14 pt-2">
        <div className="rounded-3xl border-2 border-emerald-200 bg-emerald-50/70 p-6 text-center shadow-sm">
          <p className="text-4xl" aria-hidden>
            🎪
          </p>
          <h2 className="mt-3 text-lg font-bold text-[#2D5A3D]">
            이미 참가 중이에요
          </h2>
          <p className="mt-2 text-sm text-[#4A4340]">
            신청하지 않아도 바로 입장하실 수 있어요.
          </p>
          <Link
            href={`/api/user/enter-event?event_id=${eventId}`}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-6 py-3.5 text-base font-bold text-white shadow-md"
          >
            <span aria-hidden>🏠</span>
            <span>행사 입장하기</span>
          </Link>
        </div>
      </section>
    );
  }

  /* ── 신청 폼 ── */
  return (
    <section id="apply" className="mx-auto max-w-md scroll-mt-4 px-6 pb-14 pt-2">
      <div className="rounded-3xl border-2 border-[#D4E4BC] bg-white p-6 shadow-sm">
        <div className="text-center">
          <p className="text-3xl" aria-hidden>
            🌱
          </p>
          <h2 className="mt-2 text-lg font-bold text-[#2D5A3D]">참가 신청</h2>
          <p className="mt-1 text-xs text-[#6B6560]">
            아래 내용을 적어주시면 기관에서 확인 후 승인해 드려요.
          </p>
          {closeLabel && (
            <p className="mt-2 inline-block rounded-full bg-[#F5F1E8] px-3 py-1 text-[11px] font-semibold text-[#6B4423]">
              🕘 {closeLabel}
            </p>
          )}
        </div>

        {atCapacity && (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-relaxed text-amber-900">
            ⏳ 정원{capacity ? ` ${capacity}명` : ""}이 찼어요
            {approvedPeople > 0 ? ` (현재 ${approvedPeople}명 승인)` : ""}.
            <br />
            지금 신청하시면 <b>대기 접수</b>로 등록되고, 자리가 나면 기관에서
            승인해 드려요.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
            >
              {error}
            </div>
          )}

          {/* 자녀 — 반명 + 원아명 한 쌍이 한 줄 */}
          <div className="space-y-3">
            {children.map((c, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#E8DDC8] bg-[#FFFDF8] p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#6B4423]">
                    {children.length > 1 ? `👶 아이 ${i + 1}` : "👶 참가 아이"}
                  </span>
                  {children.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeChild(i)}
                      disabled={pending}
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold text-[#8B7F75] hover:bg-[#F5F1E8] hover:text-rose-600"
                    >
                      ✕ 빼기
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
                      🏫 반명
                    </span>
                    <input
                      type="text"
                      value={c.className}
                      onChange={(e) =>
                        patchChild(i, { className: e.target.value })
                      }
                      placeholder="햇살반"
                      maxLength={50}
                      disabled={pending}
                      className={INPUT_CLS}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
                      👶 원아명
                    </span>
                    <input
                      type="text"
                      value={c.name}
                      onChange={(e) => patchChild(i, { name: e.target.value })}
                      placeholder="홍유빈"
                      maxLength={50}
                      required
                      disabled={pending}
                      className={INPUT_CLS}
                    />
                  </label>
                </div>
              </div>
            ))}

            {children.length < MAX_APPLICATION_CHILDREN && (
              <button
                type="button"
                onClick={addChild}
                disabled={pending}
                className="w-full rounded-2xl border border-dashed border-[#D4E4BC] bg-[#F5F1E8]/60 py-3 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-50"
              >
                + 자녀 추가 (형제·자매)
              </button>
            )}
          </div>

          {/* 연락처 */}
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-[#2D5A3D]">
              📞 학부모 연락처
            </span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="010-1234-5678"
              required
              disabled={pending}
              className={INPUT_CLS}
            />
            <span className="mt-1 block text-[11px] text-[#6B6560]">
              🌿 승인 후 이 번호로 로그인하면 바로 입장돼요.
            </span>
          </label>

          {/* 함께 오시는 분 — 유형 칩으로 추가, 총 인원은 자동 합산 */}
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-[#2D5A3D]">
              👨‍👩‍👧 함께 오시는 분
            </span>
            <span className="mb-2 block text-[11px] text-[#6B6560]">
              아이와 같이 오시는 분을 눌러서 추가해 주세요. 같은 칩을 두 번 누르면
              2명이 돼요.
            </span>

            <div className="flex flex-wrap gap-1.5">
              {COMPANION_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => addCompanion(p)}
                  disabled={
                    pending || companions.length >= MAX_APPLICATION_COMPANIONS
                  }
                  className="rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-3 py-1.5 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#E8DDC8] active:scale-95 disabled:opacity-40"
                >
                  + {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => addCompanion({ label: "", kind: "ADULT" })}
                disabled={
                  pending || companions.length >= MAX_APPLICATION_COMPANIONS
                }
                className="rounded-full border border-dashed border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-bold text-[#8B7F75] transition hover:text-[#2D5A3D] disabled:opacity-40"
              >
                ✏️ 직접 입력
              </button>
            </div>

            {companions.length > 0 && (
              <ul className="mt-3 space-y-2">
                {companions.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={c.label}
                      onChange={(e) =>
                        patchCompanion(i, { label: e.target.value })
                      }
                      placeholder="예: 이모부"
                      maxLength={MAX_COMPANION_LABEL_LENGTH}
                      // 직접 입력으로 방금 추가된 빈 줄에 바로 커서가 가도록.
                      autoFocus={c.label === ""}
                      disabled={pending}
                      aria-label={`함께 오시는 분 ${i + 1} 관계`}
                      className="min-w-0 flex-1 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm font-semibold text-[#2D5A3D] outline-none placeholder:font-normal placeholder:text-[#8B7F75] focus:border-[#3A7A52] disabled:opacity-50"
                    />
                    <select
                      value={c.kind}
                      onChange={(e) =>
                        patchCompanion(i, {
                          kind: e.target.value as CompanionKind,
                        })
                      }
                      disabled={pending}
                      aria-label={`함께 오시는 분 ${i + 1} 구분`}
                      className="shrink-0 rounded-xl border border-[#D4E4BC] bg-white px-2 py-2.5 text-xs font-bold text-[#2D5A3D] outline-none focus:border-[#3A7A52] disabled:opacity-50"
                    >
                      <option value="ADULT">🧑 성인</option>
                      <option value="SENIOR">👴 조부모</option>
                      <option value="CHILD">👶 아동</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeCompanion(i)}
                      disabled={pending}
                      aria-label={`함께 오시는 분 ${i + 1} 빼기`}
                      className="shrink-0 rounded-xl px-2 py-2.5 text-sm font-bold text-[#8B7F75] hover:bg-[#F5F1E8] hover:text-rose-600 disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* 합계 — 자동 계산 */}
            <div className="mt-3 rounded-2xl border border-[#D4E4BC] bg-[#F5F1E8]/70 px-4 py-3 text-center">
              <p className="text-sm font-extrabold tabular-nums text-[#2D5A3D]">
                👶 유아 {head.childCount} · 🧑 성인 {head.adultCount}
                {head.seniorCount > 0 && ` · 👴 조부모 ${head.seniorCount}`}
              </p>
              <p className="mt-0.5 text-lg font-extrabold tabular-nums text-[#2D5A3D]">
                총 {head.total}명
              </p>
              <p className="mt-1 text-[11px] text-[#6B6560]">
                참가 아이 {children.length}명이 자동으로 포함돼 있어요.
              </p>
            </div>
          </div>

          {/* 개인정보 동의 — 기본은 접혀 있고, 헤더 오른쪽 [전체 동의] 로 한 번에
              체크할 수 있다. 펼치기는 사용자가 직접 누를 때만 열리며, 그때는
              항목 이름이 아니라 **전문까지 한 번에** 보인다. */}
          <ConsentBox
            consent={consent}
            agreed={consentAgreed}
            optionalAgreed={optionalAgreed}
            onAgreedChange={setConsentAgreed}
            onOptionalChange={setOptionalAgreed}
            open={consentOpen}
            onOpenChange={setConsentOpen}
            disabled={pending}
          />

          <button
            type="submit"
            disabled={pending || !consentAgreed}
            className="min-h-[52px] w-full rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] py-3.5 text-base font-bold text-white shadow-md transition hover:shadow-lg active:scale-[0.99] disabled:opacity-60"
          >
            {pending
              ? "보내는 중..."
              : consentAgreed
                ? "🌲 신청서 보내기"
                : "개인정보 동의(필수)에 체크해 주세요"}
          </button>
        </form>
      </div>

      <ApplicationLookup eventId={eventId} />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 개인정보 동의 박스 — 전체 동의 + 접히는 항목 목록                            */
/* -------------------------------------------------------------------------- */

function ConsentBox({
  consent,
  agreed,
  optionalAgreed,
  onAgreedChange,
  onOptionalChange,
  open,
  onOpenChange,
  disabled,
}: {
  consent: OrgConsent;
  agreed: boolean;
  optionalAgreed: boolean;
  onAgreedChange: (v: boolean) => void;
  onOptionalChange: (v: boolean) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  disabled: boolean;
}) {
  const allRef = useRef<HTMLInputElement>(null);
  const hasOptional = !!consent.optional;

  // 전문 펼침 — 목록을 열 때마다 둘 다 펼친다. 직접 펼친 사람에게는 항목
  // 이름만 보여줄 이유가 없고, 다시 [전문]을 눌러야 내용이 나오면 결국
  // 아무도 읽지 않는다. 길다고 느끼면 줄별로 접을 수 있다.
  const [bodies, setBodies] = useState({ required: true, optional: true });

  // 펼치는 시점에 초기화한다. effect 로 open 을 감시하면 렌더가 한 번 더 돈다.
  function toggleOpen() {
    const next = !open;
    if (next) setBodies({ required: true, optional: true });
    onOpenChange(next);
  }

  const allAgreed = agreed && (!hasOptional || optionalAgreed);
  // 일부만 체크된 상태를 "전체 동의됨" 으로 보이게 두면 사용자를 속이는 셈이다.
  const partial = !allAgreed && (agreed || optionalAgreed);

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = partial;
  }, [partial]);

  function toggleAll(next: boolean) {
    onAgreedChange(next);
    if (hasOptional) onOptionalChange(next);
    // 여기서 목록을 펼치지 않는다 — 전체 동의는 "빠르게 넘어가기" 용도라
    // 매번 열리면 그 목적을 없앤다. 내용은 [자세히 보기]로 언제든 볼 수 있다.
  }

  const summary = allAgreed
    ? "모든 항목에 동의하셨어요"
    : agreed
      ? "필수 동의 완료 · 선택 미동의"
      : hasOptional
        ? "필수 1개 · 선택 1개"
        : "필수 1개";

  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        agreed
          ? "border-[#D4E4BC] bg-[#FFF8F0]"
          : "border-[#E5D3B8] bg-[#FFF8F0]"
      }`}
    >
      {/* 헤더 — 제목·요약이 왼쪽 한 덩어리, [전체 동의]는 그 옆 세로 중앙.
          두 줄짜리 왼쪽 블록에 맞춰 가운데를 잡아야 눈에 안 걸린다. */}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[#2D5A3D]">
            📜 개인정보 수집·이용
          </span>

          {/* 요약 + 펼치기 */}
          <button
            type="button"
            onClick={toggleOpen}
            aria-expanded={open}
            className="mt-1 flex items-center gap-1.5 text-left text-[11px] font-semibold text-[#8B7F75] hover:text-[#2D5A3D]"
          >
            <span>{summary}</span>
            <span className="underline underline-offset-2">
              {open ? "접기" : "자세히 보기"}
            </span>
            <span aria-hidden>{open ? "⌃" : "⌄"}</span>
          </button>
        </div>

        <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
          <input
            ref={allRef}
            type="checkbox"
            checked={allAgreed}
            onChange={(e) => toggleAll(e.target.checked)}
            disabled={disabled}
            className="h-5 w-5 rounded accent-[#2D5A3D] disabled:opacity-50"
          />
          <span className="text-xs font-bold text-[#2D5A3D]">전체 동의</span>
        </label>
      </div>

      {open && (
        <div className="mt-3 border-t border-[#E8DDC8] pt-1">
          <ConsentRow
            required
            label="개인정보 수집·이용 동의"
            hint="보호자 연락처, 원아명·반명, 동반 인원 · 행사 후 1년 보관"
            checked={agreed}
            onChange={onAgreedChange}
            body={consent.required}
            open={bodies.required}
            onToggle={() =>
              setBodies((b) => ({ ...b, required: !b.required }))
            }
            disabled={disabled}
          />

          {consent.optional && (
            <>
              <ConsentRow
                label="계열사 제3자 제공 동의"
                hint="(주)위너그룹 · 위너키즈스포츠 · 위너기획 · 위니키즈카페 · (주)더위너케어 · 더플레이위너"
                checked={optionalAgreed}
                onChange={onOptionalChange}
                body={consent.optional}
                open={bodies.optional}
                onToggle={() =>
                  setBodies((b) => ({ ...b, optional: !b.optional }))
                }
                disabled={disabled}
              />
              <p className="mt-2 text-[11px] leading-relaxed text-[#6B6560]">
                🌿 선택 항목에 동의하지 않으셔도 참가 신청은 그대로 접수돼요.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** 동의 한 줄 — 체크박스 + [전문] 토글. */
function ConsentRow({
  required = false,
  label,
  hint,
  checked,
  onChange,
  body,
  open,
  onToggle,
  disabled,
}: {
  required?: boolean;
  label: string;
  /** 무엇을 주는지 한 줄 요약 — 전문을 열지 않아도 대충은 알 수 있게. */
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  body: string;
  open: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  const id = `consent-${required ? "required" : "optional"}`;

  return (
    <div className="border-t border-[#E8DDC8] py-2.5 first:border-t-0">
      <div className="flex items-start gap-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[#2D5A3D] disabled:opacity-50"
        />
        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
          <span className="block text-sm font-semibold text-[#2C2C2C]">
            <span
              className={`mr-1 ${required ? "text-[#2D5A3D]" : "text-[#8B7F75]"}`}
            >
              [{required ? "필수" : "선택"}]
            </span>
            {label}
          </span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-[#6B6560]">
            {hint}
          </span>
        </label>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#8B7F75] underline underline-offset-2 hover:text-[#2D5A3D]"
        >
          {open ? "접기" : "전문"}
        </button>
      </div>

      {open && (
        <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[#E8DDC8] bg-white px-3 py-2.5 font-sans text-[11px] leading-relaxed text-[#4A4340]">
          {body}
        </pre>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 연락처로 상태 확인 — 쿠키가 날아갔거나 다른 기기에서 열었을 때               */
/* -------------------------------------------------------------------------- */

const STATUS_TEXT: Record<OrgEventApplicationStatus, string> = {
  PENDING: "⏳ 승인 대기중이에요",
  APPROVED: "✅ 승인됐어요! 바로 입장하실 수 있어요",
  REJECTED: "🌧 이번에는 참가가 어렵다고 회신됐어요",
  CANCELED: "🚫 취소된 신청이에요. 아래에서 다시 신청하실 수 있어요",
};

export function ApplicationLookup({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function check() {
    setResult(null);
    startTransition(async () => {
      const res = await lookupMyApplicationAction(eventId, phone);
      if (!res.ok) {
        setResult(res.message);
        return;
      }
      if (!res.found) {
        setResult("이 번호로 접수된 신청서가 없어요.");
        return;
      }
      setResult(
        `${STATUS_TEXT[res.status]} · ${res.maskedNames.join(", ")} ` +
          `(유아 ${res.childCount} · 성인 ${res.adultCount}` +
          `${res.seniorCount > 0 ? ` · 조부모 ${res.seniorCount}` : ""}` +
          ` · 총 ${res.partySize}명)`
      );
      // 쿠키가 심어졌으니 새로고침하면 위쪽이 상태 카드로 바뀐다.
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full text-center text-[11px] font-semibold text-[#8B7F75] underline underline-offset-2 hover:text-[#2D5A3D]"
      >
        이미 신청하셨나요? 연락처로 확인하기
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-[#E8DDC8] bg-[#FFFDF8] p-4">
      <p className="text-xs font-bold text-[#2D5A3D]">
        📮 신청 상태 확인
      </p>
      <div className="mt-2 flex gap-2">
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="010-1234-5678"
          disabled={pending}
          className="min-w-0 flex-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm text-[#2D5A3D] outline-none focus:border-[#3A7A52]"
        />
        <button
          type="button"
          onClick={check}
          disabled={pending}
          className="shrink-0 rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "확인 중" : "확인"}
        </button>
      </div>
      {result && (
        <p className="mt-2 text-xs font-semibold text-[#4A4340]">{result}</p>
      )}
    </div>
  );
}
