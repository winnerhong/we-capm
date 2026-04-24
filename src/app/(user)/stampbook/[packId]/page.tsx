// 스탬프북 상세 페이지 — 뒤로가기 + StampbookDetail 공용 뷰
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAppUser } from "@/lib/user-auth-guard";
import {
  loadOrgQuestPackById,
  loadOrgMissionsByQuestPack,
  loadUserSubmissions,
  sumAcornsForPack,
} from "@/lib/missions/queries";
import { StampbookDetail } from "@/components/stampbook-detail";

export const dynamic = "force-dynamic";

export default async function StampbookDetailPage({
  params,
}: {
  params: Promise<{ packId: string }>;
}) {
  const user = await requireAppUser();
  const { packId } = await params;

  const pack = await loadOrgQuestPackById(packId);
  if (!pack) notFound();
  if (pack.org_id !== user.orgId) redirect("/home");

  const [missions, submissions, userAcornsInPack] = await Promise.all([
    loadOrgMissionsByQuestPack(packId),
    loadUserSubmissions(user.id, { packId }),
    sumAcornsForPack(user.id, packId),
  ]);

  return (
    <div className="space-y-5">
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
