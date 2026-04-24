// 스탬프북 상세 뷰 — 홈 페이지/상세 페이지 공용 컴포넌트.
// 격자 UI + 헤더 progress + 다음 할 일 카드.
import Link from "next/link";
import {
  computePackProgress,
  isMissionUnlocked,
  type PackProgress,
} from "@/lib/missions/progress";
import {
  MISSION_KIND_META,
  QUEST_PACK_STATUS_META,
  APPROVED_SUBMISSION_STATUSES,
  type OrgMissionRow,
  type MissionSubmissionRow,
  type OrgQuestPackRow,
  type FinalRewardMissionConfig,
} from "@/lib/missions/types";
import { AcornIcon } from "@/components/acorn-icon";

type TileState =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "NEXT"
  | "UNLOCKED"
  | "LOCKED";

interface TileInfo {
  mission: OrgMissionRow;
  state: TileState;
  submission: MissionSubmissionRow | null;
  reason?: string;
}

function getLatestSubmissionFor(
  missionId: string,
  submissions: MissionSubmissionRow[]
): MissionSubmissionRow | null {
  let latest: MissionSubmissionRow | null = null;
  for (const s of submissions) {
    if (s.org_mission_id !== missionId) continue;
    if (s.status === "REVOKED") continue;
    if (
      !latest ||
      new Date(s.submitted_at).getTime() >
        new Date(latest.submitted_at).getTime()
    ) {
      latest = s;
    }
  }
  return latest;
}

function formatDateRange(
  starts: string | null,
  ends: string | null
): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  if (starts && ends) return `${fmt(starts)} ~ ${fmt(ends)}`;
  if (ends) return `~ ${fmt(ends)}`;
  if (starts) return `${fmt(starts)} ~`;
  return "상시";
}

export interface StampbookDetailProps {
  pack: OrgQuestPackRow;
  missions: OrgMissionRow[];
  submissions: MissionSubmissionRow[];
  userAcornsInPack: number;
  /** 미리 계산된 progress 를 넘기면 재계산 생략 (옵션) */
  progress?: PackProgress;
}

export function StampbookDetail({
  pack,
  missions,
  submissions,
  userAcornsInPack,
  progress: passedProgress,
}: StampbookDetailProps) {
  const progress =
    passedProgress ??
    computePackProgress(missions, submissions, userAcornsInPack);

  const nextId = progress.nextMission?.id ?? null;

  const tiles: TileInfo[] = missions.map((m) => {
    const latest = getLatestSubmissionFor(m.id, submissions);
    let state: TileState;
    let reason: string | undefined;

    if (latest && APPROVED_SUBMISSION_STATUSES.includes(latest.status)) {
      state = "APPROVED";
    } else if (
      latest &&
      (latest.status === "SUBMITTED" || latest.status === "PENDING_REVIEW")
    ) {
      state = "PENDING";
    } else if (latest && latest.status === "REJECTED") {
      state = "REJECTED";
    } else {
      const gate = isMissionUnlocked(
        m,
        missions,
        submissions,
        userAcornsInPack
      );
      if (!gate.unlocked) {
        state = "LOCKED";
        reason = gate.reason;
      } else if (m.id === nextId) {
        state = "NEXT";
      } else {
        state = "UNLOCKED";
      }
    }
    return { mission: m, state, submission: latest, reason };
  });

  const packMeta = QUEST_PACK_STATUS_META[pack.status];
  const pctDisplay = Math.max(4, Math.min(100, progress.percent));

  return (
    <div className="space-y-5">
      {/* 헤더 + 진행도 + 미션 격자 (통합 카드) */}
      <section
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-lg"
        style={
          pack.cover_image_url
            ? {
                backgroundImage: `linear-gradient(135deg, rgba(45,90,61,0.92), rgba(74,124,89,0.9)), url(${pack.cover_image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {/* 상단: 제목 + 날짜 */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${packMeta.color}`}
            >
              {packMeta.label}
            </span>
            <h1 className="mt-2 text-2xl font-bold leading-tight">
              🌲 {pack.name}
            </h1>
            {pack.description && (
              <p className="mt-1.5 text-xs leading-relaxed text-[#D4E4BC]">
                {pack.description}
              </p>
            )}
            <p className="mt-2 text-[11px] font-semibold text-[#D4E4BC]">
              📅 {formatDateRange(pack.starts_at, pack.ends_at)}
            </p>
          </div>
        </div>

        {/* 중단: 진행도 */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-bold">
              {progress.completedSlots}{" "}
              <span className="text-[#D4E4BC]">/</span>{" "}
              {progress.totalSlots} 스탬프
            </p>
            <p className="text-xl font-black tabular-nums">
              {progress.percent}%
            </p>
          </div>
          <div
            className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/20"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FAE7D0] to-[#F5D493] transition-all"
              style={{ width: `${pctDisplay}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] font-semibold text-[#D4E4BC]">
            <AcornIcon /> 획득 {progress.acornsEarned} /{" "}
            {progress.acornsPossible}
          </p>
        </div>

        {/* 하단: 미션 스탬프 격자 (내부 패널) */}
        <div className="mt-5 rounded-2xl bg-white/12 p-3 backdrop-blur-sm ring-1 ring-white/15">
          <h2 className="mb-2.5 px-1 text-[11px] font-bold uppercase tracking-wide text-[#D4E4BC]">
            🎯 미션 스탬프
          </h2>
          {tiles.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-white/30 bg-white/5 p-6 text-center">
              <p className="text-2xl" aria-hidden>
                🌱
              </p>
              <p className="mt-2 text-xs font-semibold text-[#D4E4BC]">
                아직 미션이 준비되지 않았어요
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-2 md:grid-cols-5">
              {tiles.map((t, idx) => (
                <li key={t.mission.id}>
                  <MissionTile tile={t} index={idx + 1} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 다음 할 일 */}
      {progress.nextMission && (
        <section className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#FAE7D0] to-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B4423]">
            🎯 다음 할 일
          </p>
          <div className="mt-2 flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
              {MISSION_KIND_META[progress.nextMission.kind].icon}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-bold text-[#2D5A3D]">
                {progress.nextMission.title}
              </h3>
              {progress.nextMission.description && (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-[#6B6560]">
                  {progress.nextMission.description}
                </p>
              )}
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#6B4423] px-2 py-0.5 text-[10px] font-bold text-white">
                <AcornIcon /> +{progress.nextMission.acorns}
              </p>
            </div>
          </div>
          <Link
            href={`/missions/${progress.nextMission.id}`}
            className="mt-4 block w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52] active:scale-[0.99]"
          >
            미션 시작하기 →
          </Link>
        </section>
      )}
    </div>
  );
}

/* -------- Tile -------- */

function MissionTile({
  tile,
  index,
}: {
  tile: TileInfo;
  index: number;
}) {
  const { mission, state, submission, reason } = tile;
  const meta = MISSION_KIND_META[mission.kind];
  const isFinal = mission.kind === "FINAL_REWARD";

  let finalHint: string | null = null;
  if (isFinal) {
    const cfg = mission.config_json as Partial<FinalRewardMissionConfig>;
    if (cfg?.tiers && Array.isArray(cfg.tiers) && cfg.tiers.length > 0) {
      const sorted = [...cfg.tiers].sort(
        (a, b) => a.threshold - b.threshold
      );
      finalHint = `${sorted[0].threshold}+`;
    }
  }

  let bgClass = "bg-[#FFF8F0] border-[#E8E0D0]";
  let textClass = "text-[#2D5A3D]";
  let statusBadge: string | null = null;
  let statusBadgeClass = "";
  let extraRing = "";
  let overlayIcon: string | null = null;

  switch (state) {
    case "APPROVED":
      bgClass =
        "bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300";
      textClass = "text-emerald-900";
      overlayIcon = "✅";
      break;
    case "PENDING":
      bgClass = "bg-sky-50 border-sky-200";
      textClass = "text-sky-900";
      overlayIcon = "⏳";
      statusBadge = "검토 대기";
      statusBadgeClass = "bg-sky-600 text-white";
      break;
    case "REJECTED":
      bgClass = "bg-rose-50 border-rose-200";
      textClass = "text-rose-900";
      overlayIcon = "❌";
      statusBadge = "반려";
      statusBadgeClass = "bg-rose-600 text-white";
      break;
    case "NEXT":
      bgClass =
        "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-400";
      textClass = "text-amber-900";
      extraRing = "ring-4 ring-amber-300/60 animate-pulse";
      statusBadge = "다음";
      statusBadgeClass = "bg-amber-500 text-white";
      break;
    case "UNLOCKED":
      bgClass = "bg-[#FFF8F0] border-[#D4E4BC]";
      textClass = "text-[#2D5A3D]";
      break;
    case "LOCKED":
      bgClass = "bg-zinc-100 border-zinc-200";
      textClass = "text-zinc-500";
      overlayIcon = "🔒";
      break;
  }

  if (isFinal && state !== "LOCKED" && state !== "APPROVED") {
    bgClass =
      "bg-gradient-to-br from-[#FAE7D0] via-[#F5D493] to-[#E8B86D] border-[#C4956A]";
    textClass = "text-[#6B4423]";
  }

  const acornsBadge =
    state === "APPROVED" && submission?.awarded_acorns
      ? `+${submission.awarded_acorns}`
      : `+${mission.acorns}`;

  const content = (
    <div
      className={`group relative flex aspect-square flex-col items-center justify-between overflow-hidden rounded-2xl border-2 p-2 shadow-sm transition hover:shadow-md active:scale-[0.97] ${bgClass} ${textClass} ${extraRing}`}
      title={reason ?? mission.title}
    >
      <span className="absolute left-1.5 top-1.5 rounded-md bg-black/10 px-1 text-[9px] font-bold">
        {index}
      </span>

      {statusBadge && (
        <span
          className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${statusBadgeClass}`}
        >
          {statusBadge}
        </span>
      )}

      <div className="flex flex-1 items-center justify-center text-4xl">
        {isFinal ? "🎁" : meta.icon}
      </div>

      {overlayIcon && (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl opacity-80"
          aria-hidden
        >
          {overlayIcon}
        </span>
      )}

      <div className="w-full text-center">
        <p className="line-clamp-1 text-[10px] font-bold">{mission.title}</p>
        {isFinal && finalHint ? (
          <p className="text-[9px] font-semibold opacity-80">
            <AcornIcon size={10} /> {finalHint}
          </p>
        ) : (
          <p className="text-[9px] font-bold opacity-80">
            <AcornIcon size={10} /> {acornsBadge}
          </p>
        )}
      </div>
    </div>
  );

  if (state === "LOCKED") {
    return (
      <Link
        href={`/missions/${mission.id}`}
        aria-label={`${mission.title} (잠김: ${reason ?? ""})`}
      >
        {content}
      </Link>
    );
  }

  return (
    <Link href={`/missions/${mission.id}`} aria-label={mission.title}>
      {content}
    </Link>
  );
}
