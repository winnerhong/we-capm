// "도토리 모으는 법" 안내 만들기 — 순수 로직 (서버/클라이언트 공용, DB 접근 없음).
//
// 손으로 적지 않고 **행사 설정에서 뽑아내는** 이유:
//   행사마다 미션 구성도 도토리 값도 다르다. 안내문을 따로 적게 하면 기관이
//   미션을 고칠 때마다 같이 고쳐야 하는데, 아무도 그러지 않는다. 그러면 화면에는
//   "사진 미션 +2" 라고 적혀 있는데 실제로는 +3 이 들어오는, 가장 나쁜 종류의
//   안내가 남는다. 지금 켜져 있는 미션에서 바로 만들면 틀릴 수가 없다.
//
// 여기서 다루지 않는 것: 토리FM 하트·사연처럼 값이 상황마다 달라지는 것.
// 숫자를 못 박을 수 없는 항목을 적으면 위와 같은 거짓말이 된다.

import { MISSION_KIND_META, type MissionKind } from "./types";

export type AcornGuideItem = {
  icon: string;
  label: string;
  /** "5개 · 하나당 +3" 처럼 오른쪽에 붙는 설명. */
  detail: string;
};

type MissionLike = { kind: string; acorns?: number | null };
type TierLike = { label?: string; threshold?: number };

/** 최종 보상은 "모으는 법" 이 아니라 "모아서 받는 것" — 목록에서 뺀다. */
const EXCLUDED_KINDS = new Set(["FINAL_REWARD"]);

/**
 * 이 행사에서 도토리를 얻는 방법들.
 *
 * @param missions 이 행사 스탬프북에 켜져 있는 미션들.
 * @param feedEnabled 사진 나눠보기(좋아요)가 켜진 행사인가.
 * @param tiers 최종 보상 문턱 — 있으면 "얼마 모으면 무엇" 을 마지막에 붙인다.
 */
export function buildAcornGuide(args: {
  missions: MissionLike[];
  feedEnabled?: boolean;
  likeAcornCap?: number;
  tiers?: TierLike[];
}): AcornGuideItem[] {
  const items: AcornGuideItem[] = [];

  // 1) 미션 종류별로 묶는다. 같은 종류 미션이 5개인데 5줄로 늘어놓으면 안내가 아니다.
  const byKind = new Map<string, { count: number; min: number; max: number }>();
  for (const m of args.missions) {
    if (!m.kind || EXCLUDED_KINDS.has(m.kind)) continue;
    const acorns = Math.max(0, m.acorns ?? 0);
    const cur = byKind.get(m.kind);
    if (cur) {
      cur.count += 1;
      cur.min = Math.min(cur.min, acorns);
      cur.max = Math.max(cur.max, acorns);
    } else {
      byKind.set(m.kind, { count: 1, min: acorns, max: acorns });
    }
  }

  // 도토리를 많이 주는 순으로 — 궁금한 건 "뭘 하면 제일 많이 받나" 다.
  const kinds = [...byKind.entries()].sort((a, b) => b[1].max - a[1].max);
  for (const [kind, stat] of kinds) {
    const meta = MISSION_KIND_META[kind as MissionKind];
    const amount =
      stat.min === stat.max ? `+${stat.max}` : `+${stat.min}~${stat.max}`;
    items.push({
      icon: meta?.icon ?? "🌿",
      label: meta?.label ?? "미션",
      detail:
        stat.count > 1
          ? `${stat.count}개 · 하나당 ${amount}`
          : `하나당 ${amount}`,
    });
  }

  // 2) 좋아요 — 미션이 아니라 "받는" 도토리라 미션 아래에 둔다.
  if (args.feedEnabled) {
    const cap = args.likeAcornCap ?? 5;
    items.push({
      icon: "❤️",
      label: "내 사진에 좋아요 받기",
      detail: `하트 1개당 +1 (사진당 ${cap}개까지)`,
    });
  }

  // 3) 최종 보상 문턱 — 모아서 무엇이 되는지. 가장 낮은 문턱 하나만 건다.
  //    문턱을 전부 늘어놓으면 안내가 아니라 표가 되고, 첫 목표만 보이면 충분하다.
  const tiers = (args.tiers ?? [])
    .filter((t) => typeof t.threshold === "number" && t.threshold > 0)
    .sort((a, b) => (a.threshold ?? 0) - (b.threshold ?? 0));
  if (tiers.length > 0) {
    const first = tiers[0];
    const last = tiers[tiers.length - 1];
    items.push({
      icon: "🏅",
      label: (first.label ?? "").trim() || "최종 보상",
      detail:
        tiers.length > 1
          ? `${first.threshold}개부터 · 최고 ${last.threshold}개`
          : `${first.threshold}개 모으면`,
    });
  }

  return items;
}
