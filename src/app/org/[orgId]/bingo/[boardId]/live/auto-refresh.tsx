"use client";

// 관제실 자동 새로고침 — 단순 router.refresh 폴링. realtime 은 phase 2.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LiveAutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, router]);
  return null;
}
