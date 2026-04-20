"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ToriFab({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  // 토리 페이지에서는 숨김
  if (pathname?.endsWith("/tori")) return null;

  return (
    <Link
      href={`/event/${eventId}/tori`}
      aria-label="토리와 대화하기"
      className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#C4956A] text-2xl shadow-lg transition-transform hover:scale-110 hover:bg-[#b0835a] focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
    >
      🐿️
    </Link>
  );
}
