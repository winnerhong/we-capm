import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { ControlRoomGrid } from "../control-room-grid";
import { ControlRoomRefresher } from "../control-room-refresher";
import { loadSnapshotSafe } from "../_loader";

export const dynamic = "force-dynamic";

// TV 풀스크린 뷰.
// 부모 layout (org/[orgId]/layout.tsx) 의 헤더/네비가 그대로 보이면
// 진정한 풀스크린이 아니므로, 이 페이지 자체를 100dvh 로 덮는다.
// (layout 은 수정하지 않는다 — 다른 org 페이지 스타일 유지)
export default async function ControlRoomTvPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const session = await requireOrg();
  if (session.orgId !== orgId) notFound();

  const snapshot = await loadSnapshotSafe(orgId, session.orgName);

  return (
    <div
      className="fixed inset-0 z-[60] overflow-auto"
      style={{ background: "#0A0F0D" }}
    >
      <ControlRoomGrid snapshot={snapshot} orgId={orgId} isTvMode={true} />
      <ControlRoomRefresher orgId={orgId} />
    </div>
  );
}
