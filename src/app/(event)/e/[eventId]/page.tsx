import Link from "next/link";

import { requireEventContext } from "@/lib/event-context";
import { loadAppUserById } from "@/lib/app-user/queries";
import {
  getEventAcornBalance,
  loadTopAcornFamiliesForEvent,
} from "@/lib/app-user/event-acorns";
import { loadChildrenForEvent } from "@/lib/app-user/event-children";
import { AcornTopBoard } from "@/components/acorn-top-board";
import { loadAcornGuide } from "@/lib/missions/acorn-guide-queries";
import { OnboardingWizard } from "./onboarding-wizard";
import {
  loadOrgMissionsByQuestPack,
  loadOrgQuestPacks,
  loadUserSubmissions,
  sumAcornsForPack,
} from "@/lib/missions/queries";
import { loadLiveQuestPacksForEvent } from "@/lib/org-events/queries";
import { computePackProgress } from "@/lib/missions/progress";
import type {
  OrgQuestPackRow,
  OrgMissionRow,
  MissionSubmissionRow,
} from "@/lib/missions/types";
import type { PackProgress } from "@/lib/missions/progress";
import { ToriFmCard } from "./tori-fm-card";
import { BroadcastCard } from "./broadcast-card";
import { NextUpCard } from "./next-up-card";
import { Suspense } from "react";
import { PhotoFeedCard } from "@/components/photo-feed/photo-feed-card";
import { SurveyCard } from "@/components/survey/survey-card";
import { BingoCard } from "./bingo-card";
import { loadTimelineSlots } from "@/lib/event-timeline/queries";
import { StampbookDetail } from "@/components/stampbook-detail";
import { AcornIcon } from "@/components/acorn-icon";
import { fmtAmPmClockKst, fmtFullDateKst } from "@/lib/datetime/kst";

export const dynamic = "force-dynamic";

/**
 * 행사에 연결된 LIVE 스탬프북들 중 대표 하나를 고름.
 * 미완료 pack 우선, 없으면 첫 번째.
 */
type PrimaryPack = {
  pack: OrgQuestPackRow;
  missions: OrgMissionRow[];
  submissions: MissionSubmissionRow[];
  userAcornsInPack: number;
  progress: PackProgress;
};

/**
 * 홈 화면 대표 스탬프북 선정.
 * 1순위: 현재 행사에 연결된 LIVE pack
 * 2순위: 행사 연결 없어도 org 의 LIVE pack (fallback)
 *   → 행사 미등록 상태여도 기본 온보딩/첫 미션을 체험할 수 있도록
 */
async function pickPrimaryLivePackForEvent(
  userId: string,
  orgId: string,
  eventId: string | null
): Promise<PrimaryPack | null> {
  let packs: OrgQuestPackRow[] = [];

  if (eventId) {
    packs = await loadLiveQuestPacksForEvent(eventId);
  }

  // Fallback: 행사 연결 pack 이 없으면 org 전체 LIVE pack
  if (packs.length === 0) {
    const orgPacks = await loadOrgQuestPacks(orgId);
    packs = orgPacks.filter((p) => p.status === "LIVE");
  }

  if (packs.length === 0) return null;

  const enriched = await Promise.all(
    packs.map(async (pack) => {
      const [missions, submissions, acorns] = await Promise.all([
        loadOrgMissionsByQuestPack(pack.id),
        loadUserSubmissions(userId, { packId: pack.id }),
        sumAcornsForPack(userId, pack.id),
      ]);
      return {
        pack,
        missions,
        submissions,
        userAcornsInPack: acorns,
        progress: computePackProgress(missions, submissions, acorns),
      };
    })
  );

  const incomplete = enriched.find((e) => !e.progress.isComplete);
  return incomplete ?? enriched[0] ?? null;
}

// KST 강제 포맷 사용 — SSR/CSR 일치.
const fmtFullDate = (iso: string | null) => (iso ? fmtFullDateKst(iso) : "");
const fmtClock = (iso: string | null) => fmtAmPmClockKst(iso);

export default async function EventHomePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  // 컨텍스트는 URL 이 100% 결정한다 — 세션의 활성 기관을 읽지 않는다.
  const ctx = await requireEventContext(eventId);
  const user = ctx.user;
  const selectedEvent = ctx.event;
  const ctxOrgId = ctx.orgId;

  // 여기 있는 것들은 서로를 필요로 하지 않는다 — ctx 만 있으면 된다.
  //
  // 예전에는 네 덩어리로 줄줄이 await 했다. 각 덩어리가 Supabase 왕복을 몇 번씩
  // 하므로, 앞 덩어리가 끝날 때까지 뒤가 시작도 못 한 채 기다렸다. 이 화면은
  // 보호자가 행사장에서 제일 먼저 여는 화면이라 그 지연이 그대로 체감된다.
  // 한 번에 띄우면 가장 오래 걸리는 하나만큼만 기다린다.
  //
  // 스탬프북 조회(pickPrimaryLivePackForEvent)와 도토리 안내(loadAcornGuide)는
  // 같은 팩 목록을 본다 — React cache 로 묶여 있어 두 번 나가지 않는다.
  const [
    acornBalance,
    children,
    userDetail,
    topFamilies,
    acornGuide,
    primaryPack,
    timelineSlots,
  ] = await Promise.all([
    getEventAcornBalance(user.id, eventId),
    loadChildrenForEvent(user.id, eventId),
    loadAppUserById(user.id),
    loadTopAcornFamiliesForEvent(eventId, 5),
    loadAcornGuide(eventId),
    pickPrimaryLivePackForEvent(user.id, ctxOrgId, selectedEvent.id),
    loadTimelineSlots(selectedEvent.id).catch(() => []),
  ]);

  const freshOrgName = ctx.orgName;

  // 원생 자녀가 있으면 "{원생이름} 가족" 으로 가족 라벨 표기,
  // 없으면 기존 "{부모이름}님" 유지.
  const enrolledChildren = children.filter((c) => c.is_enrolled);
  const familyLabel =
    enrolledChildren.length > 0
      ? `${enrolledChildren.map((c) => c.name).join("·")} 가족`
      : `${user.parentName || "보호자"}님`;

  // 선택된 행사가 DRAFT(예정) 상태면 — 참가자 포털은 초대장만 노출.
  // 스탬프북·미션·FM·온보딩 등은 행사가 LIVE 가 된 뒤에 활성화됨.
  if (selectedEvent.status === "DRAFT") {
    return (
      <div className="space-y-4">
        {/* 온보딩 위저드 — 최상단 노출(미완 시 배너). 행사 시작 전에도 프로필을 미리 채울 수 있도록. */}
        <OnboardingWizard
          userId={user.id}
          initialParentName={userDetail?.parent_name ?? user.parentName}
          initialChildren={children.map((c) => ({
            id: c.id,
            name: c.name,
            birth_date: c.birth_date,
            gender: c.gender,
          }))}
          initialRewarded={userDetail?.onboarding_rewarded ?? false}
          initialBonusCount={userDetail?.onboarding_bonus_count ?? 0}
        />

        {/* 가족 헤더 */}
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#D4E4BC]">
                🌲 {freshOrgName}
              </p>
              <h1 className="mt-1 truncate text-xl font-bold text-white">
                {familyLabel}
              </h1>
            </div>
            <Link
              href="/profile"
              className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/25"
            >
              내 정보 →
            </Link>
          </div>
        </section>

        {/* 초대장 카드 — 메인 CTA */}
        <section className="space-y-4 rounded-3xl border-2 border-[#E5D3B8] bg-gradient-to-br from-[#FFFDF8] to-[#FFF8F0] p-6 shadow-sm text-center">
          <div className="text-5xl" aria-hidden>
            💌
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8B6F47]">
              곧 만나요
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#2D5A3D] md:text-xl">
              {selectedEvent.name || "(이름 없음)"}
            </h2>
          </div>

          {/* 일정·시간·장소 정보 */}
          <ul className="space-y-2 rounded-xl bg-white/70 px-4 py-3 text-left text-sm text-[#2D5A3D]">
            {selectedEvent.starts_at && (
              <li className="flex items-start gap-2">
                <span className="shrink-0" aria-hidden>
                  📅
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">
                    {fmtFullDate(selectedEvent.starts_at)}
                  </span>
                  {(() => {
                    const startClock = fmtClock(selectedEvent.starts_at);
                    const endClock = fmtClock(selectedEvent.ends_at);
                    if (!startClock && !endClock) return null;
                    return (
                      <span className="ml-1 text-[#6B6560]">
                        {startClock}
                        {endClock ? ` ~ ${endClock}` : ""}
                      </span>
                    );
                  })()}
                </div>
              </li>
            )}
            {(selectedEvent.invitation_location ||
              selectedEvent.invitation_address) && (
              <li className="flex items-start gap-2">
                <span className="shrink-0" aria-hidden>
                  📍
                </span>
                <div className="min-w-0 flex-1">
                  {selectedEvent.invitation_location && (
                    <p className="font-semibold">
                      {selectedEvent.invitation_location}
                    </p>
                  )}
                  {selectedEvent.invitation_address && (
                    <p className="text-xs text-[#6B6560]">
                      {selectedEvent.invitation_address}
                    </p>
                  )}
                </div>
              </li>
            )}
          </ul>

          <p className="rounded-xl bg-amber-50/80 px-4 py-2.5 text-[11px] text-amber-900">
            행사가 시작되면 스탬프북·미션·라이브 방송이 활성화돼요. 그 전까지는
            초대장으로 행사 정보를 확인하세요.
          </p>

          <Link
            href={`/invitation/${selectedEvent.id}`}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#6B4423] to-[#8B6F47] px-6 py-3 text-base font-bold text-white shadow-md transition hover:from-[#5a3a1e] hover:to-[#6B4423]"
          >
            <span aria-hidden>💌</span>
            <span>초대장 자세히 보기</span>
            <span aria-hidden>→</span>
          </Link>
        </section>
      </div>
    );
  }

  // 끝난 행사 — "추억" 화면.
  //
  // 예전에는 이 자리가 그냥 LIVE 화면이었다. 스탬프북·다음 미션·라디오 카드가
  // 그대로 떠 있었고, 눌러 보면 활동 화면이 조용히 여기로 돌려보냈다.
  // 눌리는데 아무 일도 안 일어나는 화면은 고장 난 화면이다.
  //
  // 끝난 뒤에 남는 건 셋이다 — 그날 찍은 사진, 우리가 모은 도토리, 하고 싶은
  // 말(설문). 그 셋만 남긴다. 잠겼다는 안내는 레이아웃이 이미 하고 있어
  // 여기서 또 말하지 않는다.
  if (!ctx.access.canPlay) {
    const stamps = primaryPack?.progress.completedSlots ?? 0;
    return (
      <div className="space-y-4">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#6B6560] via-[#7D766E] to-[#8B7F75] p-5 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white/80">
                🌲 {freshOrgName}
              </p>
              <h1 className="mt-1 truncate text-xl font-bold text-white">
                {familyLabel}
              </h1>
              <p className="mt-1 truncate text-[11px] text-white/70">
                {selectedEvent.name}
              </p>
            </div>
            <Link
              href="/profile"
              className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/25"
            >
              내 정보 →
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat
              label="모은 도토리"
              value={`${acornBalance}`}
              icon={<AcornIcon size={20} />}
            />
            <MiniStat label="찍은 스탬프" value={`${stamps}`} icon="🌿" />
            <MiniStat
              label="함께한 자녀"
              value={`${children.length}`}
              icon="🪴"
            />
          </div>
        </section>

        {/* 📝 설문 — 끝난 뒤가 진짜 자리다. 사진보다 위에 둔다. */}
        <Suspense fallback={null}>
          <SurveyCard
            eventId={selectedEvent.id}
            userId={user.id}
            surveyEnabled={
              (selectedEvent as unknown as { survey_enabled?: boolean })
                .survey_enabled === true
            }
            eventStatus={selectedEvent.status}
            endsAt={selectedEvent.ends_at}
            openLeadMin={
              (
                selectedEvent as unknown as {
                  survey_open_lead_min?: number | null;
                }
              ).survey_open_lead_min
            }
          />
        </Suspense>

        {/* 📸 그날의 사진 */}
        <Suspense fallback={null}>
          <PhotoFeedCard eventId={selectedEvent.id} viewerId={user.id} />
        </Suspense>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={ctx.href("/stampbook")}
            className="rounded-2xl border border-[#E5D3B8] bg-white px-4 py-3 text-center text-xs font-bold text-[#6B6560] shadow-sm transition hover:shadow-md"
          >
            🌿 스탬프북 다시 보기
          </Link>
          <Link
            href={ctx.href("/acorns")}
            className="rounded-2xl border border-[#E5D3B8] bg-white px-4 py-3 text-center text-xs font-bold text-[#6B6560] shadow-sm transition hover:shadow-md"
          >
            🌰 도토리 기록
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 📝 설문 — 최상단이다.
          이 카드는 행사가 끝나기 30분 전에야 나타난다. 그때 화면에서 제일
          중요한 건 이것 하나다 — 집에 가고 나면 아무도 안 연다. */}
      <Suspense fallback={null}>
        <SurveyCard
          eventId={selectedEvent.id}
          userId={user.id}
          surveyEnabled={
            (selectedEvent as unknown as { survey_enabled?: boolean })
              .survey_enabled === true
          }
          eventStatus={selectedEvent.status}
          endsAt={selectedEvent.ends_at}
          openLeadMin={
            (selectedEvent as unknown as { survey_open_lead_min?: number | null })
              .survey_open_lead_min
          }
        />
      </Suspense>

      {/* 도토리 TOP 5 가족 — 본인 행 강조 */}
      <AcornTopBoard
        families={topFamilies}
        myUserId={user.id}
        orgName={freshOrgName}
        guide={acornGuide}
      />

      {/* 온보딩 위저드 — 최상단 노출(미완 시 배너). 첫 입장 시 자동 오픈, 미완 시 상단 배너 유지. */}
      <OnboardingWizard
        userId={user.id}
        initialParentName={userDetail?.parent_name ?? user.parentName}
        initialChildren={children.map((c) => ({
          id: c.id,
          name: c.name,
          birth_date: c.birth_date,
          gender: c.gender,
        }))}
        initialRewarded={userDetail?.onboarding_rewarded ?? false}
        initialBonusCount={userDetail?.onboarding_bonus_count ?? 0}
      />

      {primaryPack ? (
        /* Hero + 진행 중 스탬프북 — 한 카드로 통합 */
        <StampbookDetail
          base={ctx.href()}
          pack={primaryPack.pack}
          missions={primaryPack.missions}
          submissions={primaryPack.submissions}
          userAcornsInPack={primaryPack.userAcornsInPack}
          progress={primaryPack.progress}
          familyHeader={{
            orgName: freshOrgName,
            familyLabel,
            profileHref: "/profile",
            acornBalance,
            childrenCount: children.length,
          }}
        />
      ) : (
        /* primaryPack 미존재 — Hero 만 단독 표시 (스탬프 자리에는 "곧 오픈") */
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#D4E4BC]">
                🌲 {freshOrgName}
              </p>
              <h1 className="mt-1 truncate text-xl font-bold text-white">
                {familyLabel}
              </h1>
            </div>
            <Link
              href="/profile"
              className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/25"
            >
              내 정보 →
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat
              label="도토리"
              value={`${acornBalance}`}
              icon={<AcornIcon size={20} />}
            />
            <MiniStat label="자녀" value={`${children.length}`} icon="🪴" />
            <MiniStat label="스탬프" value="-" icon="🌿" hint="곧 오픈" />
          </div>
        </section>
      )}

      {/* 오늘의 일정 — 진행 중 + 다음 슬롯 압축 미리보기 */}
      {timelineSlots.length > 0 && (
        <NextUpCard
          eventName={selectedEvent.name}
          eventStartsAt={selectedEvent.starts_at}
          slots={timelineSlots}
        />
      )}

      {/* 돌발 미션 — 시간 임계이므로 FM 보다 위 */}
      <Suspense fallback={null}>
        <BroadcastCard orgId={ctxOrgId} />
      </Suspense>

      {/* 🎯 토리 빙고 — LIVE 보드 있을 때만 자동 노출. 사진 등록 진입 카드 역할. */}
      <Suspense fallback={null}>
        <BingoCard orgId={ctxOrgId} userId={user.id} />
      </Suspense>

      {/* 📸 사진 피드 입구 — 하단 탭에서 내리고 이 카드가 그 자리를 대신한다.
          기관이 켜고 사진이 한 장이라도 있을 때만 나타난다.

          Suspense 로 감싸는 이유: 이 카드는 사진 3장을 고르려고 스탬프북·미션·
          제출물을 훑는다. 행사홈에서 제일 먼저 보고 싶은 건 스탬프 진행도지
          사진 카드가 아닌데, 감싸지 않으면 이 조회가 끝날 때까지 화면 전체가
          비어 있게 된다. 늦게 오는 것은 늦게 채우면 된다. */}
      <Suspense fallback={null}>
        <PhotoFeedCard eventId={selectedEvent.id} viewerId={user.id} />
      </Suspense>

      {/* 토리FM 라이브 (선택된 행사의 LIVE 세션만, 행사 없으면 org fallback) */}
      <Suspense fallback={null}>
      <ToriFmCard orgId={ctxOrgId} eventId={selectedEvent.id} />
      </Suspense>

      {/* 스탬프북 없음 안내 (primaryPack 있을 땐 위 상단 디테일 뷰에서 이미 렌더됨) */}
      {!primaryPack && (
        <section className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/70 p-6 text-center shadow-sm">
          <p className="text-3xl" aria-hidden>
            🌱
          </p>
          <p className="mt-2 text-sm font-bold text-[#2D5A3D]">
            이 행사에 연결된 스탬프북이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            곧 새로운 모험이 열릴거예요!
          </p>
        </section>
      )}

    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/15 p-2.5 text-center backdrop-blur-sm">
      <p className="text-lg" aria-hidden>
        {icon}
      </p>
      <p className="mt-0.5 text-base font-bold text-white tabular-nums">
        {value}
      </p>
      <p className="text-[10px] font-semibold text-[#D4E4BC]">
        {hint ? hint : label}
      </p>
    </div>
  );
}
