import { redirectToEventSubpath } from "@/lib/legacy-participant-redirect";

export const dynamic = "force-dynamic";

/** 구 URL 호환 — /tori-fm → /e/{eventId}/radio (이름도 radio 로 바뀜) */
export default async function LegacyRedirect() {
  await redirectToEventSubpath("/radio");
}
