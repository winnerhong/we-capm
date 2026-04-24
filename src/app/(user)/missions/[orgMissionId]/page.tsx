// 미션 runner (dispatcher)
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAppUser } from "@/lib/user-auth-guard";
import { loadChildrenForUser } from "@/lib/app-user/queries";
import { createClient } from "@/lib/supabase/server";
import {
  loadActiveCoopSessionForUser,
  loadLiveBroadcastsForOrg,
  loadOrgMissionById,
  loadOrgMissionsByQuestPack,
  loadOrgQuestPackById,
  loadTreasureProgress,
  loadUserSubmissionForMission,
  loadUserSubmissions,
  sumAcornsForPack,
} from "@/lib/missions/queries";
import { loadAppUserById } from "@/lib/app-user/queries";
import { isMissionUnlocked } from "@/lib/missions/progress";
import {
  MISSION_KIND_META,
  SUBMISSION_STATUS_META,
  type BroadcastMissionConfig,
  type CoopMissionConfig,
  type FinalRewardMissionConfig,
  type PhotoApprovalMissionConfig,
  type PhotoMissionConfig,
  type QrQuizMissionConfig,
  type RadioMissionConfig,
  type TreasureMissionConfig,
} from "@/lib/missions/types";
import { PhotoRunner } from "./runners/PhotoRunner";
import { QrQuizRunner } from "./runners/QrQuizRunner";
import { FinalRewardRunner } from "./runners/FinalRewardRunner";
import { PhotoApprovalRunner } from "./runners/PhotoApprovalRunner";
import { TreasureRunner } from "./runners/TreasureRunner";
import { RadioRunner } from "./runners/RadioRunner";
import { CoopRunner } from "./runners/CoopRunner";
import { CoopRefresher } from "./runners/CoopRefresher";
import { BroadcastRunner } from "./runners/BroadcastRunner";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function MissionRunnerPage({
  params,
}: {
  params: Promise<{ orgMissionId: string }>;
}) {
  const user = await requireAppUser();
  const { orgMissionId } = await params;

  const mission = await loadOrgMissionById(orgMissionId);
  if (!mission) notFound();
  if (mission.org_id !== user.orgId) redirect("/home");

  const meta = MISSION_KIND_META[mission.kind];
  const packId = mission.quest_pack_id;
  const backHref = packId ? `/stampbook/${packId}` : "/stampbook";

  // 기존 제출 확인
  const existing = await loadUserSubmissionForMission(user.id, mission.id);
  const hasActiveSubmission =
    existing &&
    (existing.status === "AUTO_APPROVED" ||
      existing.status === "APPROVED" ||
      existing.status === "SUBMITTED" ||
      existing.status === "PENDING_REVIEW");
  // PHOTO_APPROVAL / RADIO 는 자체 runner 에서 상태 패널을 렌더하므로
  // 공통 "결과 화면" 으로 대체하지 않는다 (REJECTED 후 재제출 UI 유지).
  const kindRendersOwnStatus =
    mission.kind === "PHOTO_APPROVAL" ||
    mission.kind === "RADIO" ||
    mission.kind === "COOP" ||
    mission.kind === "BROADCAST";
  const isDone = hasActiveSubmission && !kindRendersOwnStatus;

  // Header component
  const header = (
    <div className="space-y-1.5">
      <nav className="text-[11px] text-[#6B6560]">
        <Link href={backHref} className="hover:underline">
          ← 스탬프북으로
        </Link>
      </nav>
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E8F0E4] to-[#D4E4BC] text-3xl shadow-sm">
          {mission.kind === "FINAL_REWARD" ? "🎁" : meta.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B6560]">
            {meta.label}
          </p>
          <h1 className="text-xl font-bold text-[#2D5A3D]">
            {mission.title}
          </h1>
          {mission.description && (
            <p className="mt-1 text-xs leading-relaxed text-[#6B6560]">
              {mission.description}
            </p>
          )}
          {mission.kind !== "FINAL_REWARD" && (
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#FAE7D0] px-2 py-0.5 text-[11px] font-bold text-[#6B4423]">
              <AcornIcon className="text-[#6B4423]" /> +{mission.acorns}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // 이미 APPROVED/PENDING/SUBMITTED → 결과 화면
  if (isDone && existing) {
    const statusMeta = SUBMISSION_STATUS_META[existing.status];
    return (
      <div className="space-y-4">
        {header}

        <section
          className={`rounded-3xl border p-5 shadow-sm ${statusMeta.color}`}
        >
          <p className="text-4xl" aria-hidden>
            {statusMeta.icon}
          </p>
          <h2 className="mt-2 text-lg font-bold">{statusMeta.label}</h2>
          <p className="mt-1 text-xs">
            제출 시각: {formatDateTime(existing.submitted_at)}
          </p>
          {existing.awarded_acorns != null &&
            existing.awarded_acorns > 0 && (
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/60 px-3 py-1 text-sm font-bold">
                <AcornIcon size={18} /> +{existing.awarded_acorns} 도토리 획득
              </p>
            )}
          {existing.reject_reason && (
            <p className="mt-3 rounded-2xl bg-white/60 px-3 py-2 text-xs">
              💬 {existing.reject_reason}
            </p>
          )}
        </section>

        <Link
          href={backHref}
          className="block w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52]"
        >
          ← 스탬프북으로 돌아가기
        </Link>
      </div>
    );
  }

  // Unlock check (FINAL_REWARD 외)
  if (mission.kind !== "FINAL_REWARD") {
    const allMissions = packId
      ? await loadOrgMissionsByQuestPack(packId)
      : [mission];
    const userSubmissions = await loadUserSubmissions(user.id, {
      packId: packId ?? undefined,
    });
    const acornsInPack = packId
      ? await sumAcornsForPack(user.id, packId)
      : 0;
    const gate = isMissionUnlocked(
      mission,
      allMissions,
      userSubmissions,
      acornsInPack
    );
    if (!gate.unlocked) {
      return (
        <div className="space-y-4">
          {header}
          <section className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-center shadow-sm">
            <p className="text-5xl" aria-hidden>
              🔒
            </p>
            <h2 className="mt-3 text-base font-bold text-zinc-700">
              아직 잠긴 미션이에요
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {gate.reason ?? "조건을 달성하면 열려요"}
            </p>
          </section>
          <Link
            href={backHref}
            className="block w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52]"
          >
            ← 스탬프북으로 돌아가기
          </Link>
        </div>
      );
    }
  }

  // Dispatch
  const configJson = (mission.config_json ?? {}) as Record<string, unknown>;

  let runnerBody: React.ReactNode;
  if (mission.kind === "PHOTO") {
    const photoConfig: PhotoMissionConfig = {
      min_photos:
        typeof configJson.min_photos === "number"
          ? configJson.min_photos
          : 1,
      prompt:
        typeof configJson.prompt === "string" ? configJson.prompt : "",
      require_caption: Boolean(configJson.require_caption),
      geofence:
        configJson.geofence &&
        typeof configJson.geofence === "object" &&
        configJson.geofence !== null
          ? (configJson.geofence as PhotoMissionConfig["geofence"])
          : undefined,
    };
    runnerBody = <PhotoRunner mission={mission} config={photoConfig} />;
  } else if (mission.kind === "QR_QUIZ") {
    const qrConfig: QrQuizMissionConfig = {
      qr_token:
        typeof configJson.qr_token === "string" ? configJson.qr_token : "",
      qr_single_use:
        typeof configJson.qr_single_use === "boolean"
          ? configJson.qr_single_use
          : true,
      quiz_type:
        configJson.quiz_type === "MCQ" ||
        configJson.quiz_type === "SHORT" ||
        configJson.quiz_type === "NONE"
          ? configJson.quiz_type
          : "NONE",
      quiz_text:
        typeof configJson.quiz_text === "string"
          ? configJson.quiz_text
          : undefined,
      quiz_choices: Array.isArray(configJson.quiz_choices)
        ? (configJson.quiz_choices.filter(
            (c) =>
              c &&
              typeof c === "object" &&
              typeof (c as { id?: unknown }).id === "string" &&
              typeof (c as { label?: unknown }).label === "string"
          ) as Array<{ id: string; label: string }>)
        : undefined,
      quiz_answer:
        typeof configJson.quiz_answer === "string"
          ? configJson.quiz_answer
          : undefined,
      hint: typeof configJson.hint === "string" ? configJson.hint : undefined,
    };
    runnerBody = <QrQuizRunner mission={mission} config={qrConfig} />;
  } else if (mission.kind === "FINAL_REWARD") {
    if (!packId) {
      return (
        <div className="space-y-4">
          {header}
          <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
            <p className="text-sm font-semibold text-rose-700">
              스탬프북이 연결되지 않았어요
            </p>
          </section>
        </div>
      );
    }
    const pack = await loadOrgQuestPackById(packId);
    if (!pack) notFound();
    const acornsInPack = await sumAcornsForPack(user.id, packId);

    // Normalize config
    const rawTiers = Array.isArray(configJson.tiers) ? configJson.tiers : [];
    const tiers: FinalRewardMissionConfig["tiers"] = rawTiers.flatMap(
      (t) => {
        if (!t || typeof t !== "object") return [];
        const o = t as Record<string, unknown>;
        if (
          typeof o.threshold !== "number" ||
          typeof o.label !== "string" ||
          typeof o.reward_desc !== "string"
        ) {
          return [];
        }
        return [
          {
            threshold: o.threshold,
            label: o.label,
            reward_desc: o.reward_desc,
            icon: typeof o.icon === "string" ? o.icon : undefined,
          },
        ];
      }
    );
    const finalConfig: FinalRewardMissionConfig = {
      tiers,
      redemption_ttl_hours:
        typeof configJson.redemption_ttl_hours === "number"
          ? configJson.redemption_ttl_hours
          : 24,
      scope:
        configJson.scope === "ALL_PACKS" ? "ALL_PACKS" : "QUEST_PACK",
    };
    runnerBody = (
      <FinalRewardRunner
        mission={mission}
        config={finalConfig}
        packId={packId}
        userAcornsInPack={acornsInPack}
      />
    );
  } else if (mission.kind === "PHOTO_APPROVAL") {
    const paConfig: PhotoApprovalMissionConfig = {
      prompt: typeof configJson.prompt === "string" ? configJson.prompt : "",
      min_photos:
        typeof configJson.min_photos === "number"
          ? configJson.min_photos
          : 1,
      reject_reasons: Array.isArray(configJson.reject_reasons)
        ? (configJson.reject_reasons.filter(
            (r) => typeof r === "string"
          ) as string[])
        : [],
      sla_hours:
        typeof configJson.sla_hours === "number"
          ? configJson.sla_hours
          : 24,
    };
    runnerBody = (
      <PhotoApprovalRunner
        mission={mission}
        config={paConfig}
        existing={existing ?? null}
      />
    );
  } else if (mission.kind === "TREASURE") {
    const rawSteps = Array.isArray(configJson.steps) ? configJson.steps : [];
    const steps: TreasureMissionConfig["steps"] = rawSteps.flatMap((s) => {
      if (!s || typeof s !== "object") return [];
      const o = s as Record<string, unknown>;
      if (
        typeof o.order !== "number" ||
        typeof o.hint_text !== "string" ||
        (o.unlock_rule !== "AUTO" &&
          o.unlock_rule !== "QR" &&
          o.unlock_rule !== "ANSWER")
      ) {
        return [];
      }
      return [
        {
          order: o.order,
          hint_text: o.hint_text,
          unlock_rule: o.unlock_rule,
          answer: typeof o.answer === "string" ? o.answer : undefined,
        },
      ];
    });
    const treasureConfig: TreasureMissionConfig = {
      steps,
      final_qr_token:
        typeof configJson.final_qr_token === "string"
          ? configJson.final_qr_token
          : "",
    };
    const initialProgress = await loadTreasureProgress(user.id, mission.id);
    runnerBody = (
      <TreasureRunner
        mission={mission}
        config={treasureConfig}
        initialProgress={initialProgress}
      />
    );
  } else if (mission.kind === "RADIO") {
    const radioConfig: RadioMissionConfig = {
      prompt_song:
        typeof configJson.prompt_song === "string"
          ? configJson.prompt_song
          : "",
      prompt_story:
        typeof configJson.prompt_story === "string"
          ? configJson.prompt_story
          : "",
      max_length:
        typeof configJson.max_length === "number"
          ? configJson.max_length
          : 300,
    };
    const children = await loadChildrenForUser(user.id);
    // played_at 조회 — 기존 submission 과 연결된 radio_queue 의 played_at
    let playedAt: string | null = null;
    if (existing) {
      const supabase = await createClient();
      const qResp = (await (
        supabase.from("mission_radio_queue" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{
                data: { played_at: string | null } | null;
              }>;
            };
          };
        }
      )
        .select("played_at")
        .eq("submission_id", existing.id)
        .maybeSingle()) as {
        data: { played_at: string | null } | null;
      };
      playedAt = qResp.data?.played_at ?? null;
    }
    runnerBody = (
      <RadioRunner
        mission={mission}
        config={radioConfig}
        existing={existing ?? null}
        kids={children.map((c) => ({ id: c.id, name: c.name }))}
        playedAt={playedAt}
      />
    );
  } else if (mission.kind === "COOP") {
    const coopConfig: CoopMissionConfig = {
      group_size:
        typeof configJson.group_size === "number" ? configJson.group_size : 2,
      match_window_min:
        typeof configJson.match_window_min === "number"
          ? configJson.match_window_min
          : 30,
      completion_rule:
        configJson.completion_rule === "SHARED_PHOTO"
          ? "SHARED_PHOTO"
          : "BOTH_CONFIRM",
    };
    const session = await loadActiveCoopSessionForUser(user.id, mission.id);
    const children = await loadChildrenForUser(user.id);

    // 짝꿍 이름 조회 (세션이 PAIRED 이상일 때)
    let partnerName: string | null = null;
    if (session) {
      const partnerId =
        session.initiator_user_id === user.id
          ? session.partner_user_id
          : session.initiator_user_id;
      if (partnerId) {
        const partner = await loadAppUserById(partnerId);
        partnerName = partner?.parent_name ?? null;
      }
    }

    runnerBody = (
      <>
        <CoopRunner
          mission={mission}
          config={coopConfig}
          initialSession={session}
          currentUserId={user.id}
          kids={children.map((c) => ({ id: c.id, name: c.name }))}
          partnerName={partnerName}
        />
        {session && <CoopRefresher sessionId={session.id} />}
      </>
    );
  } else if (mission.kind === "BROADCAST") {
    const broadcastConfig: BroadcastMissionConfig = {
      duration_sec:
        typeof configJson.duration_sec === "number"
          ? configJson.duration_sec
          : 300,
      prompt: typeof configJson.prompt === "string" ? configJson.prompt : "",
      submission_kind:
        configJson.submission_kind === "TEXT" ? "TEXT" : "PHOTO",
    };

    // 이 미션에 현재 LIVE 인 broadcast 찾기
    const live = await loadLiveBroadcastsForOrg(user.orgId);
    const active = live.find((b) => b.org_mission_id === mission.id) ?? null;

    if (!active) {
      runnerBody = (
        <section className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/80 p-8 text-center shadow-sm">
          <p className="text-5xl" aria-hidden>
            🌿
          </p>
          <h2 className="mt-3 text-base font-bold text-[#2D5A3D]">
            지금은 돌발이 없어요
          </h2>
          <p className="mt-1 text-xs text-[#6B6560]">
            운영자가 발동할 때 알림이 와요 — 조금만 기다려주세요
          </p>
          <Link
            href="/broadcasts"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-2xl border-2 border-[#2D5A3D] bg-white px-4 py-2 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
          >
            ⚡ 진행 중인 돌발 미션 보기 →
          </Link>
        </section>
      );
    } else {
      runnerBody = (
        <BroadcastRunner
          mission={mission}
          config={broadcastConfig}
          broadcast={active}
          existing={existing ?? null}
        />
      );
    }
  } else {
    runnerBody = (
      <section className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/80 p-8 text-center shadow-sm">
        <p className="text-5xl" aria-hidden>
          🚧
        </p>
        <h2 className="mt-3 text-base font-bold text-[#2D5A3D]">
          Phase 3에서 오픈해요
        </h2>
        <p className="mt-1 text-xs text-[#6B6560]">
          {meta.label} 미션은 다음 업데이트에서 즐길 수 있어요
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      {runnerBody}
    </div>
  );
}
