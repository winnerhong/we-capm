import { redirectToEventSubpath } from "@/lib/legacy-participant-redirect";

export const dynamic = "force-dynamic";

/** 구 URL 호환 — /bingo/{id} → /e/{eventId}/bingo/{id} */
export default async function LegacyRedirect({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  await redirectToEventSubpath(`/bingo/${boardId}`);
}
