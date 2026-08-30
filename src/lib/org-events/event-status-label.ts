// 행사 상태를 화면에 적는 말 — 순수 로직(서버/클라이언트 공용, DB 접근 없음).
//
// 왜 라벨만으로는 부족한가:
//   "예정" 이라고만 적혀 있으면 **언제** 예정인지를 다시 찾아야 한다. "종료" 도
//   마찬가지다 — 어제 끝난 행사와 작년에 끝난 행사가 같은 글자다.
//   상태가 스스로 날짜를 들고 다니게 한다.
//
//     예정 → 9/12(토) 예정
//     진행 → 진행중
//     종료 → 5/16(토) 종료
//     보관 → 보관중
//
//   진행·보관에 날짜를 안 붙이는 이유: "지금" 과 "치워둠" 은 시점이 아니라 상태다.
//   붙일 날짜가 마땅치 않고, 붙이면 오히려 읽는 사람이 그게 무슨 날짜인지 되묻는다.
//
// 한 곳에 모으는 이유: 행사 목록·상세 헤더·편집 폼·숲지기 대시보드가 각자 만들면
// 같은 행사가 화면마다 다르게 적힌다.

import { fmtCompactDateKst } from "@/lib/datetime/kst";
import type { OrgEventStatus } from "./types";

export type EventStatusTone = "draft" | "live" | "ended" | "archived";

export type EventStatusLabel = {
  emoji: string;
  /** "9/12(토) 예정" — 날짜를 모르면 짧은 말로 떨어진다. */
  label: string;
  /** "예정" — 좁은 칸(고르지 않은 세그먼트 칸)용. 날짜 없음. */
  short: string;
  tone: EventStatusTone;
};

const BASE: Record<
  OrgEventStatus,
  { emoji: string; short: string; tone: EventStatusTone }
> = {
  DRAFT: { emoji: "📝", short: "예정", tone: "draft" },
  LIVE: { emoji: "🟢", short: "진행중", tone: "live" },
  ENDED: { emoji: "🏁", short: "종료", tone: "ended" },
  ARCHIVED: { emoji: "📦", short: "보관중", tone: "archived" },
};

function isStatus(v: unknown): v is OrgEventStatus {
  return v === "DRAFT" || v === "LIVE" || v === "ENDED" || v === "ARCHIVED";
}

export function describeEventStatus(args: {
  status: string | null | undefined;
  startsAt?: string | null;
  endsAt?: string | null;
}): EventStatusLabel {
  // 모르는 값은 예정으로 떨어진다 — 컬럼 미적용·오타에도 화면이 비지 않게.
  const status = isStatus(args.status) ? args.status : "DRAFT";
  const base = BASE[status];

  if (status === "DRAFT") {
    const d = fmtCompactDateKst(args.startsAt);
    return { ...base, label: d ? `${d} 예정` : "예정" };
  }

  if (status === "ENDED") {
    // 끝난 날이 없으면 시작한 날이라도 적는다 — 하루짜리 행사가 대부분이고,
    // 아무 날짜도 없는 "종료" 보다는 훨씬 쓸모 있다.
    const d = fmtCompactDateKst(args.endsAt) || fmtCompactDateKst(args.startsAt);
    return { ...base, label: d ? `${d} 종료` : "종료" };
  }

  return { ...base, label: base.short };
}
