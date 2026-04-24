"use client";

import type { ReactNode } from "react";
import type {
  ApprovalMode,
  OrgMissionRow,
  UnlockRule,
} from "@/lib/missions/types";
import { AcornIcon } from "@/components/acorn-icon";

export const APPROVAL_OPTIONS: Array<{
  value: ApprovalMode;
  label: string;
  hint: string;
  icon: ReactNode;
}> = [
  {
    value: "AUTO",
    label: "자동 승인",
    hint: "제출 즉시 도토리 지급",
    icon: "✅",
  },
  {
    value: "MANUAL_TEACHER",
    label: "선생님 검토",
    hint: "기관 선생님이 직접 확인",
    icon: "👩‍🏫",
  },
  {
    value: "AUTO_24H",
    label: "24시간 후 자동",
    hint: "반려 없으면 자동 승인",
    icon: "⏳",
  },
  {
    value: "PARTNER_REVIEW",
    label: "지사 검토",
    hint: "지사 담당자가 확인",
    icon: "🏢",
  },
];

export const UNLOCK_OPTIONS: Array<{
  value: UnlockRule;
  label: string;
  hint: string;
  icon: ReactNode;
}> = [
  {
    value: "ALWAYS",
    label: "항상 열림",
    hint: "처음부터 바로 도전 가능",
    icon: "🔓",
  },
  {
    value: "SEQUENTIAL",
    label: "순차 해금",
    hint: "선행 미션을 완료해야 열림",
    icon: "🔗",
  },
  {
    value: "TIER_GATE",
    label: "도토리 게이트",
    hint: "누적 도토리가 일정 수 이상일 때 열림",
    icon: <AcornIcon size={14} />,
  },
];

export const inputCls =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

export function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
      >
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      {children}
    </div>
  );
}

export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${dd}T${hh}:${mm}`;
  } catch {
    return "";
  }
}

type DeployFieldsProps = {
  unlockRule: UnlockRule;
  setUnlockRule: (v: UnlockRule) => void;
  unlockThreshold: string;
  setUnlockThreshold: (v: string) => void;
  unlockPreviousId: string;
  setUnlockPreviousId: (v: string) => void;
  approvalMode: ApprovalMode;
  setApprovalMode: (v: ApprovalMode) => void;
  startsAt: string;
  setStartsAt: (v: string) => void;
  endsAt: string;
  setEndsAt: (v: string) => void;
  isActive: boolean;
  setIsActive: (v: boolean) => void;
  siblings: OrgMissionRow[];
  missionId: string;
  markDirty: () => void;
};

/**
 * 기관 미션 편집에서 kind와 무관하게 공통으로 들어가는 배포 필드들.
 */
export function DeployFields(props: DeployFieldsProps) {
  const {
    unlockRule,
    setUnlockRule,
    unlockThreshold,
    setUnlockThreshold,
    unlockPreviousId,
    setUnlockPreviousId,
    approvalMode,
    setApprovalMode,
    startsAt,
    setStartsAt,
    endsAt,
    setEndsAt,
    isActive,
    setIsActive,
    siblings,
    missionId,
    markDirty,
  } = props;

  const otherSiblings = siblings.filter((s) => s.id !== missionId);

  return (
    <div className="space-y-6">
      {/* 해금 규칙 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>🔐</span>
          <span>해금 규칙</span>
        </h2>
        <fieldset>
          <legend className="sr-only">해금 규칙 선택</legend>
          <div className="grid gap-2 md:grid-cols-3">
            {UNLOCK_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`cursor-pointer rounded-xl border p-3 transition ${
                  unlockRule === o.value
                    ? "border-[#2D5A3D] bg-[#E8F0E4]"
                    : "border-[#D4E4BC] bg-white hover:border-[#2D5A3D]"
                }`}
              >
                <input
                  type="radio"
                  name="unlock_rule"
                  value={o.value}
                  checked={unlockRule === o.value}
                  onChange={() => {
                    setUnlockRule(o.value);
                    markDirty();
                  }}
                  className="sr-only"
                />
                <p className="text-xl" aria-hidden>
                  {o.icon}
                </p>
                <p className="mt-1 text-sm font-bold text-[#2D5A3D]">
                  {o.label}
                </p>
                <p className="text-[11px] text-[#6B6560]">{o.hint}</p>
              </label>
            ))}
          </div>
        </fieldset>

        {unlockRule === "TIER_GATE" && (
          <div className="mt-3">
            <Field label="해금 누적 도토리" htmlFor="unlock_threshold">
              <input
                id="unlock_threshold"
                type="number"
                inputMode="numeric"
                min={0}
                value={unlockThreshold}
                onChange={(e) => {
                  setUnlockThreshold(e.target.value);
                  markDirty();
                }}
                placeholder="10"
                className={inputCls}
              />
            </Field>
          </div>
        )}

        {unlockRule === "SEQUENTIAL" && (
          <div className="mt-3">
            <Field label="선행 미션" htmlFor="unlock_previous_id">
              <select
                id="unlock_previous_id"
                value={unlockPreviousId}
                onChange={(e) => {
                  setUnlockPreviousId(e.target.value);
                  markDirty();
                }}
                className={inputCls}
              >
                <option value="">(선택)</option>
                {otherSiblings.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_order + 1}. {s.title || "(제목 없음)"}
                  </option>
                ))}
              </select>
              {otherSiblings.length === 0 && (
                <p className="mt-1 text-[11px] text-[#8B7F75]">
                  같은 스탬프북에 다른 미션이 없어요. 먼저 미션을 더 담아
                  주세요.
                </p>
              )}
            </Field>
          </div>
        )}
      </section>

      {/* 승인 방식 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>✅</span>
          <span>승인 방식</span>
        </h2>
        <fieldset>
          <legend className="sr-only">승인 방식 선택</legend>
          <div className="grid gap-2 md:grid-cols-2">
            {APPROVAL_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`cursor-pointer rounded-xl border p-3 transition ${
                  approvalMode === o.value
                    ? "border-[#2D5A3D] bg-[#E8F0E4]"
                    : "border-[#D4E4BC] bg-white hover:border-[#2D5A3D]"
                }`}
              >
                <input
                  type="radio"
                  name="approval_mode"
                  value={o.value}
                  checked={approvalMode === o.value}
                  onChange={() => {
                    setApprovalMode(o.value);
                    markDirty();
                  }}
                  className="sr-only"
                />
                <p className="text-lg" aria-hidden>
                  {o.icon}
                </p>
                <p className="text-sm font-bold text-[#2D5A3D]">{o.label}</p>
                <p className="text-[11px] text-[#6B6560]">{o.hint}</p>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {/* 기간 · 활성화 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📅</span>
          <span>기간 · 활성화</span>
        </h2>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="시작 일시 (선택)" htmlFor="starts_at">
              <input
                id="starts_at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => {
                  setStartsAt(e.target.value);
                  markDirty();
                }}
                className={inputCls}
              />
            </Field>
            <Field label="종료 일시 (선택)" htmlFor="ends_at">
              <input
                id="ends_at"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => {
                  setEndsAt(e.target.value);
                  markDirty();
                }}
                className={inputCls}
              />
            </Field>
          </div>
          <p className="text-[11px] text-[#8B7F75]">
            스탬프북 기간 안에서만 설정해 주세요. 비워두면 스탬프북 기간을
            따릅니다.
          </p>

          <label className="inline-flex items-center gap-2 text-sm text-[#2C2C2C]">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => {
                setIsActive(e.target.checked);
                markDirty();
              }}
              className="h-4 w-4 rounded border-[#D4E4BC] text-[#2D5A3D] focus:ring-[#2D5A3D]"
            />
            <span>이 미션 활성화 (끄면 참가자에게 숨겨짐)</span>
          </label>
        </div>
      </section>
    </div>
  );
}
