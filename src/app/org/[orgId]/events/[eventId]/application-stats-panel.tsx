"use client";

// 참가 접수 통계 패널 — 승인된 신청 기준(전환 가능)으로
// 핵심 요약 · 반별 현황 · 동반 구성 · 신청 추이를 보여준다.
// 계산은 application-stats 의 순수 함수 — 엑셀 내보내기와 같은 숫자다.

import { useMemo, useState } from "react";
import {
  computeApplicationStats,
  NO_CLASS_LABEL,
} from "@/lib/org-events/application-stats";
import {
  computeHeadcount,
  formatPhoneDisplay,
} from "@/lib/org-events/application-core";
import type { OrgEventApplicationRow } from "@/lib/org-events/types";

type Scope = "approved" | "active";

const SCOPE_META: Record<Scope, { label: string; hint: string }> = {
  approved: { label: "✅ 승인만", hint: "승인된 가족 기준" },
  active: { label: "✅+⏳ 승인+대기", hint: "거절·취소 제외 전체" },
};

export function ApplicationStatsPanel({
  orgId,
  eventId,
  applications,
  capacity,
}: {
  orgId: string;
  eventId: string;
  applications: OrgEventApplicationRow[];
  /** 정원 설정값 — 비어 있으면 무제한. */
  capacity: string;
}) {
  const [scope, setScope] = useState<Scope>("approved");
  // 📋 신청자 명단 펼침 — 기본은 내부 스크롤, 펼치면 전부 노출.
  const [rosterExpanded, setRosterExpanded] = useState(false);

  const stats = useMemo(() => {
    const rows = applications.filter((a) =>
      scope === "approved"
        ? a.status === "APPROVED"
        : a.status === "APPROVED" || a.status === "PENDING"
    );
    return computeApplicationStats(rows);
  }, [applications, scope]);

  const capacityNum = Number.parseInt(capacity, 10);
  const capacityPct =
    Number.isFinite(capacityNum) && capacityNum > 0
      ? Math.round((stats.familyCount / capacityNum) * 100)
      : null;

  const maxClassChildren = Math.max(
    1,
    ...stats.byClass.map((c) => c.childCount)
  );
  const maxLabelCount = Math.max(
    1,
    ...stats.byCompanionLabel.map((c) => c.count)
  );
  const maxDateCount = Math.max(1, ...stats.byDate.map((d) => d.count));

  // 📋 신청자 한눈에 — 승인 여부와 무관하게 승인+대기 전부 (거절·취소 제외).
  // 반 → 원아명 순으로 정렬해 "누가 신청했나" 를 명단처럼 훑는다.
  const roster = useMemo(() => {
    return applications
      .filter((a) => a.status === "APPROVED" || a.status === "PENDING")
      .map((a) => ({
        ...a,
        h: computeHeadcount(a.children, a.companions),
        cls:
          (a.children[0]?.class_name ?? "").trim() || NO_CLASS_LABEL,
        names: a.children.map((c) => c.name).join("·") || "(원아 미기재)",
      }))
      .sort(
        (x, y) =>
          x.cls.localeCompare(y.cls, "ko") ||
          x.names.localeCompare(y.names, "ko")
      );
  }, [applications]);

  return (
    <section className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-4">
      {/* 범위 전환 + 엑셀 */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(SCOPE_META) as Scope[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            title={SCOPE_META[s].hint}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              scope === s
                ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
            }`}
          >
            {SCOPE_META[s].label}
          </button>
        ))}
        <a
          href={`/api/org/${orgId}/events/${eventId}/export/applications?scope=${scope}`}
          download
          title="통계 + 가족별 상세 명단을 엑셀(CSV)로 내려받습니다"
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#3A7A52]"
        >
          <span aria-hidden>📥</span> 엑셀로 받기
        </a>
      </div>

      {stats.familyCount === 0 ? (
        <p className="py-4 text-center text-sm text-[#8B7F75]">
          🌱 {scope === "approved" ? "아직 승인된 신청이 없어요" : "신청이 없어요"}
        </p>
      ) : (
        <>
          {/* ① 핵심 요약 */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <SummaryCard
              label="가족"
              value={`${stats.familyCount}`}
              sub={capacityPct !== null ? `정원의 ${capacityPct}%` : "정원 무제한"}
              strong
            />
            <SummaryCard label="총 인원" value={`${stats.headcount.total}명`} strong />
            <SummaryCard label="👶 유아" value={`${stats.headcount.childCount}`} />
            <SummaryCard label="🧑 성인" value={`${stats.headcount.adultCount}`} />
            <SummaryCard label="👴 조부모" value={`${stats.headcount.seniorCount}`} />
            <SummaryCard label="가족당 평균" value={`${stats.avgPartySize}명`} />
          </div>
          {stats.seniorFamilyCount > 0 && (
            <p className="rounded-xl bg-[#FFF8EC] px-3 py-2 text-[11px] font-semibold text-[#8a6d3b]">
              👴 조부모와 함께 오는 가족이 {stats.seniorFamilyCount}팀이에요 —
              좌석·이동 동선을 미리 챙겨두면 좋아요.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* ② 반별 현황 */}
            <div>
              <h3 className="mb-2 text-xs font-bold text-[#2D5A3D]">
                🐰 반별 현황
                <span className="ml-1 font-normal text-[#8B7F75]">
                  — 원아 수 기준
                </span>
              </h3>
              <ul className="space-y-1.5">
                {stats.byClass.map((c) => (
                  <li key={c.className}>
                    <div className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span
                        className={`font-bold ${
                          c.className === NO_CLASS_LABEL
                            ? "text-[#8B7F75]"
                            : "text-[#2D5A3D]"
                        }`}
                      >
                        {c.className}
                      </span>
                      <span className="shrink-0 tabular-nums text-[#6B6560]">
                        원아 <b>{c.childCount}</b> · 가족 {c.familyCount} · 총{" "}
                        {c.personTotal}명
                      </span>
                    </div>
                    <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-[#F5F1E8]">
                      <div
                        className="h-full rounded-full bg-[#7FB069]"
                        style={{
                          width: `${(c.childCount / maxClassChildren) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* ③ 동반 구성 */}
            <div>
              <h3 className="mb-2 text-xs font-bold text-[#2D5A3D]">
                👨‍👩‍👧 동반 구성
                <span className="ml-1 font-normal text-[#8B7F75]">
                  — 누가 함께 오나
                </span>
              </h3>
              <ul className="space-y-1.5">
                {stats.byCompanionLabel.map((c) => (
                  <li key={c.label}>
                    <div className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="font-bold text-[#2D5A3D]">
                        {c.kind === "SENIOR" ? "👴" : c.kind === "CHILD" ? "👶" : "🧑"}{" "}
                        {c.label}
                      </span>
                      <span className="shrink-0 tabular-nums text-[#6B6560]">
                        {c.count}명
                      </span>
                    </div>
                    <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-[#F5F1E8]">
                      <div
                        className={`h-full rounded-full ${
                          c.kind === "SENIOR"
                            ? "bg-[#D4A95E]"
                            : c.kind === "CHILD"
                              ? "bg-[#9BC4E2]"
                              : "bg-[#7FB069]"
                        }`}
                        style={{ width: `${(c.count / maxLabelCount) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ④ 신청 추이 */}
          <div>
            <h3 className="mb-2 text-xs font-bold text-[#2D5A3D]">
              📈 날짜별 신청
            </h3>
            <ul className="flex items-end gap-1.5 overflow-x-auto pb-1">
              {stats.byDate.map((d) => (
                <li
                  key={d.dateLabel}
                  className="flex min-w-[52px] flex-col items-center gap-0.5"
                >
                  <span className="text-[10px] font-bold tabular-nums text-[#2D5A3D]">
                    {d.count}
                  </span>
                  <div
                    className="w-7 rounded-t bg-[#7FB069]"
                    style={{
                      height: `${Math.max(6, (d.count / maxDateCount) * 56)}px`,
                    }}
                  />
                  <span className="whitespace-nowrap text-[9px] text-[#8B7F75]">
                    {d.dateLabel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* 📋 신청자 한눈에 — 승인 전이어도 전부 (거절·취소 제외).
          승인 0건이라 위 통계가 비어도 이 명단은 보인다. */}
      {roster.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-[#2D5A3D]">
              📋 신청자 한눈에 ({roster.length}가족)
              <span className="ml-1 font-normal text-[#8B7F75]">
                — 승인 전 포함 · 거절/취소 제외
              </span>
            </h3>
            <button
              type="button"
              onClick={() => setRosterExpanded((v) => !v)}
              aria-expanded={rosterExpanded}
              className="shrink-0 rounded-full border border-[#D4E4BC] bg-white px-2.5 py-1 text-[10px] font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
            >
              {rosterExpanded ? "▲ 접기" : "▼ 전체 펼치기"}
            </button>
          </div>
          <div
            className={`rounded-xl border border-[#EDE6D8] ${
              rosterExpanded ? "" : "max-h-72 overflow-y-auto"
            }`}
          >
            <table className="w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-[#F5F1E8] text-[#6B6560]">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold">반</th>
                  <th className="px-2 py-1.5 text-left font-semibold">원아</th>
                  <th className="px-2 py-1.5 text-center font-semibold">상태</th>
                  <th className="px-2 py-1.5 text-right font-semibold">인원</th>
                  <th className="hidden px-2 py-1.5 text-left font-semibold sm:table-cell">
                    동반
                  </th>
                  <th className="hidden px-2 py-1.5 text-right font-semibold md:table-cell">
                    연락처
                  </th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r, i) => {
                  // 같은 반이 이어지면 반 이름은 첫 줄에만 — 묶음으로 읽힌다.
                  const newClass = i === 0 || roster[i - 1].cls !== r.cls;
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-[#F0EADC] ${
                        newClass && i > 0 ? "border-t-[#D4E4BC]" : ""
                      }`}
                    >
                      <td className="px-2 py-1 font-bold text-[#2D5A3D]">
                        {newClass ? r.cls : ""}
                      </td>
                      <td className="px-2 py-1 font-semibold text-[#3d3835]">
                        {r.names}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {r.status === "APPROVED" ? (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            ✅ 승인
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            ⏳ 대기
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-[#6B6560]">
                        👶{r.h.childCount} 🧑{r.h.adultCount}
                        {r.h.seniorCount > 0 ? ` 👴${r.h.seniorCount}` : ""}
                        <b className="ml-1 text-[#2D5A3D]">{r.h.total}명</b>
                      </td>
                      <td className="hidden max-w-[140px] truncate px-2 py-1 text-[#8B7F75] sm:table-cell">
                        {r.companions.map((c) => c.label).join("·")}
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-1 text-right tabular-nums text-[#8B7F75] md:table-cell">
                        {formatPhoneDisplay(r.phone)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  strong = false,
}: {
  label: string;
  value: string;
  sub?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-2 py-2.5 text-center ${
        strong ? "bg-[#2D5A3D] text-white" : "bg-[#F5F1E8] text-[#2D5A3D]"
      }`}
    >
      <p
        className={`text-[10px] font-semibold ${
          strong ? "text-white/75" : "text-[#8B7F75]"
        }`}
      >
        {label}
      </p>
      <p className="text-lg font-extrabold tabular-nums leading-tight">
        {value}
      </p>
      {sub && (
        <p
          className={`text-[9px] font-semibold ${
            strong ? "text-white/70" : "text-[#8B7F75]"
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
