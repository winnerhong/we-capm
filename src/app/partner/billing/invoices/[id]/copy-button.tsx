"use client";

import { useState } from "react";

interface Props {
  text: string;
  label?: string;
}

/**
 * 복사 버튼 — navigator.clipboard 래퍼.
 */
export function CopyButton({ text, label = "복사" }: Props) {
  const [copied, setCopied] = useState(false);

  const handle = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2D5A3D] transition hover:bg-[#E8F0E4] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]"
      aria-label={`${label} ${copied ? "복사됨" : ""}`}
    >
      {copied ? "✓ 복사됨" : `📋 ${label}`}
    </button>
  );
}
