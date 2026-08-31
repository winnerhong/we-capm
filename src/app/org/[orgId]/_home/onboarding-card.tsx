// 「문 열기까지 세 걸음」 — 처음 온 기관이 홈에서 제일 먼저 보는 카드.
//
// 예전 홈은 "프로필 완성도 42%" 하고 [이어서 완성 →] 버튼 하나를 /settings 로
// 보냈다. 그런데 12항목 중 5개는 서류 업로드고 그 다섯은 각각 주소가 다르다.
// 그래서 설정 화면을 아무리 꼼꼼히 채워도 7/12 = 58% 에서 멈췄다.
//
// 이 카드는 **남은 항목 자체를** 줄로 깐다. 각 줄이 자기 주소를 갖고, 양식이
// 있는 서류는 「📥 양식」 을 같이 준다. 조회는 안 는다 — 홈은 이미 완성도를
// 끝까지 계산해 놓고 숫자 셋만 남기고 버리고 있었다(org-home/onboarding.ts).
//
// ⚠ 링크 나열이라 서버 컴포넌트다(클라이언트 번들에 안 실린다).

import Link from "next/link";
import {
  buildOnboardingSteps,
  currentStepIndex,
  type OnboardingStep,
  type ProfileGroupSummary,
} from "@/lib/org-home/onboarding";

const MARK = ["①", "②", "③"];

/** 한 걸음 안에서 접지 않고 다 보여 줄 최대 줄 수. */
const MAX_ROWS = 4;

type Props = {
  orgId: string;
  groups: ProfileGroupSummary[];
  eventCount: number;
};

export function OnboardingCard({ orgId, groups, eventCount }: Props) {
  const steps = buildOnboardingSteps(orgId, groups, eventCount);
  const openIdx = currentStepIndex(steps);

  // 세 걸음이 다 끝났으면 이 카드는 할 말이 없다.
  if (openIdx < 0) return null;

  const totalDone = steps.reduce((n, s) => n + s.completed, 0);
  const totalAll = steps.reduce((n, s) => n + s.total, 0);

  return (
    <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-extrabold text-[#2D5A3D]">
          🌱 문 열기까지 세 걸음
        </h2>
        <span className="shrink-0 text-xs font-bold tabular-nums text-[#6B6560]">
          {totalDone} / {totalAll}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#6B6560]">
        여기까지 채우면 아이들을 맞을 준비가 끝나요.
      </p>

      <ol className="mt-4 space-y-2">
        {steps.map((step, i) => (
          <li key={step.key}>
            <StepRow step={step} mark={MARK[i]} open={i === openIdx} />
            {i === openIdx && <StepBody step={step} />}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function StepRow({
  step,
  mark,
  open,
}: {
  step: OnboardingStep;
  mark: string;
  open: boolean;
}) {
  // 끝난 걸음 · 지금 걸음 · 아직 안 온 걸음을 **테두리로** 가른다.
  // 색으로만 가르면 지금 걸음이 어디인지 흑백 화면에서 사라진다.
  const tone = step.done
    ? "border-[#D4E4BC] bg-[#E8F0E4]"
    : open
      ? "border-[#2D5A3D] bg-white ring-2 ring-[#2D5A3D]/15"
      : "border-[#E8DDC8] bg-[#FDFBF6]";

  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 ${tone}`}
      aria-current={open ? "step" : undefined}
    >
      <span
        aria-hidden
        className={`w-4 shrink-0 text-center text-sm font-bold ${
          step.done || open ? "text-[#2D5A3D]" : "text-[#8B7F75]"
        }`}
      >
        {step.done ? "✓" : mark}
      </span>
      <span aria-hidden className="text-base">
        {step.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[#2C2C2C]">
          {step.label}
          <span className="sr-only">
            {step.done ? " — 완료" : open ? " — 지금 할 일" : " — 남음"}
          </span>
        </span>
        {open && !step.done && (
          <span className="block text-[11px] leading-tight text-[#6B6560]">
            {step.hint}
          </span>
        )}
      </span>
      <span className="shrink-0 text-xs font-bold tabular-nums text-[#6B6560]">
        {step.total > 1 ? `${step.completed} / ${step.total}` : ""}
      </span>
    </div>
  );
}

function StepBody({ step }: { step: OnboardingStep }) {
  // 채울 항목이 없는 걸음(첫 행사) — 버튼 하나.
  if (step.cta && step.missing.length === 0) {
    return (
      <div className="mt-2 flex justify-end pl-3">
        <Link
          href={step.cta.href}
          className="inline-flex items-center gap-1 rounded-2xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#234a30] active:scale-[0.98]"
        >
          {step.cta.label}
          <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  if (step.missing.length === 0) return null;

  const shown = step.missing.slice(0, MAX_ROWS);
  const rest = step.missing.length - shown.length;

  return (
    <ul className="mt-1.5 space-y-1 border-l-2 border-dashed border-[#D4E4BC] pl-3">
      {shown.map((f) => (
        <li
          key={f.id}
          className="flex items-center gap-2 rounded-xl px-1 py-1.5"
        >
          <span aria-hidden className="text-sm">
            {f.icon ?? "📝"}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-[#2C2C2C]">
            {f.label}
          </span>
          {f.downloadHref && (
            <Link
              href={f.downloadHref}
              className="shrink-0 rounded-lg border border-[#B6DCEA] bg-[#E0F0F7] px-2 py-1 text-[11px] font-bold text-[#10566E] transition hover:bg-[#CFE8F3]"
            >
              {f.downloadLabel ?? "📥 양식"}
            </Link>
          )}
          {f.href && (
            <Link
              href={f.href}
              className="shrink-0 rounded-lg bg-[#2D5A3D] px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-[#234a30]"
            >
              채우기
            </Link>
          )}
        </li>
      ))}
      {rest > 0 && (
        <li className="px-1 pt-0.5 text-[11px] font-semibold text-[#6B6560]">
          {rest}개 더 — 하나씩 채우면 돼요
        </li>
      )}
    </ul>
  );
}
