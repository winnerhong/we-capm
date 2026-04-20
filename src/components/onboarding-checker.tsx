"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * OnboardingChecker
 * 최초 1회 환영 화면(/event/[id]/welcome)으로 리다이렉트.
 * localStorage 키: `toriro_welcome_${eventId}`
 *
 * 사용법: event 홈 layout 혹은 page에서 <OnboardingChecker eventId={id} /> 렌더.
 * 자동 연결되어 있지 않으며 필요 시 수동 삽입.
 */
export function OnboardingChecker({ eventId }: { eventId: string }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== `/event/${eventId}`) return;
    const key = `toriro_welcome_${eventId}`;
    const shown = localStorage.getItem(key);
    if (!shown) {
      localStorage.setItem(key, "1");
      router.push(`/event/${eventId}/welcome`);
    }
  }, [eventId, router, pathname]);

  return null;
}
