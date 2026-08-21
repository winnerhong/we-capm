import { redirectToEventSubpath } from "@/lib/legacy-participant-redirect";

export const dynamic = "force-dynamic";

/** 구 URL 호환 — /missions/{id} → /e/{eventId}/missions/{id} */
export default async function LegacyRedirect({
  params,
}: {
  params: Promise<{ orgMissionId: string }>;
}) {
  const { orgMissionId } = await params;
  await redirectToEventSubpath(`/missions/${orgMissionId}`);
}
