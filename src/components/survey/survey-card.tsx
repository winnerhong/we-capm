// 행사홈의 설문 입구 — 열린 행사에서만 나타난다.
//
// 링크만 보내면 단톡방에서 묻힌다. 행사홈에 카드로 두면 앱을 여는 사람은 반드시
// 지나간다. 이미 답한 사람에게는 "고치기" 로 바뀐다 — 같은 자리에 같은 카드가
// 남아 있어야 "내가 답했었나?" 를 헷갈리지 않는다.
//
// 아직 안 답한 사람에게 이 카드는 행사홈 **맨 위**에 온다. 열리는 시점이 이미
// "행사 마무리 30분 전" 이라, 그때 화면에서 제일 중요한 건 이것 하나다.

import Link from "next/link";
import { eventHref } from "@/lib/event-context";
import { resolveSurveyGate } from "@/lib/org-events/survey-core";
import { loadMySurveyResponse } from "@/lib/org-events/survey-queries";

export async function SurveyCard({
  eventId,
  userId,
  surveyEnabled,
  eventStatus,
  endsAt,
  openLeadMin,
}: {
  eventId: string;
  userId: string;
  surveyEnabled: boolean;
  eventStatus: string;
  /** 행사 종료 시각 — 자동 개방의 기준. */
  endsAt: string | null;
  /** 종료 몇 분 전부터 열지. undefined 는 컬럼 미적용(기본 30분). */
  openLeadMin?: number | null;
}) {
  if (!eventId || !surveyEnabled) return null;

  const mine = await loadMySurveyResponse(eventId, userId).catch(() => null);
  const gate = resolveSurveyGate({
    surveyEnabled,
    eventStatus,
    alreadyAnswered: !!mine,
    endsAt,
    openLeadMin,
  });
  if (!gate.canAnswer) return null;

  const answered = gate.alreadyAnswered;

  return (
    <Link
      href={eventHref(eventId, "/survey")}
      className={`block rounded-3xl border p-4 shadow-sm transition hover:shadow-md ${
        answered
          ? "border-[#D4E4BC] bg-white"
          : "border-amber-300 bg-gradient-to-br from-amber-50 via-white to-[#FFF8F0]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          📝
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#2D5A3D]">
            {answered ? "설문에 답해주셨어요" : "곧 마무리해요 — 오늘 어떠셨나요?"}
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B6560]">
            {answered
              ? "눌러서 고칠 수 있어요"
              : "별점 하나만 눌러도 돼요 · 30초"}
          </p>
        </div>
        <span aria-hidden className="text-[#D4C8B8]">
          ›
        </span>
      </div>
    </Link>
  );
}
