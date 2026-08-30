// 미션 runner (dispatcher)
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireEventContext } from "@/lib/event-context";
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
import { MissionAttemptHeartbeat } from "./MissionAttemptHeartbeat";
import { SubmittedPhotos } from "./submitted-photos";
import { resignSubmissionPhotoUrls } from "@/lib/missions/resign-photos";
import {
  isPhotoFeedEnabled,
  loadEventPhotoFeed,
  loadMyLikeCountsByMission,
  loadSubmissionLikers,
} from "@/lib/missions/photo-feed-queries";
import { LIKES_PER_MISSION } from "@/lib/missions/photo-feed-core";
import { PhotoGrid } from "@/components/photo-feed/photo-grid";
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
import { fmtDateTimeKst } from "@/lib/datetime/kst";

export const dynamic = "force-dynamic";

// 서버 액션 후 자동 RSC refresh 시 throw 가 발생하면 클라이언트가
// "An error occurred in the Server Components render" 만 보게 되므로,
// 각 쿼리를 격리해 fallback 값으로 안전하게 처리.
async function safeQuery<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[MissionRunnerPage/${label}] threw`, e);
    return fallback;
  }
}

function formatDateTime(iso: string): string {
  try {
    return fmtDateTimeKst(iso);
  } catch {
    return iso;
  }
}

export default async function MissionRunnerPage({
  params,
}: {
  params: Promise<{ eventId: string; orgMissionId: string }>;
}) {
  const { eventId, orgMissionId } = await params;
  const ctx = await requireEventContext(eventId);
  const user = ctx.user;
  // 행사 시작 전(예정)에는 미션이 열리지 않는다.
  // 끝난 행사는 통과시킨다 — 이미 해낸 미션의 결과 화면(사진·도토리)이
  // 그 가족의 기록이라서다. 새로 제출하는 길만 아래에서 막는다.
  if (ctx.access.phase === "upcoming") redirect(ctx.href());

  const mission = await safeQuery(
    "loadOrgMissionById",
    () => loadOrgMissionById(orgMissionId),
    null
  );
  if (!mission) notFound();
  // 이 행사를 연 기관의 미션만. 다른 기관 링크는 스탬프북으로.
  if (mission.org_id !== ctx.orgId) redirect(ctx.href("/stampbook"));

  const meta = MISSION_KIND_META[mission.kind];
  const packId = mission.quest_pack_id;
  const backHref = ctx.href(
    packId ? `/stampbook/${packId}` : "/stampbook"
  );

  // 기존 제출 확인
  const existing = await safeQuery(
    "loadUserSubmissionForMission",
    () => loadUserSubmissionForMission(user.id, mission.id),
    null
  );
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
  // 끝난 행사에서는 자체 러너도 쓰지 않는다. 러너는 "다시 찍기·재제출" 을
  // 품고 있어서, 잠긴 행사에서 열면 눌러도 안 되는 버튼이 남는다.
  // 대신 공통 결과 화면으로 보낸다 — 그게 그 가족이 남긴 기록이다.
  const isDone =
    hasActiveSubmission && (!kindRendersOwnStatus || !ctx.access.canPlay);

  /* ---------------------------------------------------------------------- */
  /* 사진이 들어가는 미션의 공통 처리                                        */
  /*                                                                        */
  /* PHOTO 는 공통 결과 화면으로, PHOTO_APPROVAL 은 자체 상태 패널로 그려진다.  */
  /* 사진 관련 처리를 각 분기 안에 두었더니 한쪽에만 붙어, PHOTO_APPROVAL 은    */
  /* 만료된 signed URL 을 그대로 걸어 깨진 사진을 보여주고 "다른 가족들의 사진"  */
  /* 도 없었다. 같은 사진 미션인데 화면 종류에 따라 다르게 동작할 이유가 없다 —  */
  /* 여기서 한 번 만들어 두 분기가 같이 쓴다.                                  */
  /* ---------------------------------------------------------------------- */
  const isPhotoKind =
    mission.kind === "PHOTO" || mission.kind === "PHOTO_APPROVAL";

  const existingPayload = (existing?.payload_json ?? {}) as {
    photo_urls?: unknown;
    caption?: unknown;
  };
  const rawSubmittedUrls =
    isPhotoKind && Array.isArray(existingPayload.photo_urls)
      ? existingPayload.photo_urls.filter(
          (u): u is string => typeof u === "string" && u.length > 0
        )
      : [];
  // 사설 버킷 signed URL 은 24시간 만료 — 페이지 표시 직전 재서명.
  const submittedUrls =
    rawSubmittedUrls.length > 0
      ? await safeQuery(
          "resignSubmissionPhotoUrls",
          () => resignSubmissionPhotoUrls(rawSubmittedUrls),
          rawSubmittedUrls
        )
      : [];
  const submittedCaption =
    typeof existingPayload.caption === "string" ? existingPayload.caption : "";

  // 사진 나눠보기 — 기관이 이 행사에서 켰을 때만 안내도 피드도 나온다.
  const feedEnabled = isPhotoKind ? await isPhotoFeedEnabled(eventId) : false;
  const othersPhotos = feedEnabled
    ? await safeQuery(
        "loadEventPhotoFeed",
        () =>
          loadEventPhotoFeed({
            eventId,
            missionId: mission.id,
            excludeUserId: ctx.user.id,
            viewerId: ctx.user.id,
            limit: 12,
          }),
        []
      )
    : [];
  // 좋아요는 미션마다 3개. 남은 개수를 머리말에 적어둬야 신중하게 쓴다.
  const myLikeCounts = feedEnabled
    ? await safeQuery(
        "loadMyLikeCountsByMission",
        () => loadMyLikeCountsByMission(ctx.user.id, [mission.id]),
        {}
      )
    : {};
  const likesLeft = LIKES_PER_MISSION - (myLikeCounts[mission.id] ?? 0);
  /**
   * 돌아가기 — 미션 화면 어디에서든 바닥에 둔다.
   *
   * 예전엔 결과 화면과 잠긴 화면에만 있었다. 정작 미션을 하는 중(러너 화면)에는
   * 출구가 머리말의 작은 링크뿐이라, 폰에서는 화면 끝까지 내려간 뒤 다시 맨 위로
   * 올라가야 나갈 수 있었다. 미션은 중간에 그만두는 일이 흔하다.
   */
  const backButton = (
    <Link
      href={backHref}
      className="block w-full rounded-2xl bg-[#2D5A3D] px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#3A7A52]"
    >
      ← 스탬프북으로 돌아가기
    </Link>
  );

  // 사진 장수 정책 — 운영자 설정한 min_photos 가 곧 필요 장수(min == max).
  const photoCfg = (mission.config_json ?? {}) as Record<string, unknown>;
  const minPhotos =
    mission.kind === "PHOTO"
      ? Math.max(1, (photoCfg as Partial<PhotoMissionConfig>).min_photos ?? 1)
      : mission.kind === "PHOTO_APPROVAL"
        ? Math.max(
            1,
            (photoCfg as Partial<PhotoApprovalMissionConfig>).min_photos ?? 1
          )
        : 1;

  // 내 사진에 누가 하트를 눌렀는지 — 숫자만 있으면 "몇 명이 봤나" 로 끝난다.
  const myLikers =
    feedEnabled && existing && (existing.like_count ?? 0) > 0
      ? await safeQuery(
          "loadSubmissionLikers",
          () => loadSubmissionLikers(existing.id, eventId),
          []
        )
      : [];

  // 제출한 사진 + 다시 찍기. PHOTO 는 결과 화면에서, PHOTO_APPROVAL 은 자체 상태
  // 패널 아래에서 — 어느 쪽이든 "다시 찍기" 가 있어야 한다. 반려 상태는 예외로,
  // 러너가 재제출 폼을 따로 띄우므로 여기서 중복해서 보여주지 않는다.
  const submittedPhotosSection =
    isPhotoKind && existing && submittedUrls.length > 0 &&
    existing.status !== "REJECTED" ? (
      <SubmittedPhotos
        missionId={mission.id}
        initialUrls={submittedUrls}
        initialCaption={submittedCaption}
        minPhotos={minPhotos}
        maxPhotos={minPhotos}
        photoFeedEnabled={feedEnabled}
        submissionStatus={existing.status}
        // 승인제 미션은 사진을 바꾸면 기관 확인을 다시 받는다.
        needsReviewAfterChange={mission.kind === "PHOTO_APPROVAL"}
        receivedLikes={existing.like_count ?? 0}
        likerNames={myLikers.map((l) => l.name)}
        // 끝난 행사 — 사진은 보되 바꾸지는 못한다.
        readOnly={!ctx.access.canPlay}
      />
    ) : null;

  // 제출 전이든 검토 중이든 승인된 뒤든 같은 자리에 있어야 하는 칸.
  const feedSection = feedEnabled ? (
    <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span aria-hidden>👨‍👩‍👧‍👦</span>
          다른 가족들의 사진
        </h2>
        {othersPhotos.length > 0 && (
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              likesLeft > 0
                ? "bg-rose-50 text-rose-600"
                : "bg-[#F5F1E8] text-[#8B7F75]"
            }`}
          >
            {likesLeft > 0
              ? `❤️ 좋아요 ${likesLeft}개 남음`
              : "❤️ 좋아요 다 썼어요"}
          </span>
        )}
      </div>
      {/* 이 미션 사진만 보이는 자리라, 행사 전체를 보려면 사진 화면으로 — 하단
          탭을 내린 뒤로 여기가 두 번째 입구다. */}
      <div className="mb-3">
        <Link
          href={ctx.href("/photos")}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2D5A3D] underline-offset-2 hover:underline"
        >
          📸 행사 전체 사진 보기 →
        </Link>
      </div>
      {othersPhotos.length > 0 && (
        <p className="mb-3 text-[11px] leading-relaxed text-[#8B7F75]">
          하트를 누르면 그 가족에게 도토리가 1개 전해져요. 한 미션에 
          {LIKES_PER_MISSION}개까지, 다시 누르면 취소돼요.
        </p>
      )}
      <PhotoGrid
        photos={othersPhotos}
        showMissionChip={false}
        eventId={eventId}
        viewerId={ctx.user.id}
        usedByMission={myLikeCounts}
        channelKey={`mission-${mission.id}`}
      />
    </section>
  ) : null;

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
    // 참가자 결과 화면 — 기술적 상태("자동 승인") 대신 친근한 문구로 표시.
    // 상태별 톤은 유지(완료/검토 대기/반려).
    const friendlyLabel =
      existing.status === "AUTO_APPROVED" || existing.status === "APPROVED"
        ? "완료하였습니다"
        : existing.status === "SUBMITTED" || existing.status === "PENDING_REVIEW"
          ? "제출 완료 · 검토 중"
          : existing.status === "REJECTED"
            ? "반려되었어요"
            : statusMeta.label;
    return (
      <div className="space-y-4">
        {header}

        <section
          className={`rounded-3xl border p-5 shadow-sm ${statusMeta.color}`}
        >
          <p className="text-4xl" aria-hidden>
            {statusMeta.icon}
          </p>
          <h2 className="mt-2 text-lg font-bold">{friendlyLabel}</h2>
          <p className="mt-1 text-xs">
            제출 시각: {formatDateTime(existing.submitted_at)}
          </p>
          {existing.awarded_acorns != null &&
            existing.awarded_acorns > 0 && (
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/60 px-3 py-1 text-sm font-bold">
                <AcornIcon size={18} /> +{existing.awarded_acorns} 도토리 획득
              </p>
            )}
          {existing.status === "REJECTED" && (
            <div className="mt-3 rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-3 text-left">
              <p className="text-sm font-bold text-amber-900">
                🔄 다시 한번 시도해 주세요
              </p>
              {existing.reject_reason && (
                <p className="mt-1.5 text-xs leading-relaxed text-amber-900/90">
                  💬 {existing.reject_reason}
                </p>
              )}
              <p className="mt-2 text-[11px] text-amber-800/80">
                미션 페이지로 돌아가 새로운 사진/내용으로 다시 제출할 수 있어요.
              </p>
            </div>
          )}
          {existing.status !== "REJECTED" && existing.reject_reason && (
            <p className="mt-3 rounded-2xl bg-white/60 px-3 py-2 text-xs">
              💬 {existing.reject_reason}
            </p>
          )}
        </section>

        {submittedPhotosSection}

        {feedSection}

        {backButton}
      </div>
    );
  }

  // 여기까지 왔다는 건 "아직 안 한 미션" 이라는 뜻이다(해낸 미션은 위에서
  // 결과 화면으로 끝났다). 끝난 행사에서는 이제 새로 할 수 없다.
  if (!ctx.access.canPlay) {
    return (
      <div className="space-y-4">
        {header}
        <section className="rounded-3xl border border-[#E8E4DE] bg-[#FAF8F5] p-6 text-center shadow-sm">
          <p className="text-5xl" aria-hidden>
            {ctx.access.badgeEmoji}
          </p>
          <h2 className="mt-3 text-base font-bold text-[#6B6560]">
            행사가 끝났어요
          </h2>
          <p className="mt-1 text-sm text-[#8B7F75]">
            이 미션은 더 이상 참여할 수 없어요.
          </p>
        </section>
        {backButton}
      </div>
    );
  }

  // Unlock check (FINAL_REWARD 외)
  if (mission.kind !== "FINAL_REWARD") {
    const allMissions = packId
      ? await safeQuery(
          "loadOrgMissionsByQuestPack",
          () => loadOrgMissionsByQuestPack(packId),
          [mission]
        )
      : [mission];
    const userSubmissions = await safeQuery(
      "loadUserSubmissions",
      () => loadUserSubmissions(user.id, { packId: packId ?? undefined }),
      []
    );
    const acornsInPack = packId
      ? await safeQuery(
          "sumAcornsForPack",
          () => sumAcornsForPack(user.id, packId),
          0
        )
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
          {backButton}
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
    runnerBody = (
      <PhotoRunner
        mission={mission}
        config={photoConfig}
        photoFeedEnabled={feedEnabled}
      />
    );
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
          {backButton}
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
        // payload 의 URL 은 이미 만료됐을 수 있다 — 재서명한 것을 넘긴다.
        // 사진 표시·다시 찍기·공개 안내는 아래 SubmittedPhotos 카드가 맡는다.
        existingUrls={submittedUrls}
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
    const live = await loadLiveBroadcastsForOrg(ctx.orgId);
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
            href={ctx.href("/broadcasts")}
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
      {submittedPhotosSection}
      {feedSection}
      {backButton}
      {/* 관제 telemetry — 화면에 보이지 않음. */}
      <MissionAttemptHeartbeat orgMissionId={mission.id} />
    </div>
  );
}
