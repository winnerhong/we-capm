import Link from "next/link";
import { requireAppUser } from "@/lib/user-auth-guard";
import {
  getAcornBalance,
  loadAppUserById,
  loadChildrenForUser,
} from "@/lib/app-user/queries";
import { OnboardingWizard } from "./onboarding-wizard";
import {
  loadOrgMissionsByQuestPack,
  loadOrgQuestPacks,
  loadUserSubmissions,
  sumAcornsForPack,
} from "@/lib/missions/queries";
import {
  loadActiveEventsForUser,
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
import { loadTimelineSlots } from "@/lib/event-timeline/queries";
import { StampbookDetail } from "@/components/stampbook-detail";
import { AcornIcon } from "@/components/acorn-icon";

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

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "";
  }
}

type Tier = {
  key: "sprout" | "bush" | "sapling" | "tree" | "forest";
  name: string;
  icon: string;
  min: number;
  max: number;
};

const TIERS: Tier[] = [
  { key: "sprout", name: "새싹", icon: "🌱", min: 0, max: 9 },
  { key: "bush", name: "덤불", icon: "🌿", min: 10, max: 49 },
  { key: "sapling", name: "묘목", icon: "🪴", min: 50, max: 99 },
  { key: "tree", name: "나무", icon: "🌳", min: 100, max: 499 },
  { key: "forest", name: "숲", icon: "🌲", min: 500, max: Number.POSITIVE_INFINITY },
];

function currentTier(balance: number): Tier {
  return (
    TIERS.find((t) => balance >= t.min && balance <= t.max) ?? TIERS[0]
  );
}

function nextTier(current: Tier): Tier | null {
  const idx = TIERS.findIndex((t) => t.key === current.key);
  return idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

export default async function UserHomePage({
  searchParams,
}: {
  searchParams: Promise<{ event_id?: string }>;
}) {
  const user = await requireAppUser();
  const sp = await searchParams;
  const urlEventId = sp.event_id;

  const [acornBalance, children, activeEvents, userDetail] = await Promise.all(
    [
      getAcornBalance(user.id),
      loadChildrenForUser(user.id),
      loadActiveEventsForUser(user.id),
      loadAppUserById(user.id),
    ]
  );

  // 선택 규칙:
  //   - URL ?event_id= 가 activeEvents 에 있으면 그걸 사용
  //   - 아니면 최신 created_at DESC 첫 번째 자동 선택
  //   - activeEvents 비면 null
  const selectedEvent: OrgEventRow | null =
    (urlEventId && activeEvents.find((e) => e.id === urlEventId)) ||
    activeEvents[0] ||
    null;

  const primaryPack = await pickPrimaryLivePackForEvent(
    user.id,
    user.orgId,
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

  const tier = currentTier(acornBalance);
  const next = nextTier(tier);
  const nextLabel = next ? next.name : tier.name;
  const nextIcon = next ? next.icon : tier.icon;
  const remaining = next ? Math.max(0, next.min - acornBalance) : 0;
  const progressPct = next
    ? Math.min(
        100,
        Math.max(
          0,
          ((acornBalance - tier.min) / (next.min - tier.min)) * 100
        )
      )
    : 100;

  return (
    <div className="space-y-4">
      {primaryPack ? (
        /* Hero + 진행 중 스탬프북 — 한 카드로 통합 */
        <StampbookDetail
          pack={primaryPack.pack}
          missions={primaryPack.missions}
          submissions={primaryPack.submissions}
          userAcornsInPack={primaryPack.userAcornsInPack}
          progress={primaryPack.progress}
          familyHeader={{
            orgName: user.orgName || "소속 기관",
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
                🌲 {user.orgName || "소속 기관"}
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

      {/* 행사 배너 / 선택기 */}
      {activeEvents.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white/70 p-4 text-center shadow-sm">
          <p className="text-sm font-bold text-[#2D5A3D]">
            🌱 아직 참여 중인 행사가 없어요
          </p>
          <p className="mt-1 text-[11px] text-[#6B6560]">
            담당자에게 문의해 주세요
          </p>
        </section>
      ) : activeEvents.length === 1 && selectedEvent ? (
        <section className="rounded-2xl border border-[#D4E4BC] bg-white/80 px-4 py-2.5 shadow-sm">
          <p className="text-[11px] font-semibold text-[#6B6560]">
            🎪 현재 행사
          </p>
          <p className="mt-0.5 text-sm font-bold text-[#2D5A3D]">
            {selectedEvent.name}
          </p>
          {(selectedEvent.starts_at || selectedEvent.ends_at) && (
            <p className="text-[11px] text-[#8B7F75]">
              {fmtDate(selectedEvent.starts_at)} ~ {fmtDate(selectedEvent.ends_at)}
            </p>
          )}
        </section>
      ) : selectedEvent ? (
        <EventSelector events={activeEvents} selectedId={selectedEvent.id} />
      ) : null}

      {/* 오늘의 일정 — 진행 중 + 다음 슬롯 압축 미리보기 */}
      {selectedEvent && timelineSlots.length > 0 && (
        <NextUpCard eventName={selectedEvent.name} slots={timelineSlots} />
      )}

      {/* 온보딩 위저드 — 첫 입장 시 자동 오픈, 미완 시 상단 배너 유지 */}
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

      {/* 돌발 미션 — 시간 임계이므로 FM 보다 위 */}
      <BroadcastCard orgId={user.orgId} />

      {/* 토리FM 라이브 (선택된 행사의 LIVE 세션만, 행사 없으면 org fallback) */}
      <ToriFmCard
        orgId={user.orgId}
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

      {/* 오늘의 숲길 */}
      <Link
        href="/stamps"
        className="block overflow-hidden rounded-3xl bg-gradient-to-br from-[#FAE7D0] to-[#C4956A] p-5 shadow-sm transition hover:shadow-md active:scale-[0.995]"
      >
        <p className="text-xs font-bold uppercase tracking-wide text-[#6B4423]/80">
          오늘의 숲길
        </p>
        <h2 className="mt-1 text-lg font-bold text-[#6B4423]">
          🌄 숲에서의 하루가 마무리됐어요
        </h2>
        <p className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#6B4423]">
          오늘의 걸음 돌아보기 <span aria-hidden>→</span>
        </p>
      </Link>

      {/* 나의 나무 */}
      <section className="space-y-3 rounded-3xl border border-[#D4E4BC] bg-[#E8F0E4] p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#6B6560]">나의 나무</p>
            <p className="mt-1 flex items-center gap-1.5 text-xl font-bold text-[#2D5A3D]">
              <span aria-hidden>{tier.icon}</span>
              <span>{tier.name}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-[#2D5A3D]">
              {acornBalance}{" "}
              <AcornIcon size={20} />
            </p>
            <p className="text-[11px] text-[#6B6560]">도토리</p>
          </div>
        </div>

        {/* Progress bar */}
        <div
          className="h-3 w-full overflow-hidden rounded-full bg-white/80"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPct)}
          aria-label={`다음 단계 ${nextLabel}까지 진행도`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#3A7A52] to-[#4A7C59] transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs font-semibold text-[#2D5A3D]">
          <span aria-hidden>{nextIcon}</span> {nextLabel}까지{" "}
          <span className="tabular-nums">{remaining}</span>
          <AcornIcon />
        </p>

        {/* Tier strip */}
        <ul className="flex items-center justify-between pt-1">
          {TIERS.map((t) => {
            const active = t.key === tier.key;
            return (
              <li
                key={t.key}
                className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-1.5 ${
                  active
                    ? "bg-white text-[#2D5A3D] shadow-sm ring-2 ring-[#3A7A52]/40"
                    : "text-[#8B7F75]"
                }`}
                aria-current={active ? "step" : undefined}
              >
                <span className="text-xl" aria-hidden>
                  {t.icon}
                </span>
                <span className="text-[10px] font-semibold">{t.name}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 진행 중 스탬프 placeholder */}
      <section className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/60 p-5 text-center">
        <p className="text-sm font-bold text-[#2D5A3D]">
          🤖 토리가 추천하는 숲길{" "}
          <span className="inline-block rounded-md bg-[#FAE7D0] px-1.5 py-0.5 text-[10px] font-bold text-[#6B4423]">
            준비 중
          </span>
        </p>
        <p className="mt-1.5 text-xs text-[#6B6560]">
          당신에게 딱 맞는 숲길을 찾는 중…
        </p>
      </section>
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
