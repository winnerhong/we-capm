"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addBonusSiblingAction,
  claimOnboardingRewardAction,
  updateChildAction,
} from "../profile/actions";
import {
  computeOnboardingProgress,
  type OnboardingProgress,
} from "@/lib/app-user/onboarding";
import { AcornIcon } from "@/components/acorn-icon";

type ChildInitial = {
  id: string;
  name: string;
  birth_date: string | null;
  gender: "M" | "F" | null;
};

type Props = {
  userId: string;
  initialParentName: string;
  initialChildren: ChildInitial[];
  initialRewarded: boolean;
  initialBonusCount: number;
};

const BONUS_LIMIT = 2;

type Gender = "M" | "F" | "";

type ChildForm = {
  id: string;
  name: string;
  birthYYMMDD: string;
  gender: Gender;
};

function toYYMMDD(iso: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  return `${m[1].slice(2)}${m[2]}${m[3]}`;
}

export function OnboardingWizard({
  initialChildren,
  initialRewarded,
  initialBonusCount,
}: Props) {
  const router = useRouter();

  const [childForms, setChildForms] = useState<ChildForm[]>(() =>
    initialChildren.map((c) => ({
      id: c.id,
      name: c.name,
      birthYYMMDD: toYYMMDD(c.birth_date),
      gender: c.gender ?? "",
    }))
  );

  const [bonusCount, setBonusCount] = useState<number>(initialBonusCount);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  // step: 0=welcome, 1..N=children(i-1), N+1=finish
  const [step, setStep] = useState(0);
  const [celebration, setCelebration] = useState<null | {
    balance: number;
  }>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 완전히 보상받아서 더 이상 받을게 없음 = 기본 지급 완료 + 보너스 상한 도달
  const fullyDone = initialRewarded && bonusCount >= BONUS_LIMIT;

  const storageKey = "tori_onboarding_seen";

  const progress: OnboardingProgress = useMemo(() => {
    return computeOnboardingProgress(
      { parent_name: null },
      childForms.map((c) => ({
        id: c.id,
        name: c.name,
        birth_date: c.birthYYMMDD ? c.birthYYMMDD : null,
        gender: c.gender === "M" || c.gender === "F" ? c.gender : null,
      }))
    );
  }, [childForms]);

  // 첫 입장 자동 오픈 (완료 전 + localStorage 없음 + 아직 보상 안 받음 + 자녀 있음)
  useEffect(() => {
    if (initialRewarded) return;
    if (progress.totalCount === 0) return;
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(storageKey);
    if (!seen && !progress.allDone) {
      setModalOpen(true);
      window.localStorage.setItem(storageKey, "1");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialRewarded) setBannerOpen(false);
  }, [initialRewarded]);

  // 100% 완성인데 아직 기본 보상 미청구 상태면 자동 청구 → 배너가 자연스럽게 사라짐.
  useEffect(() => {
    if (initialRewarded) return;
    if (!progress.allDone) return;
    if (modalOpen) return; // 모달 플로우가 직접 claim 하도록 양보
    startTransition(async () => {
      try {
        const result = await claimOnboardingRewardAction();
        if (result.rewarded) {
          setCelebration({ balance: result.newBalance });
        }
        router.refresh();
      } catch {
        // 실패해도 UI는 조용히 — 다음 진입 시 재시도
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.allDone, initialRewarded]);

  const totalSteps = 1 + childForms.length; // welcome + N children, finish는 별도

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setStep(0);
    setError(null);
  }, []);

  const openModal = useCallback(() => {
    // 첫 미완 자녀 스텝으로 점프
    let target = 1;
    for (let i = 0; i < childForms.length; i++) {
      const c = childForms[i];
      if (!c.birthYYMMDD || !c.gender) {
        target = 1 + i;
        break;
      }
      target = 1 + childForms.length; // 모두 완료 → finish
    }
    setStep(target);
    setError(null);
    setModalOpen(true);
  }, [childForms]);

  /* ------------------------- 스텝별 저장 핸들러 ------------------------- */

  const saveChild = (idx: number) => {
    setError(null);
    const c = childForms[idx];
    if (!c) return;
    const digits = c.birthYYMMDD.replace(/\D/g, "");
    if (digits.length !== 6 && digits.length !== 8) {
      setError("생년월일은 6자리(YYMMDD)로 입력해 주세요");
      return;
    }
    if (c.gender !== "M" && c.gender !== "F") {
      setError("성별을 선택해 주세요");
      return;
    }

    const fd = new FormData();
    fd.set("name", c.name);
    fd.set("birth_date", digits);
    fd.set("gender", c.gender);
    fd.set("is_enrolled", "1"); // 원생 기본값 유지

    startTransition(async () => {
      try {
        await updateChildAction(c.id, fd);
        if (idx + 1 < childForms.length) {
          setStep(1 + idx + 1);
        } else {
          claimReward();
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 실패");
      }
    });
  };

  const claimReward = () => {
    startTransition(async () => {
      try {
        const result = await claimOnboardingRewardAction();
        if (result.rewarded) {
          setCelebration({ balance: result.newBalance });
        }
        setStep(1 + childForms.length); // finish
        router.refresh();
      } catch {
        setStep(1 + childForms.length);
      }
    });
  };

  const updateChildForm = (idx: number, patch: Partial<ChildForm>) => {
    setChildForms((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  };

  /* ------------------------------- 가드 -------------------------------- */

  // 수집할 대상 없음(자녀 0명) → 아예 렌더 안 함
  if (progress.totalCount === 0) return null;

  // 기본 보상 + 보너스 상한 모두 달성 → 배너/모달 완전히 숨김
  if (fullyDone && !modalOpen && !celebration) return null;

  // 이미 기본 보상 받음 + 모달 닫힘 + 축하 사라짐 → 렌더 안 함 (보너스만 남은 경우는 배너 유지)
  if (initialRewarded && bonusCount >= BONUS_LIMIT && !modalOpen && !celebration)
    return null;

  // 배너 닫힘 + 모달 닫힘 + 축하 없음 → 렌더 안 함
  if (!bannerOpen && !modalOpen && !celebration) return null;

  const bannerBar = progress.percent;

  return (
    <>
      {/* 홈 상단 배너 — 100% 완성 시 숨김 (자동 청구 로직에 의해 initialRewarded 도 곧 true 가 됨) */}
      {!initialRewarded && !progress.allDone && bannerOpen && !modalOpen && (
        <button
          type="button"
          onClick={openModal}
          className="group block w-full overflow-hidden rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-4 text-left shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <span aria-hidden>📝</span>
                <span>프로필 완성도 {progress.percent}%</span>
                {progress.allDone && (
                  <span className="ml-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white">
                    <AcornIcon /> 도토리 받기!
                  </span>
                )}
              </p>
              <p className="mt-1 text-[11px] text-[#6B6560]">
                {progress.allDone
                  ? "🎉 모두 완료됐어요! 눌러서 도토리 1개 받기"
                  : <>{progress.totalCount - progress.doneCount}가지만 더 채우면 <AcornIcon /> 도토리 1개 드려요</>}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[#2D5A3D] px-3 py-1.5 text-xs font-bold text-white group-hover:bg-[#234a30]">
              이어서 완성 →
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-emerald-600 transition-all"
              style={{ width: `${bannerBar}%` }}
            />
          </div>
        </button>
      )}

      {/* 모달 위저드 */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[#D4E4BC] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D4E4BC] bg-[#F5F1E8] px-4 py-3">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalSteps + 1 }).map((_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className={`h-2 w-2 rounded-full transition ${
                      i < step
                        ? "bg-emerald-500"
                        : i === step
                        ? "bg-[#2D5A3D]"
                        : "bg-[#D4E4BC]"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full px-2 py-1 text-xs text-[#6B6560] hover:bg-white"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                ⚠️ {error}
              </div>
            )}

            <div className="space-y-4 p-6">
              {step === 0 && (
                <WelcomeStep
                  onNext={() => setStep(1)}
                  totalToDo={progress.totalCount - progress.doneCount}
                />
              )}

              {step >= 1 &&
                step <= childForms.length &&
                (() => {
                  const idx = step - 1;
                  const c = childForms[idx];
                  return (
                    <ChildStep
                      child={c}
                      indexLabel={`${idx + 1}/${childForms.length}`}
                      onChange={(patch) => updateChildForm(idx, patch)}
                      onBack={() => setStep(idx === 0 ? 0 : idx)}
                      onNext={() => saveChild(idx)}
                      pending={pending}
                    />
                  );
                })()}

              {step === 1 + childForms.length && (
                <BonusStep
                  baseRewarded={!!celebration}
                  balance={celebration?.balance ?? 0}
                  bonusCount={bonusCount}
                  bonusLimit={BONUS_LIMIT}
                  enrolledSurnames={Array.from(
                    new Set(
                      childForms
                        .map((c) => c.name.trim().charAt(0))
                        .filter((s) => s.length > 0)
                    )
                  )}
                  onAdded={(balance, newCount) => {
                    setCelebration({ balance });
                    setBonusCount(newCount);
                  }}
                  onClose={closeModal}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {celebration && !modalOpen && (
        <Link
          href="/acorns"
          role="status"
          onClick={() => setCelebration(null)}
          className="fixed inset-x-0 top-4 z-50 mx-auto flex w-fit items-center gap-1.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900 shadow-lg transition hover:bg-amber-100 active:scale-95"
        >
          <AcornIcon size={18} className="text-amber-700" />
          <span>도토리 +1!</span>
          <span className="text-[11px] font-semibold text-amber-800">
            My도토리 {celebration.balance}
          </span>
          <span aria-hidden className="ml-0.5 text-xs">
            →
          </span>
        </Link>
      )}
    </>
  );
}

/* ------------------------------ Step 컴포넌트 ----------------------------- */

function WelcomeStep({
  onNext,
  totalToDo,
}: {
  onNext: () => void;
  totalToDo: number;
}) {
  return (
    <div className="space-y-4 text-center">
      <div className="text-5xl" aria-hidden>
        👋
      </div>
      <h2 className="text-lg font-bold text-[#2D5A3D]">
        토리로에 오신 걸 환영해요!
      </h2>
      <p className="text-sm text-[#6B6560]">
        {totalToDo > 0
          ? <>{totalToDo}가지 정보만 채우면 <AcornIcon /> 도토리 1개를 드릴게요</>
          : "프로필을 확인하고 마무리해요"}
      </p>
      <button
        type="button"
        onClick={onNext}
        className="w-full rounded-2xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] py-3 text-sm font-bold text-white shadow-md"
      >
        시작하기
      </button>
    </div>
  );
}

function ChildStep({
  child,
  indexLabel,
  onChange,
  onBack,
  onNext,
  pending,
}: {
  child: ChildForm | undefined;
  indexLabel: string;
  onChange: (patch: Partial<ChildForm>) => void;
  onBack: () => void;
  onNext: () => void;
  pending: boolean;
}) {
  if (!child) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-3xl" aria-hidden>
          🧒
        </div>
        <span className="text-[11px] font-semibold text-[#8B7F75]">
          {indexLabel}
        </span>
      </div>
      <h2 className="text-base font-bold text-[#2D5A3D]">
        {child.name}의 정보를 알려주세요
      </h2>

      <div>
        <label className="mb-1 block text-xs font-semibold text-[#6B6560]">
          생년월일 (YYMMDD)
        </label>
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          value={child.birthYYMMDD}
          onChange={(e) =>
            onChange({
              birthYYMMDD: e.target.value.replace(/\D/g, "").slice(0, 6),
            })
          }
          placeholder="예: 161001"
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3 font-mono text-sm text-[#2D5A3D] outline-none focus:border-[#3A7A52] focus:ring-2 focus:ring-[#3A7A52]/30"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-[#6B6560]">
          성별
        </label>
        <div
          className="grid grid-cols-2 gap-1 rounded-xl border border-[#D4E4BC] bg-white p-1"
          role="radiogroup"
        >
          <button
            type="button"
            onClick={() => onChange({ gender: "M" })}
            aria-pressed={child.gender === "M"}
            className={`h-10 rounded-lg text-sm font-bold transition ${
              child.gender === "M"
                ? "bg-sky-500 text-white"
                : "text-[#6B6560] hover:bg-[#F5F1E8]"
            }`}
          >
            🧒 남아
          </button>
          <button
            type="button"
            onClick={() => onChange({ gender: "F" })}
            aria-pressed={child.gender === "F"}
            className={`h-10 rounded-lg text-sm font-bold transition ${
              child.gender === "F"
                ? "bg-rose-500 text-white"
                : "text-[#6B6560] hover:bg-[#F5F1E8]"
            }`}
          >
            👧 여아
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="flex-1 rounded-2xl border border-[#D4E4BC] bg-white py-2.5 text-sm font-semibold text-[#6B6560] disabled:opacity-50"
        >
          ← 이전
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={pending}
          className="flex-1 rounded-2xl bg-[#2D5A3D] py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          다음 →
        </button>
      </div>
    </div>
  );
}

/**
 * 보너스 Step — 기본 보상 안내 + 형제/자매 추가 시 추가 도토리 지급.
 * 성 검증은 서버액션에서 수행, 실패 시 inline 에러 표시.
 */
function BonusStep({
  baseRewarded,
  balance,
  bonusCount,
  bonusLimit,
  enrolledSurnames,
  onAdded,
  onClose,
}: {
  baseRewarded: boolean;
  balance: number;
  bonusCount: number;
  bonusLimit: number;
  enrolledSurnames: string[];
  onAdded: (newBalance: number, newBonusCount: number) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [error, setError] = useState<string | null>(null);
  const [addedNames, setAddedNames] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const capReached = bonusCount >= bonusLimit;
  const remaining = Math.max(0, bonusLimit - bonusCount);

  const onAdd = () => {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("이름을 입력해 주세요");
      return;
    }
    if (gender !== "M" && gender !== "F") {
      setError("성별을 선택해 주세요");
      return;
    }
    const digits = birth.replace(/\D/g, "");
    if (digits.length !== 6 && digits.length !== 8) {
      setError("생년월일은 6자리(YYMMDD)로 입력해 주세요");
      return;
    }
    // 월/일 범위 + 달력 유효성 검증
    const mm =
      digits.length === 6
        ? parseInt(digits.slice(2, 4), 10)
        : parseInt(digits.slice(4, 6), 10);
    const dd =
      digits.length === 6
        ? parseInt(digits.slice(4, 6), 10)
        : parseInt(digits.slice(6, 8), 10);
    if (mm < 1 || mm > 12) {
      setError(`월은 01~12 사이여야 해요 (입력: ${String(mm).padStart(2, "0")})`);
      return;
    }
    if (dd < 1 || dd > 31) {
      setError(`일은 01~31 사이여야 해요 (입력: ${String(dd).padStart(2, "0")})`);
      return;
    }

    const fd = new FormData();
    fd.set("name", trimmedName);
    fd.set("birth_date", digits);
    fd.set("gender", gender);

    startTransition(async () => {
      const res = await addBonusSiblingAction(fd);
      if (res.ok) {
        onAdded(res.newBalance, res.bonusCount);
        setAddedNames((prev) => [...prev, trimmedName]);
        setName("");
        setBirth("");
        setGender("");
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* 기본 보상 결과 */}
      <div className="space-y-2 rounded-2xl bg-[#F5F1E8] p-4 text-center">
        <div className="text-4xl" aria-hidden>
          🎉
        </div>
        <h2 className="text-base font-bold text-[#2D5A3D]">
          기본 정보 완성!
        </h2>
        {baseRewarded && (
          <p className="text-xs font-semibold text-amber-900">
            <AcornIcon /> 도토리 1개 지급 · My도토리 {balance}개
          </p>
        )}
      </div>

      {/* 형제/자매 보너스 안내 */}
      <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-amber-900">
            👫 형제·자매도 있어요?
          </p>
          <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900 tabular-nums">
            {bonusCount}/{bonusLimit}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-[#6B6560]">
          {capReached
            ? `🎯 보너스 도토리 ${bonusLimit}개를 모두 받았어요!`
            : <>추가할 때마다 <AcornIcon /> 도토리 1개씩 더 받아요 (앞으로 {remaining}개 더)</>}
          {!capReached && enrolledSurnames.length > 0 && (
            <> · 성이 <b>{enrolledSurnames.join(", ")}</b> 와 같아야 해요</>
          )}
        </p>

        {addedNames.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1">
            {addedNames.map((n, i) => (
              <li
                key={`${n}-${i}`}
                className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white"
              >
                ✨ {n} +1
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p
            role="alert"
            className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-800"
          >
            ⚠️ {error}
          </p>
        )}

        {!capReached && (
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="형제/자매 이름 (예: 홍길동)"
              disabled={pending}
              className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm text-[#2D5A3D] outline-none focus:border-[#3A7A52] focus:ring-2 focus:ring-[#3A7A52]/30 disabled:opacity-50"
            />
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={birth}
              onChange={(e) =>
                setBirth(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="생년월일 YYMMDD (예: 180301)"
              disabled={pending}
              className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 font-mono text-sm text-[#2D5A3D] outline-none focus:border-[#3A7A52] focus:ring-2 focus:ring-[#3A7A52]/30 disabled:opacity-50"
            />
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#D4E4BC] bg-white p-1">
              <button
                type="button"
                onClick={() => setGender("M")}
                aria-pressed={gender === "M"}
                disabled={pending}
                className={`h-9 rounded-lg text-xs font-bold transition ${
                  gender === "M"
                    ? "bg-sky-500 text-white"
                    : "text-[#6B6560] hover:bg-[#F5F1E8]"
                }`}
              >
                🧒 남아
              </button>
              <button
                type="button"
                onClick={() => setGender("F")}
                aria-pressed={gender === "F"}
                disabled={pending}
                className={`h-9 rounded-lg text-xs font-bold transition ${
                  gender === "F"
                    ? "bg-rose-500 text-white"
                    : "text-[#6B6560] hover:bg-[#F5F1E8]"
                }`}
              >
                👧 여아
              </button>
            </div>
            <button
              type="button"
              onClick={onAdd}
              disabled={pending}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
            >
              {pending ? "추가 중..." : <><AcornIcon /> +1 받고 추가하기</>}
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-2xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] py-3 text-sm font-bold text-white shadow-md"
      >
        {addedNames.length > 0 ? "마치기" : "홈으로"}
      </button>
    </div>
  );
}
