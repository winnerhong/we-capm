"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "toriro-cookie-consent-v1";

type Choice = "accepted" | "declined";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const persist = (choice: Choice) => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ choice, at: new Date().toISOString() })
      );
    } catch {
      // ignore quota / privacy errors
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="쿠키 사용 동의"
      className="fixed inset-x-2 bottom-2 z-50 md:inset-x-auto md:right-4 md:bottom-4 md:max-w-md"
    >
      <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <span aria-hidden className="text-2xl">
            🍪
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#2D5A3D]">
              쿠키 사용 안내
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#6B6560]">
              토리로는 원활한 서비스 제공을 위해 쿠키를 사용합니다. 필수 쿠키
              외 분석·마케팅 쿠키는 거부하실 수 있으며, 브라우저 설정에서도
              변경이 가능합니다.
            </p>
            <Link
              href="/privacy#cookies"
              className="mt-2 inline-block text-xs font-semibold text-[#2D5A3D] underline hover:no-underline"
            >
              자세히 보기 →
            </Link>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => persist("declined")}
            className="flex-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#6B6560] transition hover:bg-[#F5F0E8] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40"
          >
            거부
          </button>
          <button
            type="button"
            onClick={() => persist("accepted")}
            className="flex-[2] rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1F4229] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40"
          >
            동의하고 계속하기
          </button>
        </div>
      </div>
    </div>
  );
}
