"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
    >
      {copied ? "복사됨" : "복사"}
    </button>
  );
}
