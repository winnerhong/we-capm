"use client";

import { useState } from "react";

interface Props {
  text: string;
  className?: string;
  label?: string;
  copiedLabel?: string;
}

/**
 * 주소·텍스트 복사 버튼.
 * - 클립보드 API 실패 시 prompt() 폴백.
 */
export function CopyButton({
  text,
  className,
  label = "📋 복사",
  copiedLabel = "✓ 복사됨",
}: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        window.prompt("아래 텍스트를 복사하세요", text);
      });
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className={
        className ??
        "inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-white px-3 py-1.5 text-[11px] font-bold text-[#2D5A3D] shadow-sm hover:bg-[#F5F1E8]"
      }
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
