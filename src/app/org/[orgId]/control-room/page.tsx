import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
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

  const snapshot = await loadSnapshotSafe(orgId, session.orgName);

  return (
    <>
      <ControlRoomGrid snapshot={snapshot} orgId={orgId} isTvMode={false} />
      <ControlRoomRefresher orgId={orgId} />
    </>
  );
}
