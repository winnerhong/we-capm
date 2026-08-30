// 행사 설문 — 참가자가 답하는 화면.
//
// 문항은 셋뿐이다(별점 · 가장 좋았던 미션 · 한 줄). 행사장에서 아이 손 잡고
// 폰으로 답하는 사람이라, 넷째 문항부터는 아무도 끝까지 안 한다.
//
// 이미 낸 사람에게도 같은 화면을 보여주고 값만 채워둔다 — "고칠 수 있다" 가
// "다시 낼 수 없다" 보다 언제나 낫다.

import Link from "next/link";
import { requireEventContext } from "@/lib/event-context";
import { EventLocked } from "@/components/event-locked";
import { F } from "@/lib/features/codes";
import { resolveSurveyGate } from "@/lib/org-events/survey-core";
import { loadMySurveyResponse } from "@/lib/org-events/survey-queries";
import {
  isPhotoFeedEnabled,
  loadEventMissions,
  loadEventOrgId,
} from "@/lib/missions/photo-feed-queries";
import { SurveyForm } from "./survey-form";

export const dynamic = "force-dynamic";

export default async function EventSurveyPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ctx = await requireEventContext(eventId);

  // 기관이 안 쓰는 기능. 메뉴·탭에서는 이미 빠져 있지만 북마크·옛 링크로
  // 직접 들어올 수 있다 — 빈 화면 대신 사실을 말하고 돌려보낸다.
  if (!ctx.hasFeature(F.SURVEY)) {
    return (
      <EventLocked
        icon="📝"
        title="설문"
        notice="이 행사에서는 사용하지 않는 기능이에요"
        homeHref={ctx.href()}
      />
    );
  }

  const surveyEnabled =
    (ctx.event as unknown as { survey_enabled?: boolean }).survey_enabled ===
    true;

  const mine = surveyEnabled
    ? await loadMySurveyResponse(eventId, ctx.user.id).catch(() => null)
    : null;

  const gate = resolveSurveyGate({
    surveyEnabled,
    eventStatus: ctx.event.status,
    alreadyAnswered: !!mine,
    endsAt: ctx.event.ends_at,
    openLeadMin: (
      ctx.event as unknown as { survey_open_lead_min?: number | null }
    ).survey_open_lead_min,
  });

  if (!gate.canAnswer) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <section className="rounded-3xl border border-[#D4E4BC] bg-white p-6 text-center shadow-sm">
          <p className="text-4xl" aria-hidden>
            📝
          </p>
          <h1 className="mt-3 text-lg font-bold text-[#2D5A3D]">
            {gate.reason}
          </h1>
          <Link
            href={ctx.href()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-[#2D5A3D] px-5 py-2.5 text-sm font-bold text-white"
          >
            🎪 행사홈으로
          </Link>
        </section>
      </div>
    );
  }

  // "가장 좋았던 미션" 후보 — 이 행사 스탬프북의 미션들.
  const orgId = await loadEventOrgId(eventId);
  const missions = await loadEventMissions(eventId, orgId).catch(() => []);
  // 최종 보상은 미션이 아니라 결과물이라 고를 대상이 아니다.
  const choices = missions
    .filter((m) => m.kind !== "FINAL_REWARD")
    .map((m) => ({ id: m.id, title: m.title, icon: m.icon }));

  // 사진 피드를 쓴 행사면 "사진" 도 좋았던 것으로 꼽힐 수 있다 — 안내만 한 줄.
  const photoFeed = await isPhotoFeedEnabled(eventId).catch(() => false);

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-4">
      <header className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold text-[#2D5A3D]">
          <span aria-hidden className="mr-1.5">
            📝
          </span>
          오늘 어떠셨나요?
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-[#6B6560]">
          {ctx.event.name} · 30초면 끝나요
          {photoFeed && " · 남겨주신 의견은 다음 행사에 반영돼요"}
        </p>
      </header>

      <SurveyForm
        eventId={eventId}
        homeHref={ctx.href()}
        missions={choices}
        initial={
          mine
            ? {
                rating: mine.rating,
                bestMissionId: mine.bestMissionId,
                comment: mine.comment ?? "",
              }
            : null
        }
      />
    </div>
  );
}
