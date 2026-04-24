import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { AcornIcon } from "@/components/acorn-icon";
import {
  loadOrgMissionsByQuestPack,
  loadOrgQuestPackById,
} from "@/lib/missions/queries";
import {
  MISSION_KIND_META,
  type ApprovalMode,
  type OrgMissionRow,
  type UnlockRule,
} from "@/lib/missions/types";
import { PackInfoEditor } from "./pack-info-editor";
import { MissionRowActions } from "./mission-row-actions";
import { loadPartnerDisplayNameForOrg } from "@/lib/org-partner";

export const dynamic = "force-dynamic";

const UNLOCK_META: Record<
  UnlockRule,
  { label: string; icon: ReactNode; color: string }
> = {
  ALWAYS: {
    label: "항상 열림",
    icon: "🔓",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  SEQUENTIAL: {
    label: "순차 해금",
    icon: "🔗",
    color: "bg-sky-50 text-sky-800 border-sky-200",
  },
  TIER_GATE: {
    label: "도토리 게이트",
    icon: <AcornIcon size={12} />,
    color: "bg-amber-50 text-amber-800 border-amber-200",
  },
};

const APPROVAL_META: Record<
  ApprovalMode,
  { label: string; icon: string; color: string }
> = {
  AUTO: {
    label: "자동 승인",
    icon: "✅",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  MANUAL_TEACHER: {
    label: "선생님 검토",
    icon: "👩‍🏫",
    color: "bg-sky-50 text-sky-800 border-sky-200",
  },
  AUTO_24H: {
    label: "24시간 후 자동",
    icon: "⏳",
    color: "bg-amber-50 text-amber-800 border-amber-200",
  },
  PARTNER_REVIEW: {
    label: "지사 검토",
    icon: "🏢",
    color: "bg-violet-50 text-violet-800 border-violet-200",
  },
};

export default async function EditOrgQuestPackPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>;
}) {
  const { orgId, id } = await params;
  const session = await requireOrg();

  const pack = await loadOrgQuestPackById(id);
  if (!pack) notFound();
  if (pack.org_id !== session.orgId) {
    redirect(`/org/${orgId}/quest-packs`);
  }

  const [missions, partnerName] = await Promise.all([
    loadOrgMissionsByQuestPack(id),
    loadPartnerDisplayNameForOrg(orgId),
  ]);

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
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">편집</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        {/* Left: pack info + mission list */}
        <div className="space-y-6">
          <PackInfoEditor pack={pack} missionCount={missions.length} />

          {/* 미션 리스트 */}
          <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
                <span aria-hidden>🎯</span>
                <span>담긴 미션 ({missions.length})</span>
              </h2>
              <Link
                href={`/org/${orgId}/missions/catalog?packId=${id}`}
                className="inline-flex items-center gap-1 rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#234a30]"
              >
                <span aria-hidden>📋</span>
                <span>미션 카탈로그에서 추가</span>
              </Link>
            </div>

            {missions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-8 text-center">
                <p className="text-4xl" aria-hidden>
                  🌱
                </p>
                <p className="mt-2 text-sm font-bold text-[#2D5A3D]">
                  아직 담긴 미션이 없어요
                </p>
                <p className="mt-1 text-xs text-[#6B6560]">
                  {partnerName}에서 개발한 카탈로그에서 마음에 드는 미션을
                  골라 담아 주세요.
                </p>
                <Link
                  href={`/org/${orgId}/missions/catalog?packId=${id}`}
                  className="mt-3 inline-flex items-center gap-1 rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#234a30]"
                >
                  <span aria-hidden>📋</span>
                  <span>카탈로그 열기</span>
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {missions.map((m, idx) => (
                  <MissionRow
                    key={m.id}
                    mission={m}
                    index={idx}
                    orgId={orgId}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < missions.length - 1}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right: 스탬프북 프리뷰 */}
        <aside id="preview" className="space-y-4">
          <div className="sticky top-4">
            <section className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 shadow-sm">
              <p className="text-[11px] font-semibold text-[#8B6F47]">
                👀 참가자에게는 이렇게 보입니다
              </p>
              <div className="mt-3 rounded-xl border border-[#D4E4BC] bg-white p-3 shadow-sm">
                <p className="mb-2 text-center text-xs font-bold text-[#2D5A3D]">
                  🌲 {pack.name || "(이름 없음)"}
                </p>
                <StampBookPreview missions={missions} />
                <p className="mt-3 text-center text-[10px] text-[#8B7F75]">
                  총 {missions.length}칸 · 레이아웃: {layoutLabel(pack.layout_mode)}
                </p>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}

function layoutLabel(mode: string): string {
  if (mode === "GRID") return "격자형";
  if (mode === "LIST") return "목록형";
  return "숲길 지도";
}

function StampBookPreview({ missions }: { missions: OrgMissionRow[] }) {
  // 빈 상태
  if (missions.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg bg-[#F5F1E8] text-xs text-[#8B7F75]">
        미션을 담으면 여기에 보여요
      </div>
    );
  }

  // N x 5 격자. 미션 수에 맞춰 빈 칸 없이.
  const cols = 5;
  const rows = Math.ceil(missions.length / cols);

  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-label={`${rows}행 ${cols}열 스탬프북 격자`}
    >
      {missions.map((m, idx) => {
        const meta = MISSION_KIND_META[m.kind];
        return (
          <div
            key={m.id}
            className="flex aspect-square flex-col items-center justify-center rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] p-1 text-center"
            aria-label={`${idx + 1}번 ${meta.label}: ${m.title}`}
          >
            <span className="text-lg" aria-hidden>
              {m.icon || meta.icon}
            </span>
            <span className="text-[9px] font-bold text-[#2D5A3D]">
              {idx + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MissionRow({
  mission,
  index,
  orgId,
  canMoveUp,
  canMoveDown,
}: {
  mission: OrgMissionRow;
  index: number;
  orgId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const kindMeta = MISSION_KIND_META[mission.kind];
  const unlockMeta = UNLOCK_META[mission.unlock_rule];
  const approvalMeta = APPROVAL_META[mission.approval_mode];
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-lg font-bold text-[#2D5A3D]"
          aria-hidden
        >
          {index + 1}
        </span>
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#E8F0E4] text-xl"
          aria-hidden
        >
          {mission.icon || kindMeta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#2C2C2C]">
            {mission.title || "(제목 없음)"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
              <span aria-hidden>{kindMeta.icon}</span>
              <span>{kindMeta.label}</span>
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
              <AcornIcon size={12} />
              <span>+{mission.acorns}</span>
            </span>
            <span
              className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${unlockMeta.color}`}
            >
              <span aria-hidden>{unlockMeta.icon}</span>
              <span>{unlockMeta.label}</span>
            </span>
            <span
              className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${approvalMeta.color}`}
            >
              <span aria-hidden>{approvalMeta.icon}</span>
              <span>{approvalMeta.label}</span>
            </span>
            {!mission.is_active && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                비활성
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <Link
          href={`/org/${orgId}/missions/${mission.id}/edit`}
          className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
        >
          <span aria-hidden>✏️</span>
          <span>편집</span>
        </Link>
        <MissionRowActions
          missionId={mission.id}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        />
      </div>
    </li>
  );
}
