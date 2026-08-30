// ⑤ 결과 → 설문. 켜고, 언제 열릴지 정하고, 받은 답을 보고, 내려받는다.
//
// 왜 평균 하나로 끝내지 않나:
//   평균 4.3 은 "다들 4점쯤 줬다" 로도, "대부분 5점인데 1점이 셋 섞였다" 로도
//   나온다. 뒤쪽이 훨씬 중요한 신호인데 평균이 그걸 지운다. 분포를 같이 낸다.
//   응답 38명이 많은지 적은지도 참가자 수를 알아야 안다 — 응답률을 같이 낸다.
//
//   "가장 좋았던 것" 순위가 이 화면의 목적 그 자체다. 내년에 무엇을 남기고
//   무엇을 뺄지가 여기서 나온다.
//
// 집계는 survey-report(순수 로직)가 하고 여기서는 그리기만 한다.

import { requireOrg } from "@/lib/org-auth-guard";
import { loadSurveyResponses } from "@/lib/org-events/survey-queries";
import { ratingStars } from "@/lib/org-events/survey-core";
import { buildSurveyReport, reportLine } from "@/lib/org-events/survey-report";
import { fmtDateTimeKst } from "@/lib/datetime/kst";
import { SurveyToggle } from "./survey-toggle";
import { SurveyOpenTime } from "./survey-open-time";
import { SurveyLinkShare } from "./survey-link-share";

/**
 * 한 번에 읽어오는 상한. 유치원 행사 규모(참가 100가족 안팎)를 훨씬 넘는
 * 값이라 실제로는 늘 전부 온다. 그보다 커지는 날에는 다운로드가 답이다.
 */
const MAX_ROWS = 1000;

export async function SurveyPanel({
  orgId,
  eventId,
  surveyEnabled,
  endsAt,
  openLeadMin,
  participantCount,
}: {
  orgId: string;
  eventId: string;
  surveyEnabled: boolean;
  endsAt: string | null;
  openLeadMin?: number | null;
  participantCount: number;
}) {
  await requireOrg();
  const responses = await loadSurveyResponses(eventId, MAX_ROWS);
  const report = buildSurveyReport(responses, participantCount);

  return (
    <div className="space-y-4">
      <SurveyToggle eventId={eventId} initialEnabled={surveyEnabled} />

      {surveyEnabled && (
        <>
          <SurveyOpenTime
            eventId={eventId}
            endsAt={endsAt}
            initialLeadMin={openLeadMin}
          />
          <SurveyLinkShare eventId={eventId} />
        </>
      )}

      {/* 요약 — 숫자 셋. 응답률이 응답 수보다 앞선다(38이 많은지 적은지가 먼저다). */}
      <section className="grid grid-cols-3 gap-2">
        <Stat
          label="평균"
          value={report.avgRating == null ? "-" : report.avgRating.toFixed(1)}
          sub={report.avgRating == null ? "" : ratingStars(report.avgRating)}
        />
        <Stat
          label="응답률"
          value={report.responseRate === null ? "-" : `${report.responseRate}%`}
          sub={
            report.participantCount > 0
              ? `${report.responseCount}/${report.participantCount}명`
              : `${report.responseCount}명`
          }
        />
        <Stat label="의견" value={`${report.commentCount}`} sub="건" />
      </section>

      {report.responseCount === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white/70 px-4 py-10 text-center text-sm text-[#8B7F75]">
          {reportLine(report)}
          {!surveyEnabled && (
            <span className="mt-1 block text-[11px]">
              설문 받기를 켜면 참가자 화면에 나타나요
            </span>
          )}
        </p>
      ) : (
        <>
          {/* 별점 분포 — 평균이 지운 이야기가 여기 있다. */}
          <section className="space-y-1.5 rounded-2xl border border-[#D4E4BC] bg-white p-4">
            {report.distribution.map((d) => (
              <div key={d.rating} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] font-bold text-amber-600">
                  {ratingStars(d.rating)}
                </span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#F5F1E8]">
                  <span
                    className="block h-full rounded-full bg-amber-400"
                    style={{ width: `${d.percent}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums text-[#6B6560]">
                  {d.count}
                </span>
              </div>
            ))}
          </section>

          {/* 가장 좋았던 것 — 내년에 무엇을 남기고 무엇을 뺄지 */}
          {report.missions.length > 0 && (
            <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4">
              <h3 className="text-sm font-bold text-[#2D5A3D]">
                <span aria-hidden className="mr-1.5">
                  👍
                </span>
                가장 좋았던 것
              </h3>
              <ol className="mt-2 space-y-1.5">
                {report.missions.map((m, i) => (
                  <li key={m.missionId} className="flex items-center gap-2">
                    <span className="w-4 shrink-0 text-[11px] font-bold tabular-nums text-[#8B7F75]">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#2D5A3D]">
                      {m.title}
                    </span>
                    <span className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-[#F5F1E8]">
                      <span
                        className="block h-full rounded-full bg-[#3A7A52]"
                        style={{ width: `${m.percent}%` }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums text-[#6B6560]">
                      {m.count}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#2D5A3D]">
              받은 답 {report.responseCount}건
            </h3>
            {/* 서버가 파일을 만들어 내려보낸다 — 브라우저 다운로드 그대로. */}
            <a
              href={`/org/${orgId}/events/${eventId}/survey/export`}
              download
              className="shrink-0 rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] shadow-sm transition hover:border-[#2D5A3D]"
            >
              📥 엑셀로 받기
            </a>
          </section>

          <ul className="divide-y divide-[#F0EBE3] overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white">
            {responses.map((r) => (
              <li key={r.id} className="p-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-bold text-amber-600">
                    {ratingStars(r.rating)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#2D5A3D]">
                    {r.name} 가족
                  </span>
                  <span className="shrink-0 text-[11px] text-[#8B7F75]">
                    {fmtDateTimeKst(r.createdAt)}
                  </span>
                </div>
                {r.bestMissionTitle && (
                  <p className="mt-1 text-[11px] text-[#6B6560]">
                    👍 {r.bestMissionTitle}
                  </p>
                )}
                {r.comment && (
                  <p className="mt-1.5 whitespace-pre-wrap rounded-xl bg-[#FFF8F0] px-3 py-2 text-xs leading-relaxed text-[#3D3A36]">
                    {r.comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 text-center shadow-sm">
      <p className="text-[11px] font-semibold text-[#8B7F75]">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums text-[#2D5A3D]">
        {value}
      </p>
      <p className="text-[11px] text-[#8B7F75]">{sub}</p>
    </div>
  );
}
