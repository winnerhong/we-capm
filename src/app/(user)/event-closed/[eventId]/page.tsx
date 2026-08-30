// 닫힌 행사 — 보관(ARCHIVED)된 행사의 URL 로 들어왔을 때.
//
// 왜 행사 그룹(/e/[eventId]) 밖에 있나:
//   그 안에 두면 행사 레이아웃이 requireEventContext 를 다시 부르고, 그게
//   또 여기로 보내서 무한 리다이렉트가 된다. 잠긴 문 앞 화면은 문 밖에 있어야 한다.
//
// 여기서 requireEventContext 를 쓰지 않는 이유도 같다. 행사 이름만 있으면 된다.

import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAppUser } from "@/lib/user-auth-guard";
import { loadOrgEventById } from "@/lib/org-events/queries";
import { loadOrgNameById } from "@/lib/org-partner";
import { resolveEventAccess } from "@/lib/org-events/event-access";
import { eventHref } from "@/lib/event-context";
import { fmtFullDateKst } from "@/lib/datetime/kst";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export default async function EventClosedPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  await requireAppUser();
  if (!UUID_RE.test(eventId)) redirect("/home");

  const event = await loadOrgEventById(eventId).catch(() => null);
  if (!event) redirect("/home");

  const access = resolveEventAccess({
    status: event.status,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
  });
  // 기관이 다시 열었다면 여기 머물 이유가 없다 — 곧장 행사로.
  if (access.canEnter) redirect(eventHref(eventId));

  const orgName = await loadOrgNameById(event.org_id, "소속 기관");
  const date = event.starts_at ? fmtFullDateKst(event.starts_at) : "";

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-[#E5D3B8] bg-white p-8 text-center shadow-sm">
        <p className="text-4xl" aria-hidden>
          {access.badgeEmoji}
        </p>
        <h1 className="mt-3 text-lg font-bold text-[#6B6560]">
          {event.name || "행사"}
        </h1>
        <p className="mt-1 text-xs text-[#8B7F75]">
          🏡 {orgName}
          {date ? ` · ${date}` : ""}
        </p>
        <p className="mt-4 text-sm font-semibold text-[#6B6560]">
          {access.notice}
        </p>
        <Link
          href="/home"
          className="mt-6 inline-flex items-center justify-center rounded-2xl bg-[#2D5A3D] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52]"
        >
          내 행사 보기
        </Link>
      </section>
    </div>
  );
}
