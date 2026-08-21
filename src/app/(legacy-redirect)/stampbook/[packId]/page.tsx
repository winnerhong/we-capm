import { redirectToEventSubpath } from "@/lib/legacy-participant-redirect";

export const dynamic = "force-dynamic";

/** 구 URL 호환 — /stampbook/{id} → /e/{eventId}/stampbook/{id} */
export default async function LegacyRedirect({
  params,
}: {
  params: Promise<{ packId: string }>;
}) {
  const { packId } = await params;
  await redirectToEventSubpath(`/stampbook/${packId}`);
}
