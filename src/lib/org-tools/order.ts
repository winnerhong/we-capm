// 도구 목록의 정렬 — 순수 모듈(DB·React 없음).
//
// 레지스트리의 순서는 "어느 그룹의 몇 번째" 라는 편집 순서다. 화면에서는 그
// 위에 규칙이 하나 더 붙는다: **지금 쓸 수 있는 것이 먼저 온다.**
//
// 잠긴 칸을 목록에서 지우지는 않는다(그건 「모든 기능」 카드의 존재 이유를
// 부순다 — "그런 기능이 있는 줄도 몰랐다" 를 없애려고 만든 판이다). 다만 쓸 수
// 있는 것 사이에 섞여 있으면 눈이 자물쇠에 걸려 매번 걸러 읽어야 한다.

import { canUse, type OrgFeatureMap } from "@/lib/features/org-switches";
import type { OrgTool } from "./registry";

export function isLocked(tool: OrgTool, flags: OrgFeatureMap): boolean {
  return tool.featureCode ? !canUse(flags, tool.featureCode) : false;
}

/**
 * 쓸 수 있는 것 먼저, 잠긴 것은 뒤로. **그 안에서는 원래 순서 그대로.**
 *
 * Array.prototype.sort 는 안정 정렬이라(ES2019~) 같은 값끼리는 들어온 순서가
 * 유지된다 — 레지스트리에 적어 둔 편집 순서가 살아 있다는 뜻이다.
 */
export function sortUsableFirst(
  tools: OrgTool[],
  flags: OrgFeatureMap
): OrgTool[] {
  return [...tools].sort(
    (a, b) => Number(isLocked(a, flags)) - Number(isLocked(b, flags))
  );
}
