"use client";

import { useState } from "react";

function formatBizNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

export function BizNumberInput({
  defaultValue = "",
}: {
  defaultValue?: string;
}) {
  const [value, setValue] = useState(() => formatBizNumber(defaultValue));

  return (
    <input
      id="business_number"
      name="business_number"
      type="text"
      inputMode="numeric"
      required
      autoComplete="off"
      value={value}
      onChange={(e) => setValue(formatBizNumber(e.target.value))}
      placeholder="XXX-XX-XXXXX"
      maxLength={12}
      aria-describedby="business_number_help"
      className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 font-mono text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
    />
  );
}
