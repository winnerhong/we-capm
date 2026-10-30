import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgEvents } from "@/lib/org-events/queries";
import { pickRepresentativeEvent } from "@/lib/org-events/event-access";
import { ControlRoomGrid } from "./control-room-grid";
import { ControlRoomRefresher } from "./control-room-refresher";
import { loadSnapshotSafe } from "./_loader";

export const dynamic = "force-dynamic";

export default async function ControlRoomPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const session = await requireOrg();
  if (session.orgId !== orgId) notFound();

  // 대표 행사 — 헤더에서 예정/진행중/종료/보관 상태를 바로 바꿀 수 있게.
  // 고르는 규칙은 참가자 홈과 동일(pickRepresentativeEvent) — 화면끼리 안 어긋난다.
  const [snapshot, events] = await Promise.all([
    loadSnapshotSafe(orgId, session.orgName),
    loadOrgEvents(orgId),
  ]);
  const rep = pickRepresentativeEvent(events);
  const currentEvent = rep
    ? {
        id: rep.id,
        name: rep.name,
        status: rep.status,
        startsAt: rep.starts_at,
        endsAt: rep.ends_at,
      }
    : null;

  return (
    <>
      <ControlRoomGrid
        snapshot={snapshot}
        orgId={orgId}
        isTvMode={false}
        currentEvent={currentEvent}
      />
      <ControlRoomRefresher orgId={orgId} />
    </>
  );
}
