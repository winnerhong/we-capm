"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="ko">
      <body className="min-h-screen flex flex-col items-center justify-center bg-[#FFF8F0] p-6 text-center">
        <h2 className="text-xl font-bold text-[#2D5A3D]">앗, 오류가 발생했어요</h2>
        <p className="mt-2 max-w-md text-sm text-[#6B6560]">
          잠시 후 다시 시도해 주세요. 반복되면 담당자에게 문의해 주세요.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white"
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
