import { redirectToEventSubpath } from "@/lib/legacy-participant-redirect";

export const dynamic = "force-dynamic";

/** 구 URL 호환 — /bingo → /e/{eventId}/bingo */
export default async function LegacyRedirect() {
  await redirectToEventSubpath("/bingo");
}
