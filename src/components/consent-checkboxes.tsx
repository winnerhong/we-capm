"use client";

import Link from "next/link";

export interface ConsentState {
  terms: boolean; // 필수: 이용약관
  privacy: boolean; // 필수: 개인정보 수집·이용
  marketing: boolean; // 선택: 마케팅 수신
  thirdParty: boolean; // 선택: 개인정보 제3자 제공
  ageConfirm: boolean; // 필수: 만 14세 이상 or 법정대리인 동의
}

interface Props {
  value: ConsentState;
  onChange: (value: ConsentState) => void;
  showChildGuardian?: boolean;
}

export function ConsentCheckboxes({ value, onChange, showChildGuardian }: Props) {
  const allChecked =
    value.terms && value.privacy && value.marketing && value.thirdParty && value.ageConfirm;
  const requiredChecked = value.terms && value.privacy && value.ageConfirm;

  const toggleAll = () => {
    const next = !allChecked;
    onChange({
      terms: next,
      privacy: next,
      marketing: next,
      thirdParty: next,
      ageConfirm: next,
    });
  };

  return (
    <div className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 space-y-3">
      {/* 전체 동의 */}
      <label className="flex items-center gap-3 cursor-pointer pb-3 border-b border-[#D4E4BC]">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={toggleAll}
          aria-label="전체 동의"
          className="h-5 w-5 rounded accent-[#2D5A3D]"
        />
        <span className="font-bold text-[#2D5A3D]">전체 동의</span>
        <span className="text-[11px] text-[#6B6560] ml-auto">
          전체 동의는 선택 항목에 대한 동의를 포함합니다
        </span>
      </label>

      {/* 필수 항목 */}
      <CheckItem
        required
        label="만 14세 이상입니다 또는 보호자 동의를 받았습니다"
        checked={value.ageConfirm}
        onChange={(v) => onChange({ ...value, ageConfirm: v })}
      />

      <CheckItem
        required
        label="이용약관 동의"
        link="/terms"
        linkLabel="보기"
        checked={value.terms}
        onChange={(v) => onChange({ ...value, terms: v })}
      />

      <CheckItem
        required
        label="개인정보 수집·이용 동의"
        link="/privacy"
        linkLabel="보기"
        checked={value.privacy}
        onChange={(v) => onChange({ ...value, privacy: v })}
      />

      {/* 선택 항목 */}
      <CheckItem
        label="마케팅 정보 수신 동의 (SMS/이메일/알림톡)"
        link="/privacy#marketing"
        linkLabel="자세히"
        checked={value.marketing}
        onChange={(v) => onChange({ ...value, marketing: v })}
      />

      <CheckItem
        label="개인정보 제3자 제공 동의 (참여 기관/업체)"
        link="/privacy#third-party"
        linkLabel="자세히"
        checked={value.thirdParty}
        onChange={(v) => onChange({ ...value, thirdParty: v })}
      />

      {showChildGuardian && (
        <div className="mt-3 rounded-xl bg-[#E8F0E4] border border-[#A8C686] p-3">
          <p className="text-xs text-[#2D5A3D] font-semibold mb-1">
            👨‍👩‍👧 만 14세 미만 아동의 경우
          </p>
          <p className="text-xs text-[#6B6560]">
            보호자(법정대리인)가 직접 가입 및 동의해야 합니다. 아이의 정보(이름·사진 등)를
            등록하시는 경우 보호자 책임 하에 진행됩니다.
          </p>
        </div>
      )}

      {!requiredChecked && (
        <p className="text-[11px] text-red-600 mt-2">
          필수 항목에 모두 동의해주셔야 서비스 이용이 가능합니다
        </p>
      )}
    </div>
  );
}

function CheckItem({
  label,
  required,
  link,
  linkLabel,
  checked,
  onChange,
}: {
  label: string;
  required?: boolean;
  link?: string;
  linkLabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded accent-[#2D5A3D]"
      />
      <span className="flex-1 text-sm">
        <span
          className={
            required ? "text-[#2D5A3D] font-semibold mr-1" : "text-[#6B6560] mr-1"
          }
        >
          {required ? "[필수]" : "[선택]"}
        </span>
        <span className="text-[#2C2C2C]">{label}</span>
      </span>
      {link && (
        <Link
          href={link}
          target="_blank"
          className="text-xs text-[#6B6560] underline hover:text-[#2D5A3D]"
        >
          {linkLabel ?? "보기"}
        </Link>
      )}
    </label>
  );
}

export const defaultConsent: ConsentState = {
  terms: false,
  privacy: false,
  marketing: false,
  thirdParty: false,
  ageConfirm: false,
};

export function isConsentValid(c: ConsentState): boolean {
  return c.terms && c.privacy && c.ageConfirm;
}
