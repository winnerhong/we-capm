"use client";

import { useEffect, useState } from "react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 400);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-24 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#D4E4BC] shadow-lg text-[#2D5A3D] hover:bg-[#E8F0E4] transition-opacity focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] focus:ring-offset-2"
      aria-label="맨 위로 이동"
    >
      <span aria-hidden="true">↑</span>
    </button>
  );
}
