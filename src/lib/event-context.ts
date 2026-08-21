// server-only: 행사 화면(/e/[eventId]/…)의 단일 관문.
//
// 설계 원칙 — **컨텍스트는 URL 이 100% 결정한다.**
//   예전에는 세션 쿠키의 orgId 하나가 "지금 어느 기관인지"를 들고 있었다.
//   그래서 (a) 어디서 들어왔느냐에 따라 화면이 달라지고, (b) 탭을 두 개 열면
//   마지막에 연 쪽이 이기고, (c) 행사는 B기관인데 기관 표시는 A기관인 어긋남이
//   생겼다. 행사 화면은 쿠키의 orgId 를 **읽지 않는다**. eventId 하나에서
//   기관·권한·표시가 전부 파생된다.
//
// 권한 판단도 하나로 통일:
//   ✗ user.orgId === resource.org_id
//   ○ isEventParticipant(eventId, user.id)
//
// 실패 처리:
//   미로그인   → /user-login?return=/e/{eventId}
//   행사 없음  → notFound()
//   미참가     → /join/event/{eventId} (참가 유도 — 초대장 링크와 같은 흐름)

import "server-only";
import { notFound, redirect } from "next/navigation";
import { getAppUser, type AppUserSession } from "@/lib/user-auth-guard";
import {
  loadOrgEventById,
  isEventParticipant,
} from "@/lib/org-events/queries";
import { loadOrgNameById } from "@/lib/org-partner";
import type { OrgEventRow } from "@/lib/org-events/types";

export interface EventContext {
  user: AppUserSession;
  event: OrgEventRow;
  /** 이 행사를 주최한 기관. 화면의 모든 기관 종속 요소는 이 값을 쓴다. */
  orgId: string;
  orgName: string;
  /** 행사 하위 경로 빌더 — `href(\"/stampbook\")` → `/e/{id}/stampbook` */
  href: (subpath?: string) => string;
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function eventHref(eventId: string, subpath = ""): string {
  const s = subpath.startsWith("/") ? subpath : subpath ? `/${subpath}` : "";
  return `/e/${eventId}${s}`;
}

/**
 * 행사 컨텍스트 확보. 모든 /e/[eventId] 페이지가 첫 줄에서 호출한다.
 *
 * redirect()/notFound() 는 내부적으로 throw 하므로 try/catch 로 감싸지 말 것.
 */
export async function requireEventContext(
  eventId: string
): Promise<EventContext> {
  if (!UUID_RE.test(eventId)) notFound();

  const user = await getAppUser();
  if (!user) {
    redirect(`/user-login?return=${encodeURIComponent(eventHref(eventId))}`);
  }

  const event = await loadOrgEventById(eventId).catch(() => null);
  if (!event) notFound();

  const joined = await isEventParticipant(eventId, user.id).catch(() => false);
  if (!joined) {
    // 참가자가 아니면 차단 대신 참가 흐름으로 — 초대장 링크와 동일한 경험.
    redirect(`/join/event/${eventId}`);
  }

  const orgName = await loadOrgNameById(event.org_id, "소속 기관");

  return {
    user,
    event,
    orgId: event.org_id,
    orgName,
    href: (subpath = "") => eventHref(eventId, subpath),
  };
}
