import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  loadContributionsByOrg,
  loadOrgMissionById,
  loadOrgMissionsByQuestPack,
  loadOrgQuestPackById,
  loadPartnerMissionById,
} from "@/lib/missions/queries";
import {
  MISSION_KIND_META,
  type MissionKind,
} from "@/lib/missions/types";
import { ProposeDialog } from "./propose-dialog";
import { PhotoOrgMissionEditor } from "./editors/PhotoOrgMissionEditor";
import { QrQuizOrgMissionEditor } from "./editors/QrQuizOrgMissionEditor";
import { FinalRewardOrgMissionEditor } from "./editors/FinalRewardOrgMissionEditor";
import { PhotoApprovalOrgMissionEditor } from "./editors/PhotoApprovalOrgMissionEditor";
import { TreasureOrgMissionEditor } from "./editors/TreasureOrgMissionEditor";
import { RadioOrgMissionEditor } from "./editors/RadioOrgMissionEditor";
import { CoopOrgMissionEditor } from "./editors/CoopOrgMissionEditor";
import { BroadcastOrgMissionEditor } from "./editors/BroadcastOrgMissionEditor";

export const dynamic = "force-dynamic";

const SUPPORTED_KINDS: Set<MissionKind> = new Set([
  "PHOTO",
  "QR_QUIZ",
  "FINAL_REWARD",
  "PHOTO_APPROVAL",
  "TREASURE",
  "RADIO",
  "COOP",
  "BROADCAST",
]);

export default async function EditOrgMissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; id: string }>;
  searchParams: Promise<{ proposed?: string }>;
}) {
  const { orgId, id } = await params;
  const sp = await searchParams;
  const justProposed = sp.proposed === "1";
  const session = await requireOrg();

  const mission = await loadOrgMissionById(id);
  if (!mission) notFound();
  if (mission.org_id !== session.orgId) {
    redirect(`/org/${orgId}/quest-packs`);
  }

  // 같은 팩의 다른 미션들 (선행 미션 dropdown용)
  const siblings = mission.quest_pack_id
    ? await loadOrgMissionsByQuestPack(mission.quest_pack_id)
    : [];

  // 스탬프북 정보 (breadcrumb용)
  const pack = mission.quest_pack_id
    ? await loadOrgQuestPackById(mission.quest_pack_id)
    : null;

  // 가이드 원본
  const sourcePartnerMission = mission.source_mission_id
    ? await loadPartnerMissionById(mission.source_mission_id)
    : null;

  // 이 미션에 대해 이미 존재하는 제안(latest)
  const allContributions = mission.source_mission_id
    ? await loadContributionsByOrg(session.orgId)
    : [];
  const existingContribution =
    allContributions.find((c) => c.source_org_mission_id === mission.id) ??
    null;

  const kindMeta = MISSION_KIND_META[mission.kind];
  const isSupported = SUPPORTED_KINDS.has(mission.kind);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/quest-packs`}
          className="hover:text-[#2D5A3D]"
        >
          스탬프북 관리
        </Link>
        {pack && (
          <>
            <span className="mx-2">/</span>
            <Link
              href={`/org/${orgId}/quest-packs/${pack.id}/edit`}
              className="hover:text-[#2D5A3D]"
            >
              {pack.name}
            </Link>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">미션 편집</span>
      </nav>

      {/* 가이드 원본 표시 */}
      {sourcePartnerMission && (
        <section className="rounded-2xl border border-[#E5D3B8] bg-[#FFF8F0] p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden>
                📋
              </span>
              <div>
                <p className="font-semibold text-[#8B6F47]">지사 가이드</p>
                <p className="font-bold text-[#2D5A3D]">
                  {sourcePartnerMission.title}
                </p>
                <p className="text-[10px] text-[#8B7F75]">
                  ID: {sourcePartnerMission.id}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#E5D3B8] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#8B6F47]">
              <span aria-hidden>🔗</span>
              <span>복사본</span>
            </span>
          </div>
        </section>
      )}

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm"
            aria-hidden
          >
            {mission.icon || kindMeta.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                <span aria-hidden>{kindMeta.icon}</span>
                <span>{kindMeta.label}</span>
              </span>
              {pack && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                  <span aria-hidden>🎒</span>
                  <span>{pack.name}</span>
                </span>
              )}
            </div>
            <h1 className="mt-1 truncate text-lg font-bold text-[#2D5A3D] md:text-xl">
              {mission.title || "(제목 없음)"}
            </h1>
          </div>
        </div>
      </header>

      {/* Editor */}
      {!isSupported ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-4xl" aria-hidden>
            🚧
          </p>
          <p className="mt-3 text-sm font-bold text-amber-900">
            {kindMeta.label} 편집 UI는 아직 준비 중이에요
          </p>
          <p className="mt-1 text-xs text-amber-800">
            이 kind는 아직 편집할 수 없어요. 지원 종류(사진·QR 퀴즈·최종
            보상·자연물 찾기·보물찾기·신청곡)를 사용해 주세요.
          </p>
          <Link
            href={
              pack
                ? `/org/${orgId}/quest-packs/${pack.id}/edit`
                : `/org/${orgId}/quest-packs`
            }
            className="mt-4 inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
          >
            ← 스탬프북으로
          </Link>
        </div>
      ) : mission.kind === "PHOTO" ? (
        <PhotoOrgMissionEditor mission={mission} siblings={siblings} />
      ) : mission.kind === "QR_QUIZ" ? (
        <QrQuizOrgMissionEditor mission={mission} siblings={siblings} />
      ) : mission.kind === "PHOTO_APPROVAL" ? (
        <PhotoApprovalOrgMissionEditor mission={mission} siblings={siblings} />
      ) : mission.kind === "TREASURE" ? (
        <TreasureOrgMissionEditor mission={mission} siblings={siblings} />
      ) : mission.kind === "RADIO" ? (
        <RadioOrgMissionEditor mission={mission} siblings={siblings} />
      ) : mission.kind === "COOP" ? (
        <CoopOrgMissionEditor mission={mission} siblings={siblings} />
      ) : mission.kind === "BROADCAST" ? (
        <BroadcastOrgMissionEditor mission={mission} siblings={siblings} />
      ) : (
        <FinalRewardOrgMissionEditor mission={mission} siblings={siblings} />
      )}

      {/* 역반영 제안 — 원본 가이드가 있는 미션만 */}
      {sourcePartnerMission && (
        <>
          {justProposed && (
            <div
              role="status"
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
            >
              ✅ 개선 제안을 지사에게 보냈어요. 검토 결과는 이 페이지에서 확인할
              수 있어요.
            </div>
          )}
          <ProposeDialog
            currentOrgMission={mission}
            targetPartnerMission={sourcePartnerMission}
            existing={existingContribution}
          />
        </>
      )}
    </div>
  );
}
