import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { ControlRoomGrid } from "./control-room-grid";
import { ControlRoomRefresher } from "./control-room-refresher";
import { FmStudioEmbed } from "./widgets/fm-studio-embed";
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
      {/* 관제실 하단 — 토리FM 라이브 스튜디오 임베드.
          LIVE 세션이 없으면 안내 카드만 표시. ControlRoomGrid 아래 자연스럽게
          연결되도록 max-w + padding 도 동일 톤. */}
      <div className="mx-auto max-w-[1600px] px-4 pb-6 md:px-6">
        <FmStudioEmbed orgId={orgId} />
      </div>
      <ControlRoomRefresher orgId={orgId} />
    </>
  );
}
