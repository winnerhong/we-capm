// server-only: 구 참가자 URL(/stampbook, /tori-fm …) → 행사 하위 경로로 이관.
//
// 참가자 화면이 전부 /e/{eventId}/… 로 옮겨갔지만, 카톡·문자·알림·북마크에는
// 예전 평면 URL 이 이미 뿌려져 있다. 그 링크가 404 가 되면 안 되므로
// "지금 들어갈 만한 행사"를 골라 그쪽으로 돌려보낸다.
//
// 고르는 기준 — 활성 기관의 LIVE 를 최우선.
//   두 기관에 다니는 보호자가 엉뚱한 기관 행사로 튀지 않도록 세션의 활성
//   기관을 먼저 본다. (활성 기관에 행사가 없을 때만 다른 기관으로 fallback)
// 참여 중인 행사가 하나도 없으면 허브(/home)로.

import "server-only";
import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/user-auth-guard";
import { loadEventsForUser } from "@/lib/org-events/queries";
import { eventHref } from "@/lib/event-context";

export async function redirectToEventSubpath(subpath: string): Promise<never> {
  const user = await getAppUser();
  if (!user) {
    redirect(`/user-login?return=${encodeURIComponent("/home")}`);
  }

  const events = await loadEventsForUser(user.id).catch(
    () => []
  );
  if (events.length === 0) redirect("/home");

  const mine = events.filter((e) => e.org_id === user.orgId);
  const target =
    mine.find((e) => e.status === "LIVE") ??
    mine[0] ??
    events.find((e) => e.status === "LIVE") ??
    events[0];

  // 참여 행사가 여러 개면 어디로 갈지 단정할 수 없다 — 허브에서 고르게 한다.
  if (events.length > 1 && mine.length !== 1) redirect("/home");

  redirect(eventHref(target.id, subpath));
}
