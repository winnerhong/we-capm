// 설문 결과 집계 — 순수 로직(DB 접근 없음).
//
// 왜 평균만으로는 부족한가:
//   평균 4.3 은 "다들 4점쯤 줬다" 로도, "대부분 5점인데 1점이 셋 섞였다" 로도
//   나온다. 뒤쪽이 훨씬 중요한 신호인데 평균이 그걸 지운다. 분포를 같이 낸다.
//
//   응답 수도 마찬가지다. 38명이 많은 건지 적은 건지는 참가자가 몇 명인지를
//   알아야 안다. 그래서 응답률을 함께 계산한다.
//
//   "가장 좋았던 것" 순위는 이 화면의 목적 그 자체다 — 내년에 무엇을 남기고
//   무엇을 뺄지가 여기서 나온다.

import { SURVEY_MAX_RATING, SURVEY_MIN_RATING } from "./survey-core";

/** 집계에 필요한 최소한의 응답 모양 — 조회 결과가 이보다 커도 상관없다. */
export type ReportInput = {
  rating: number;
  bestMissionId: string | null;
  bestMissionTitle: string | null;
  comment: string | null;
};

export type RatingBucket = {
  rating: number;
  count: number;
  /** 전체 응답 대비 % (0~100, 정수). 응답이 없으면 0. */
  percent: number;
};

export type MissionRank = {
  missionId: string;
  title: string;
  count: number;
  percent: number;
};

export type SurveyReport = {
  responseCount: number;
  participantCount: number;
  /** 0~100 정수. 참가자 수를 모르면 null — 0% 라고 쓰면 거짓말이다. */
  responseRate: number | null;
  /** 응답이 없으면 null. 0 점이 아니다 — 안 받은 것과 나쁜 점수는 다른 말이다. */
  avgRating: number | null;
  commentCount: number;
  /** 5점 → 1점 순. 0건인 칸도 남긴다 — 빈 칸이 있어야 분포가 분포로 보인다. */
  distribution: RatingBucket[];
  /** 많이 뽑힌 순. 동점이면 이름순으로 고정한다(새로고침마다 순서가 바뀌면 안 된다). */
  missions: MissionRank[];
};

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function buildSurveyReport(
  responses: ReportInput[],
  participantCount: number
): SurveyReport {
  const total = responses.length;

  const counts = new Map<number, number>();
  let sum = 0;
  let commentCount = 0;
  const missionCounts = new Map<string, { title: string; count: number }>();

  for (const r of responses) {
    const rating = Math.round(Number(r.rating));
    if (
      Number.isFinite(rating) &&
      rating >= SURVEY_MIN_RATING &&
      rating <= SURVEY_MAX_RATING
    ) {
      counts.set(rating, (counts.get(rating) ?? 0) + 1);
      sum += rating;
    }
    if ((r.comment ?? "").trim()) commentCount += 1;

    if (r.bestMissionId) {
      const prev = missionCounts.get(r.bestMissionId);
      missionCounts.set(r.bestMissionId, {
        // 제목은 나중에 온 값이 더 최신이라고 볼 근거가 없다 — 처음 것을 지킨다.
        title: prev?.title ?? r.bestMissionTitle ?? "(지워진 미션)",
        count: (prev?.count ?? 0) + 1,
      });
    }
  }

  const rated = [...counts.values()].reduce((a, b) => a + b, 0);

  const distribution: RatingBucket[] = [];
  for (let n = SURVEY_MAX_RATING; n >= SURVEY_MIN_RATING; n -= 1) {
    const c = counts.get(n) ?? 0;
    distribution.push({ rating: n, count: c, percent: pct(c, rated) });
  }

  const missions: MissionRank[] = [...missionCounts.entries()]
    .map(([missionId, v]) => ({
      missionId,
      title: v.title,
      count: v.count,
      percent: pct(v.count, total),
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "ko"));

  return {
    responseCount: total,
    participantCount,
    responseRate: participantCount > 0 ? pct(total, participantCount) : null,
    avgRating: rated > 0 ? Math.round((sum / rated) * 100) / 100 : null,
    commentCount,
    distribution,
    missions,
  };
}

/**
 * 결과 화면 한 줄 요약.
 *
 * 응답이 없을 때 "0점" 이라고 쓰지 않는다 — 아직 안 받은 것과 나쁜 점수는
 * 완전히 다른 말이다.
 */
export function reportLine(r: SurveyReport): string {
  if (r.responseCount === 0) return "아직 응답이 없어요";
  const avg = r.avgRating ?? 0;
  const rate = r.responseRate === null ? "" : ` (${r.responseRate}%)`;
  return `${avg.toFixed(1)}점 · ${r.responseCount}명 응답${rate}`;
}
