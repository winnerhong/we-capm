"use client";
import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  // Lazy init reads localStorage only once on mount (SSR-safe guard).
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(localStorage.getItem("toriro_install_dismissed"));
  });

  useEffect(() => {
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("toriro_install_dismissed", "1");
    setDismissed(true);
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-[#2D5A3D] p-4 text-white shadow-2xl">
      <span className="text-3xl" aria-hidden>
        🌰
      </span>
      <div className="flex-1">
        <p className="text-sm font-bold">토리로 앱 설치하기</p>
        <p className="mt-0.5 text-xs opacity-80">홈 화면에 추가하면 더 편해요!</p>
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleInstall}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-white/60"
        >
          설치
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg px-3 py-1 text-xs opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          나중에
        </button>
      </div>
    </div>
  );
}
