// 스탬프북 상세 페이지 — 뒤로가기 + StampbookDetail 공용 뷰
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAppUser } from "@/lib/user-auth-guard";
import { userHasAnyLiveEvent } from "@/lib/org-events/queries";
import {
  loadOrgQuestPackById,
  loadOrgMissionsByQuestPack,
  loadUserSubmissions,
  sumAcornsForPack,
} from "@/lib/missions/queries";
import { StampbookDetail } from "@/components/stampbook-detail";
import { AcornTopBoard } from "@/components/acorn-top-board";
import { loadTopAcornFamilies } from "@/lib/app-user/queries";
import { loadOrgNameById } from "@/lib/org-partner";

export const dynamic = "force-dynamic";

export default async function StampbookDetailPage({
  params,
}: {
  params: Promise<{ packId: string }>;
}) {
  const user = await requireAppUser();
  // 예정(DRAFT) 행사만 있는 참가자는 차단.
  if (!(await userHasAnyLiveEvent(user.id))) redirect("/home");
  const { packId } = await params;

  const pack = await loadOrgQuestPackById(packId);
  if (!pack) notFound();
  if (pack.org_id !== user.orgId) redirect("/home");

  const [
    missions,
    submissions,
    userAcornsInPack,
    topFamilies,
    freshOrgName,
  ] = await Promise.all([
    loadOrgMissionsByQuestPack(packId),
    loadUserSubmissions(user.id, { packId }),
    sumAcornsForPack(user.id, packId),
    loadTopAcornFamilies(user.orgId, 5),
    loadOrgNameById(user.orgId, user.orgName || "소속 기관"),
  ]);

  return (
    <div className="space-y-5">
      {/* 도토리 TOP 5 가족 — 최상단 노출 */}
      <AcornTopBoard
        families={topFamilies}
        myUserId={user.id}
        orgName={freshOrgName}
      />

      {/* 상단 뒤로가기 */}
      <nav className="text-[11px] text-[#6B6560]">
        <Link href="/stampbook" className="hover:underline">
          📚 스탬프북
        </Link>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">{pack.name}</span>
      </nav>

      <StampbookDetail
        pack={pack}
        missions={missions}
        submissions={submissions}
        userAcornsInPack={userAcornsInPack}
      />
    </div>
  );
}
