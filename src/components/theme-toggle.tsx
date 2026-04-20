"use client";

import { useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "forest">("forest");

  // MVP 스텁: 실제 테마 전환은 비활성화, 시각적 토글만 제공
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "light" ? "forest" : "light")}
      className="flex items-center gap-2 rounded-full bg-[#E8F0E4] px-3 py-1.5 text-xs text-[#2D5A3D] hover:bg-[#D4E4BC] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] focus:ring-offset-2"
      aria-label="테마 변경"
      aria-pressed={theme === "forest"}
    >
      <span aria-hidden="true">{theme === "forest" ? "🌲" : "☀️"}</span>
      <span>{theme === "forest" ? "숲" : "밝음"}</span>
    </button>
  );
}
