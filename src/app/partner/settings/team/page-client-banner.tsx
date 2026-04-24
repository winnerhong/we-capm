"use client";

import { useState } from "react";

interface Props {
  invited?: string;
  resetFor?: string;
  name?: string;
  pw?: string;
}

export function InviteResultBanner({ invited, resetFor, name, pw }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!pw || (!invited && !resetFor)) return null;

  const isReset = !!resetFor;
  const title = isReset
    ? "🔑 임시 비밀번호가 재발급되었어요"
    : `✅ ${name ? `${name}님을 ` : ""}팀원으로 초대했어요`;

  const subtitle = isReset
    ? "아래 비밀번호를 팀원에게 안전하게 전달해 주세요"
    : "아래 아이디와 임시 비밀번호를 팀원에게 전달해 주세요";

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // fallback: 수동 선택 안내
      window.prompt("복사할 값을 선택하세요", text);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 shadow-sm"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-emerald-900 md:text-lg">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-emerald-800 md:text-sm">
            {subtitle}
          </p>
        </div>
        <span aria-hidden className="text-2xl">
          {isReset ? "🔑" : "🎉"}
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {invited && (
          <CopyField
            label="아이디"
            value={invited}
            copyKey="username"
            copied={copiedKey === "username"}
            onCopy={copy}
          />
        )}
        <CopyField
          label="임시 비밀번호"
          value={pw}
          copyKey="pw"
          copied={copiedKey === "pw"}
          onCopy={copy}
        />
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 md:text-xs">
        <span aria-hidden>⚠️</span>
        <span>이 화면을 나가면 비밀번호를 다시 볼 수 없어요. 지금 꼭 복사해 두세요.</span>
      </p>
    </div>
  );
}

function CopyField({
  label,
  value,
  copyKey,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copyKey: string;
  copied: boolean;
  onCopy: (text: string, key: string) => void | Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-white p-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-emerald-50 px-2 py-1.5 font-mono text-sm font-bold text-emerald-900">
          {value}
        </code>
        <button
          type="button"
          onClick={() => onCopy(value, copyKey)}
          className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
            copied
              ? "bg-emerald-600 text-white"
              : "border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
          }`}
          aria-label={`${label} 복사`}
        >
          {copied ? "✓ 복사됨" : "📋 복사"}
        </button>
      </div>
    </div>
  );
}
