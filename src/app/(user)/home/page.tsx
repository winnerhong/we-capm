import Link from "next/link";

import { requireAppUser } from "@/lib/user-auth-guard";
import {
  getAcornBalance,
  loadAppUserById,
  loadChildrenForUser,
  loadTopAcornFamilies,
} from "@/lib/app-user/queries";
import { AcornTopBoard } from "@/components/acorn-top-board";
import { OnboardingWizard } from "./onboarding-wizard";
import {
  loadOrgMissionsByQuestPack,
  loadOrgQuestPacks,
  loadUserSubmissions,
  sumAcornsForPack,
} from "@/lib/missions/queries";
import {
  loadActiveAndUpcomingEventsForUser,
  loadLiveQuestPacksForEvent,
} from "@/lib/org-events/queries";
import { computePackProgress } from "@/lib/missions/progress";
import type {
  OrgQuestPackRow,
  OrgMissionRow,
  MissionSubmissionRow,
} from "@/lib/missions/types";
import type { OrgEventRow } from "@/lib/org-events/types";
import type { PackProgress } from "@/lib/missions/progress";
import { ToriFmCard } from "./tori-fm-card";
import { BroadcastCard } from "./broadcast-card";
import { EventSelector } from "./event-selector";
import { NextUpCard } from "./next-up-card";
import { BingoCard } from "./bingo-card";
import { loadTimelineSlots } from "@/lib/event-timeline/queries";
import { loadOrgNameById } from "@/lib/org-partner";
import { listUserOrgs } from "@/lib/app-user/orgs";
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

export default async function UserHomePage({
  searchParams,
}: {
  searchParams: Promise<{ event_id?: string }>;
}) {
  const user = await requireAppUser();
  const sp = await searchParams;
  const urlEventId = sp.event_id;

  const [acornBalance, children, activeEvents, userDetail] = await Promise.all([
    getAcornBalance(user.id),
    loadChildrenForUser(user.id),
    loadActiveAndUpcomingEventsForUser(user.id),
    loadAppUserById(user.id),
  ]);

  // 선택 규칙 — 행사가 곧 컨텍스트.
  //   1) URL ?event_id= (미들웨어가 이미 활성 기관을 여기 맞춰 놨다)
  //   2) 활성 기관의 LIVE 행사
  //   3) 활성 기관의 아무 행사
  //   4) 그래도 없으면 아무 LIVE → 아무 행사
  //
  //   2·3 이 중요하다. 예전에는 기관을 안 보고 LIVE 행사부터 골라서,
  //   두 기관에 다니는 보호자가 `?event_id=` 없이 /home 에 들어오면
  //   "헤더는 A기관, 선택된 행사는 B기관" 으로 어긋났다.
  const inActiveOrg = activeEvents.filter((e) => e.org_id === user.orgId);
  const selectedEvent: OrgEventRow | null =
    (urlEventId && activeEvents.find((e) => e.id === urlEventId)) ||
    inActiveOrg.find((e) => e.status === "LIVE") ||
    inActiveOrg[0] ||
    activeEvents.find((e) => e.status === "LIVE") ||
    activeEvents[0] ||
    null;

  // 기관 종속 정보는 세션이 아니라 **선택된 행사**에서 끌어온다.
  //   화면에 보이는 행사와 기관명·랭킹·방송이 언제나 같은 기관이 되도록.
  const ctxOrgId = selectedEvent?.org_id ?? user.orgId;

  const [freshOrgName, topFamilies] = await Promise.all([
    loadOrgNameById(
      ctxOrgId,
      ctxOrgId === user.orgId ? user.orgName || "소속 기관" : "소속 기관"
    ),
    loadTopAcornFamilies(ctxOrgId, 5),
  ]);

  // 행사가 두 기관 이상에 걸쳐 있으면 선택기 라벨에 기관명을 붙인다.
  //   (두 기관에 다니는 보호자에겐 행사 선택기가 곧 기관 스위처)
  const spansMultipleOrgs =
    new Set(activeEvents.map((e) => e.org_id)).size > 1;
  const orgNames: Record<string, string> = {};
  if (spansMultipleOrgs) {
    for (const o of await listUserOrgs(user.id)) {
      orgNames[o.orgId] = o.orgName;
    }
  }

  const primaryPack = await pickPrimaryLivePackForEvent(
    user.id,
    ctxOrgId,
    selectedEvent?.id ?? null
  );

  // 선택된 행사의 타임라인 슬롯 — 홈 "오늘의 일정" 카드용
  const timelineSlots = selectedEvent
    ? await loadTimelineSlots(selectedEvent.id)
    : [];

  // 원생 자녀가 있으면 "{원생이름} 가족" 으로 가족 라벨 표기,
  // 없으면 기존 "{부모이름}님" 유지.
  const enrolledChildren = children.filter((c) => c.is_enrolled);
  const familyLabel =
    enrolledChildren.length > 0
      ? `${enrolledChildren.map((c) => c.name).join("·")} 가족`
      : `${user.parentName || "보호자"}님`;

  // 선택된 행사가 DRAFT(예정) 상태면 — 참가자 포털은 초대장만 노출.
  // 스탬프북·미션·FM·온보딩 등은 행사가 LIVE 가 된 뒤에 활성화됨.
  if (selectedEvent && selectedEvent.status === "DRAFT") {
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

        {/* 다른 진행 중 행사가 있으면 선택 가능 */}
        {activeEvents.length > 1 && (
          <EventSelector
            events={activeEvents}
            selectedId={selectedEvent.id}
            orgNames={orgNames}
          />
        )}

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

  return (
    <div className="space-y-4">
      {/* 도토리 TOP 5 가족 — 최상단 노출, 본인 행 강조 */}
      <AcornTopBoard
        families={topFamilies}
        myUserId={user.id}
        orgName={freshOrgName}
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

      {/* 행사 배너 / 선택기 — 0개면 안내, 2개 이상이면 선택기. 1개면 숨김. */}
      {activeEvents.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white/70 p-4 text-center shadow-sm">
          <p className="text-sm font-bold text-[#2D5A3D]">
            🌱 아직 참여 중인 행사가 없어요
          </p>
          <p className="mt-1 text-[11px] text-[#6B6560]">
            담당자에게 문의해 주세요
          </p>
        </section>
      ) : activeEvents.length >= 2 && selectedEvent ? (
        <EventSelector
          events={activeEvents}
          selectedId={selectedEvent.id}
          orgNames={orgNames}
        />
      ) : null}

      {/* 오늘의 일정 — 진행 중 + 다음 슬롯 압축 미리보기 */}
      {selectedEvent && timelineSlots.length > 0 && (
        <NextUpCard
          eventName={selectedEvent.name}
          eventStartsAt={selectedEvent.starts_at}
          slots={timelineSlots}
        />
      )}

      {/* 돌발 미션 — 시간 임계이므로 FM 보다 위 */}
      <BroadcastCard orgId={ctxOrgId} />

      {/* 🎯 토리 빙고 — LIVE 보드 있을 때만 자동 노출. 사진 등록 진입 카드 역할. */}
      <BingoCard orgId={ctxOrgId} userId={user.id} />

      {/* 토리FM 라이브 (선택된 행사의 LIVE 세션만, 행사 없으면 org fallback) */}
      <ToriFmCard
        orgId={ctxOrgId}
        eventId={selectedEvent?.id ?? null}
      />

      {/* 스탬프북 없음 안내 (primaryPack 있을 땐 위 상단 디테일 뷰에서 이미 렌더됨) */}
      {!primaryPack && activeEvents.length > 0 && (
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
