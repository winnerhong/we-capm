import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { loadPartnerMissionById } from "@/lib/missions/queries";
import {
  MISSION_KIND_META,
  MISSION_STATUS_META,
  type MissionKind,
} from "@/lib/missions/types";
import { PhotoMissionEditor } from "./editors/PhotoMissionEditor";
import { QrQuizMissionEditor } from "./editors/QrQuizMissionEditor";
import { FinalRewardMissionEditor } from "./editors/FinalRewardMissionEditor";
import { PhotoApprovalMissionEditor } from "./editors/PhotoApprovalMissionEditor";
import { TreasureMissionEditor } from "./editors/TreasureMissionEditor";
import { RadioMissionEditor } from "./editors/RadioMissionEditor";
import { CoopMissionEditor } from "./editors/CoopMissionEditor";
import { BroadcastMissionEditor } from "./editors/BroadcastMissionEditor";

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

export default async function EditPartnerMissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const partner = await requirePartner();
  const { id } = await params;

  const mission = await loadPartnerMissionById(id);
  if (!mission) notFound();

  // ownership 검증
  if (mission.partner_id !== partner.id) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
          <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
            대시보드
          </Link>
          <span className="mx-2">/</span>
          <Link href="/partner/missions" className="hover:text-[#2D5A3D]">
            미션 라이브러리
          </Link>
        </nav>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-4xl" aria-hidden>
            🚫
          </p>
          <p className="mt-3 text-sm font-bold text-rose-800">
            이 미션을 편집할 권한이 없어요
          </p>
          <p className="mt-1 text-xs text-rose-700">
            다른 지사가 만든 미션은 편집할 수 없습니다.
          </p>
          <Link
            href="/partner/missions"
            className="mt-4 inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100"
          >
            ← 미션 목록으로
          </Link>
        </div>
      </div>
    );
  }

  const kindMeta = MISSION_KIND_META[mission.kind];
  const statusMeta = MISSION_STATUS_META[mission.status];
  const isSupported = SUPPORTED_KINDS.has(mission.kind);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/missions" className="hover:text-[#2D5A3D]">
          미션 라이브러리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">미션 편집</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm"
              aria-hidden
            >
              {mission.icon || kindMeta.icon}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                  <span aria-hidden>{kindMeta.icon}</span>
                  <span>{kindMeta.label}</span>
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.color}`}
                >
                  {statusMeta.label}
                </span>
              </div>
              <h1 className="mt-1 truncate text-lg font-bold text-[#2D5A3D] md:text-xl">
                {mission.title}
              </h1>
              <p className="mt-0.5 text-[11px] text-[#6B6560]">
                버전 v{mission.version}
              </p>
            </div>
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
            {kindMeta.label} 편집 UI는 Phase 3에서 제공돼요
          </p>
          <p className="mt-1 text-xs text-amber-800">
            이 미션은 아직 편집할 수 없어요. 현재 지원 종류(사진·QR 퀴즈·자연물
            찾기·보물찾기·신청곡 & 사연·최종 보상)를 사용해 주세요.
          </p>
          <Link
            href="/partner/missions"
            className="mt-4 inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
          >
            ← 목록으로
          </Link>
        </div>
      ) : mission.kind === "PHOTO" ? (
        <PhotoMissionEditor mission={mission} />
      ) : mission.kind === "QR_QUIZ" ? (
        <QrQuizMissionEditor mission={mission} />
      ) : mission.kind === "PHOTO_APPROVAL" ? (
        <PhotoApprovalMissionEditor mission={mission} />
      ) : mission.kind === "TREASURE" ? (
        <TreasureMissionEditor mission={mission} />
      ) : mission.kind === "RADIO" ? (
        <RadioMissionEditor mission={mission} />
      ) : mission.kind === "COOP" ? (
        <CoopMissionEditor mission={mission} />
      ) : mission.kind === "BROADCAST" ? (
        <BroadcastMissionEditor mission={mission} />
      ) : (
        <FinalRewardMissionEditor mission={mission} />
      )}
    </div>
  );
}
