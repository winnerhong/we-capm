"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const handleRetry = () => {
    if (unstable_retry) {
      unstable_retry();
    } else if (reset) {
      reset();
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#FFF8F0] p-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-6xl" aria-hidden="true">
          🌱
        </div>
        <h1 className="text-2xl font-bold text-[#2D5A3D]">
          앗, 뿌리가 꼬였어요!
        </h1>
        <p className="text-sm text-[#6B6560]">잠시 후 다시 시도해보세요</p>
        <div className="flex gap-2 justify-center mt-6">
          <button
            onClick={handleRetry}
            className="rounded-xl bg-[#2D5A3D] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[#1F4229] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] focus:ring-offset-2"
          >
            다시 시도
          </button>
          <a
            href="/"
            className="rounded-xl border border-[#D4E4BC] text-[#2D5A3D] px-5 py-2.5 text-sm font-semibold hover:bg-[#E8F0E4] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] focus:ring-offset-2"
          >
            홈으로
          </a>
        </div>
        {error.digest && (
          <p className="text-[10px] text-[#6B6560] mt-4 font-mono">
            ID: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
