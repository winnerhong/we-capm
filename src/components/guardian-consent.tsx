"use client";

import { useState } from "react";

interface Props {
  onConfirm: (data: { isGuardian: boolean; childBirthYear?: number }) => void;
}

export function GuardianConsent({ onConfirm }: Props) {
  const [hasChild, setHasChild] = useState<boolean | null>(null);
  const [childBirthYear, setChildBirthYear] = useState("");
  const [isGuardian, setIsGuardian] = useState(false);

  const currentYear = new Date().getFullYear();
  const childAge = childBirthYear ? currentYear - Number(childBirthYear) : 0;
  const needsGuardianConsent = childAge > 0 && childAge < 14;

  const disabled =
    hasChild === null ||
    (hasChild === true && !childBirthYear) ||
    (needsGuardianConsent && !isGuardian);

  return (
    <div className="space-y-4 rounded-2xl border-2 border-[#D4E4BC] bg-[#FFF8F0] p-5">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-2xl">
          👨‍👩‍👧
        </span>
        <div>
          <h3 className="font-bold text-[#2D5A3D]">아이와 함께하시나요?</h3>
          <p className="text-xs text-[#6B6560]">
            아이의 안전을 위한 확인 절차입니다
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setHasChild(true)}
          aria-pressed={hasChild === true}
          className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40 ${
            hasChild === true
              ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
              : "border-neutral-200 bg-white text-[#6B6560]"
          }`}
        >
          네, 아이와 참여해요
        </button>
        <button
          type="button"
          onClick={() => {
            setHasChild(false);
            setChildBirthYear("");
            setIsGuardian(false);
          }}
          aria-pressed={hasChild === false}
          className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40 ${
            hasChild === false
              ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
              : "border-neutral-200 bg-white text-[#6B6560]"
          }`}
        >
          성인만 참여해요
        </button>
      </div>

      {hasChild && (
        <div className="space-y-3 pt-2">
          <label className="block">
            <span className="text-sm font-semibold text-[#2C2C2C]">
              아이 출생 연도
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={childBirthYear}
              onChange={(e) => setChildBirthYear(e.target.value)}
              placeholder="예) 2018"
              min="2010"
              max={currentYear}
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#2D5A3D]"
            />
          </label>

          {needsGuardianConsent && (
            <div className="space-y-2 rounded-xl border border-[#C4956A] bg-[#FFF4E5] p-3">
              <p className="text-xs font-semibold text-[#8B6F47]">
                ⚠️ 만 14세 미만 아동의 개인정보 처리를 위해 보호자(법정대리인)
                동의가 필요합니다.
              </p>
              <label className="flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={isGuardian}
                  onChange={(e) => setIsGuardian(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#2D5A3D]"
                />
                <span className="text-[#2C2C2C]">
                  본인은 해당 아동의{" "}
                  <strong>법정대리인(보호자)</strong>이며, 본인의 책임 하에
                  아동의 개인정보(이름, 사진 등) 처리에 동의합니다. (개인정보
                  보호법 제22조의2)
                </span>
              </label>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onConfirm({
            isGuardian: isGuardian || !needsGuardianConsent,
            childBirthYear: childBirthYear
              ? Number(childBirthYear)
              : undefined,
          })
        }
        className="w-full rounded-xl bg-[#2D5A3D] py-2.5 font-semibold text-white transition hover:bg-[#1F4229] disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40"
      >
        확인
      </button>
    </div>
  );
}
