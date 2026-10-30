// 참가 접수 통계 — 순수 로직 (서버/클라이언트 공용, DB 접근 없음).
//
// 통계 패널(클라이언트)과 엑셀 내보내기(서버 라우트)가 같은 숫자를 봐야 하므로
// 계산은 전부 여기 한 곳에 둔다. 인원 합산 규칙은 application-core 의
// computeHeadcount 를 그대로 쓴다 — 신청 목록 행에 적힌 숫자와 절대 안 어긋난다.

import { computeHeadcount, type Headcount } from "./application-core";
import type {
  CompanionKind,
  OrgEventApplicationRow,
} from "./types";

/** 반이 비어 있는 원아를 묶는 가상 반 이름. */
export const NO_CLASS_LABEL = "반 미지정";

export type ClassStat = {
  className: string;
  /** 이 반 원아가 있는 가족 수. 형제가 다른 반이면 양쪽에 1씩 센다. */
  familyCount: number;
  /** 이 반 원아 수. */
  childCount: number;
  /** 이 반 가족들의 총 인원 합 (어른 포함) — 간식·좌석 수량 산출용. */
  personTotal: number;
};

export type CompanionLabelStat = {
  label: string;
  kind: CompanionKind;
  count: number;
};

export type DateStat = {
  /** "10/29(수)" — KST 기준 신청 날짜. */
  dateLabel: string;
  count: number;
};

export type ApplicationStats = {
  familyCount: number;
  headcount: Headcount;
  /** 소수 1자리. 가족이 없으면 0. */
  avgPartySize: number;
  /** 원아 수 내림차순. */
  byClass: ClassStat[];
  /** 횟수 내림차순. */
  byCompanionLabel: CompanionLabelStat[];
  /** 조부모가 함께 오는 가족 수 — 좌석·이동 준비 포인트. */
  seniorFamilyCount: number;
  /** 신청일 오름차순. */
  byDate: DateStat[];
};

/** KST 날짜 라벨 — 신청 추이 묶음 키. 깨진 시각은 "날짜 미상". */
function kstDateLabelOf(iso: string | null | undefined): string {
  if (!iso) return "날짜 미상";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "날짜 미상";
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  // "10. 29. (수)" → "10/29(수)"
  return fmt
    .format(d)
    .replace(/\.\s*/g, "/")
    .replace(/\/\(/, "(")
    .replace(/\/$/, "");
}

export function computeApplicationStats(
  rows: readonly OrgEventApplicationRow[]
): ApplicationStats {
  const totals: Headcount = {
    childCount: 0,
    adultCount: 0,
    seniorCount: 0,
    total: 0,
  };
  const byClass = new Map<string, ClassStat>();
  const byLabel = new Map<string, CompanionLabelStat>();
  const byDate = new Map<string, DateStat>();
  let seniorFamilyCount = 0;

  for (const a of rows) {
    const h = computeHeadcount(a.children, a.companions);
    totals.childCount += h.childCount;
    totals.adultCount += h.adultCount;
    totals.seniorCount += h.seniorCount;
    totals.total += h.total;
    if (h.seniorCount > 0) seniorFamilyCount += 1;

    // 반별 — 한 가족이 같은 반에 형제를 둘 넣어도 가족은 1로 센다.
    const familyClasses = new Set<string>();
    for (const c of a.children) {
      const cls = (c.class_name ?? "").trim() || NO_CLASS_LABEL;
      const stat = byClass.get(cls) ?? {
        className: cls,
        familyCount: 0,
        childCount: 0,
        personTotal: 0,
      };
      stat.childCount += 1;
      byClass.set(cls, stat);
      familyClasses.add(cls);
    }
    for (const cls of familyClasses) {
      const stat = byClass.get(cls);
      if (!stat) continue;
      stat.familyCount += 1;
      stat.personTotal += h.total;
    }

    // 동반 구성 — "엄마 18 · 아빠 15 · 할머니 4" 식 라벨 분포.
    for (const comp of a.companions) {
      const label = (comp.label ?? "").trim() || "동반인";
      const stat = byLabel.get(label) ?? {
        label,
        kind: comp.kind,
        count: 0,
      };
      stat.count += 1;
      byLabel.set(label, stat);
    }

    // 신청 추이 — KST 날짜 단위.
    const dateLabel = kstDateLabelOf(a.created_at);
    const d = byDate.get(dateLabel) ?? { dateLabel, count: 0 };
    d.count += 1;
    byDate.set(dateLabel, d);
  }

  return {
    familyCount: rows.length,
    headcount: totals,
    avgPartySize:
      rows.length > 0 ? Math.round((totals.total / rows.length) * 10) / 10 : 0,
    byClass: [...byClass.values()].sort(
      (a, b) =>
        b.childCount - a.childCount ||
        a.className.localeCompare(b.className, "ko")
    ),
    byCompanionLabel: [...byLabel.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label, "ko")
    ),
    seniorFamilyCount,
    // Map 삽입 순서는 rows 순서(최신순 조회) — 추이는 과거→현재가 읽기 좋다.
    byDate: [...byDate.values()].reverse(),
  };
}
