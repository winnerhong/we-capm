"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { TREE_LEVELS } from "@/lib/tree-growth";
import { AcornIcon } from "@/components/acorn-icon";

type FirstMission = {
  id: string;
  title: string;
  points: number | null;
  template_type: string | null;
} | null;

const TEMPLATE_ICON: Record<string, string> = {
  PHOTO: "📸",
  VIDEO: "🎥",
  LOCATION: "🏞️",
  QUIZ: "🌿",
  MIXED: "🐾",
  TEAM: "🐿️",
  TIMEATTACK: "🍃",
};

export function WelcomeWalkthrough({
  eventId,
  eventName,
  firstMission,
}: {
  eventId: string;
  eventName: string;
  firstMission: FirstMission;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const totalSteps = 5;

  // welcome_shown 표시(건너뛰기 혹은 완료 시점에도 저장)
  useEffect(() => {
    try {
      localStorage.setItem(`toriro_welcome_${eventId}`, "1");
    } catch {
      /* noop */
    }
  }, [eventId]);

  const next = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const skip = () => router.push(`/event/${eventId}`);
  const startFirstMission = () => {
    if (firstMission) router.push(`/event/${eventId}/missions/${firstMission.id}`);
    else router.push(`/event/${eventId}`);
  };

  return (
    <main className="fixed inset-0 z-[60] flex min-h-dvh flex-col bg-gradient-to-br from-[#FFF8F0] via-[#F5EFE0] to-[#E8F0E4]">
      {/* 건너뛰기 */}
      <div className="flex items-center justify-end p-4">
        <button
          type="button"
          onClick={skip}
          className="rounded-full px-3 py-1.5 text-xs text-[#6B6560] hover:bg-white/50 focus:outline-none focus:ring-2 focus:ring-[#4A7C59]/40"
          aria-label="온보딩 건너뛰기"
        >
          건너뛰기 ✕
        </button>
      </div>

      {/* 스텝 콘텐츠 */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-6 text-center">
        {step === 0 && <StepWelcome eventName={eventName} />}
        {step === 1 && <StepToriro />}
        {step === 2 && <StepForestPath />}
        {step === 3 && <StepTreeGrowth />}
        {step === 4 && <StepFirstMission mission={firstMission} />}
      </div>

      {/* 하단 컨트롤 */}
      <div className="px-6 pb-8 pt-2">
        {/* 진행 점 */}
        <div className="mb-5 flex items-center justify-center gap-2" role="tablist" aria-label="온보딩 진행 상태">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              role="tab"
              aria-selected={i === step}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-[#2D5A3D]" : "w-2 bg-[#C4B59A]/60"
              }`}
            />
          ))}
        </div>

        {step < totalSteps - 1 ? (
          <button
            type="button"
            onClick={step === 0 ? next : next}
            className="w-full rounded-2xl bg-[#2D5A3D] py-4 text-base font-bold text-white shadow-lg transition hover:bg-[#224a30] focus:outline-none focus:ring-4 focus:ring-[#4A7C59]/40 md:text-lg"
          >
            {step === 0 ? "시작하기 🐾" : "다음"}
          </button>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={startFirstMission}
              disabled={!firstMission}
              className="w-full rounded-2xl bg-[#2D5A3D] py-4 text-base font-bold text-white shadow-lg transition hover:bg-[#224a30] focus:outline-none focus:ring-4 focus:ring-[#4A7C59]/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-lg"
            >
              🌿 숲길 시작하기
            </button>
            <Link
              href={`/event/${eventId}`}
              className="block text-center text-sm text-[#6B6560] underline-offset-4 hover:underline"
            >
              나중에 할게요
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

/* =========== Step 1: 환영 인사 =========== */
function StepWelcome({ eventName }: { eventName: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-[7rem] leading-none animate-bounce md:text-[9rem] text-[#C4956A]" role="img" aria-label="도토리">
        <AcornIcon size={128} />
      </div>
      <h1 className="mt-8 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
        토리로에 오신 것을 환영해요!
      </h1>
      <p className="mt-3 max-w-xs text-base leading-relaxed text-[#6B6560] md:text-lg">
        토리와 함께 <strong className="text-[#2D5A3D]">{eventName}</strong> 숲길을
        탐험해볼까요?
      </p>
    </div>
  );
}

/* =========== Step 2: 토리 소개 =========== */
function StepToriro() {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="text-[7rem] leading-none animate-pulse md:text-[9rem]" role="img" aria-label="다람쥐 토리">
          🐿️
        </div>
        <span className="absolute -right-2 top-2 text-3xl animate-bounce md:text-4xl text-[#C4956A]"><AcornIcon size={28} /></span>
      </div>
      <h2 className="mt-8 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
        안녕하세요! 저는 토리예요
      </h2>
      <p className="mt-3 max-w-xs text-base leading-relaxed text-[#6B6560] md:text-lg">
        도토리를 모으며 숲길을 걸어봐요.
        <br />
        제가 길잡이가 되어드릴게요!
      </p>
    </div>
  );
}

/* =========== Step 3: 숲길 설명 =========== */
function StepForestPath() {
  const steps: Array<{ emoji: React.ReactNode; label: string }> = [
    { emoji: "🎯", label: "미션" },
    { emoji: "📸", label: "수행" },
    { emoji: "✅", label: "승인" },
    { emoji: <AcornIcon size={28} className="text-[#C4956A]" />, label: "도토리" },
  ];
  return (
    <div className="flex flex-col items-center">
      <div className="text-[6rem] leading-none animate-bounce md:text-[8rem]" role="img" aria-label="미션 아이콘">
        🎯
      </div>
      <h2 className="mt-6 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
        숲길은 이렇게 진행돼요
      </h2>

      {/* 흐름 */}
      <div className="mt-6 flex items-center justify-center gap-1 md:gap-2">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 text-2xl shadow-sm md:h-16 md:w-16 md:text-3xl">
                {s.emoji}
              </div>
              <div className="mt-1.5 text-[11px] font-semibold text-[#2D5A3D] md:text-xs">
                {s.label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <span className="mx-0.5 text-xl text-[#A8C686] md:mx-1.5">→</span>
            )}
          </div>
        ))}
      </div>

      <p className="mt-6 max-w-xs text-sm leading-relaxed text-[#6B6560] md:text-base">
        미션 수행 → 도토리 획득 → 보상 수령
      </p>
    </div>
  );
}

/* =========== Step 4: 나무 성장 =========== */
function StepTreeGrowth() {
  return (
    <div className="flex flex-col items-center">
      <div className="text-[6rem] leading-none animate-pulse md:text-[8rem]" role="img" aria-label="자라는 나무">
        🌲
      </div>
      <h2 className="mt-6 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
        나만의 나무가 자라요
      </h2>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#6B6560] md:text-base">
        도토리를 모을수록 나무가 한 단계씩 성장해요.
      </p>

      {/* 5단계 */}
      <div className="mt-6 w-full max-w-sm rounded-2xl border border-[#D4E4BC] bg-white/70 p-4 shadow-sm">
        <div className="flex items-end justify-between gap-1">
          {TREE_LEVELS.map((l, i) => (
            <div key={l.level} className="flex flex-1 flex-col items-center">
              <div
                className="text-3xl md:text-4xl"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                {l.emoji}
              </div>
              <div className="mt-1 text-[10px] font-semibold text-[#2D5A3D] md:text-xs">
                {l.name}
              </div>
              <div className="text-[9px] text-[#6B6560] md:text-[10px]">
                <AcornIcon size={10} /> {l.min}+
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========== Step 5: 첫 숲길 추천 =========== */
function StepFirstMission({ mission }: { mission: FirstMission }) {
  const icon = mission?.template_type ? TEMPLATE_ICON[mission.template_type] ?? "🎯" : "🎯";

  return (
    <div className="flex w-full flex-col items-center">
      <div className="text-[5.5rem] leading-none animate-bounce md:text-[7rem]" role="img" aria-label="환영">
        🐾
      </div>
      <h2 className="mt-6 text-2xl font-extrabold text-[#2D5A3D] md:text-3xl">
        첫 숲길을 추천해드려요
      </h2>

      {mission ? (
        <div className="mt-6 w-full max-w-sm rounded-2xl border-2 border-[#A8C686] bg-white p-5 text-left shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <span className="rounded-full bg-[#D4E4BC] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
              추천
            </span>
          </div>
          <h3 className="mt-2 text-lg font-bold text-[#2D5A3D]">{mission.title}</h3>
          <p className="mt-1 text-sm text-[#6B6560]"><AcornIcon /> {mission.points ?? 0}개</p>
        </div>
      ) : (
        <p className="mt-6 max-w-xs text-sm text-[#6B6560]">
          아직 준비된 숲길이 없어요. 조금만 기다려주세요!
        </p>
      )}

      <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#6B6560] md:text-base">
        이 숲길부터 시작해볼까요?
      </p>
    </div>
  );
}
