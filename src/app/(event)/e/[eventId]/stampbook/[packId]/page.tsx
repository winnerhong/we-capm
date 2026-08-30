// 스탬프북 상세 페이지 — 뒤로가기 + StampbookDetail 공용 뷰
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireEventContext } from "@/lib/event-context";
import {
  loadOrgQuestPackById,
  loadOrgMissionsByQuestPack,
  loadUserSubmissions,
  sumAcornsForPack,
} from "@/lib/missions/queries";
import { StampbookDetail } from "@/components/stampbook-detail";
import { AcornTopBoard } from "@/components/acorn-top-board";
import { loadAcornGuide } from "@/lib/missions/acorn-guide-queries";
import { loadTopAcornFamiliesForEvent } from "@/lib/app-user/event-acorns";
import { loadOrgNameById } from "@/lib/org-partner";

export const dynamic = "force-dynamic";

export default async function StampbookDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; packId: string }>;
}) {
  const { eventId, packId } = await params;
  const ctx = await requireEventContext(eventId);
  const user = ctx.user;
  // 행사 시작 전(DRAFT)에는 스탬프북이 열리지 않는다.
  // 시작 전에는 볼 게 없다. 끝난 뒤에는 남는다 — 여기가 그 행사의 기록이다.
  if (ctx.access.phase === "upcoming") redirect(ctx.href());

  const pack = await loadOrgQuestPackById(packId);
  if (!pack) notFound();
  // 이 행사를 연 기관의 스탬프북만. 다른 기관 링크는 목록으로.
  if (pack.org_id !== ctx.orgId) redirect(ctx.href("/stampbook"));

  const [
    missions,
    submissions,
    userAcornsInPack,
    topFamilies,
    freshOrgName,
    acornGuide,
  ] = await Promise.all([
    loadOrgMissionsByQuestPack(packId),
    loadUserSubmissions(user.id, { packId }),
    sumAcornsForPack(user.id, packId),
    loadTopAcornFamiliesForEvent(ctx.event.id, 5),
    loadOrgNameById(ctx.orgId, ctx.orgName),
    loadAcornGuide(ctx.event.id),
  ]);

  return (
    <div className="space-y-5">
      {/* 도토리 TOP 5 가족 — 최상단 노출 */}
      <AcornTopBoard
        families={topFamilies}
        myUserId={user.id}
        orgName={freshOrgName}
        guide={acornGuide}
      />

      {/* 상단 뒤로가기 */}
      <nav className="text-[11px] text-[#6B6560]">
        <Link href={ctx.href("/stampbook")} className="hover:underline">
          📚 스탬프북
        </Link>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">{pack.name}</span>
      </nav>

      <StampbookDetail
        readOnly={!ctx.access.canPlay}
        base={ctx.href()}
        pack={pack}
        missions={missions}
        submissions={submissions}
        userAcornsInPack={userAcornsInPack}
      />
    </div>
  );
}
