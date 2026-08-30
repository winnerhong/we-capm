// server-only: 상단 메뉴에 올릴 도구 조회.
//
// 두 축이 만나는 곳이다:
//   고정됐나  org_tool_pins / partner_tool_pins  (이 파일)
//   쓸 수 있나 org_feature_switches …            (lib/features/org-switches.ts)
// 둘 다여야 상단에 뜬다. 그래서 기능을 끄면 상단에서도 자동으로 빠진다 —
// 고정을 따로 풀어 줄 필요가 없다(풀어야 한다면 반드시 잊어버린다).
//
// ⚠ 실패하면 **아무것도 고정하지 않은 것으로 본다.**
//   기능 스위치는 fail-open(다 켜짐)이 안전하지만 여기는 반대다. 조회가 실패했을
//   때 뭔가를 상단에 올리면 그건 근거 없이 나타난 메뉴다. 못 읽었으면 지금까지와
//   같은 상단 메뉴가 나오는 게 맞다.

import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { loadOrgFeatureFlags, canUse } from "@/lib/features/org-switches";
import { ORG_TOOLS, toolByKey, type OrgTool } from "./registry";
import { reportQueryFailure } from "@/lib/supabase/schema-gap";

export type PinSource = "org" | "partner";

export type PinnedTools = {
  /** 조회에 성공했나. false 면 keys 는 비어 있다. */
  loaded: boolean;
  keys: Set<string>;
  /** 그 값이 개별 설정에서 왔는지 지사 전체값에서 왔는지 — 지사 화면 표시용. */
  source: Map<string, PinSource>;
};

const NONE: PinnedTools = {
  loaded: false,
  keys: new Set(),
  source: new Map(),
};

type PinRow = { tool_key: string; source: string };

/**
 * 고정된 도구 key. 기능이 켜져 있는지는 아직 안 본다.
 *
 * loadOrgFeatureFlags 와 같은 이유로 요청당 한 번만 읽는다 — 상단 메뉴는 기관
 * 화면 **전부**가 지나는 레이아웃에 있어서, 한 번 더 나가면 그 지연을 모든
 * 화면에서 다시 문다.
 */
export const loadPinnedToolKeys = cache(async function loadPinnedToolKeys(
  orgId: string
): Promise<PinnedTools> {
  if (!orgId) return NONE;
  try {
    const supabase = await createClient();
    const { data, error } = await (
      supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, string>
        ) => Promise<{ data: PinRow[] | null; error: unknown }>;
      }
    ).rpc("org_pinned_tools", { p_org_id: orgId });

    if (error || !data) {
      // 스키마 미적용은 예상된 과도기라 조용히 한 번만 알린다 — 아래 fallback 이
      // 지금까지의 상단 메뉴를 그대로 낸다.
      reportQueryFailure(
        "org_pinned_tools",
        "20260901000000_org_tool_pins.sql",
        error
      );
      return NONE;
    }

    const keys = new Set<string>();
    const source = new Map<string, PinSource>();
    for (const r of data) {
      keys.add(r.tool_key);
      source.set(r.tool_key, r.source === "org" ? "org" : "partner");
    }
    return { loaded: true, keys, source };
  } catch (e) {
    reportQueryFailure(
      "org_pinned_tools",
      "20260901000000_org_tool_pins.sql",
      e
    );
    return NONE;
  }
});

/**
 * 상단 메뉴에 실제로 그릴 도구들 — 고정됐고 **또한** 쓸 수 있는 것만.
 *
 * 순서는 레지스트리 순서를 따른다. 지사가 고정한 순서가 아니라 늘 같은 순서로
 * 나와야 기관 담당자가 위치를 기억할 수 있다(오늘은 왼쪽, 내일은 오른쪽이면
 * 매번 다시 찾는다).
 */
export async function loadTopMenuTools(orgId: string): Promise<OrgTool[]> {
  const [pins, flags] = await Promise.all([
    loadPinnedToolKeys(orgId),
    loadOrgFeatureFlags(orgId),
  ]);

  /* 조회 자체가 안 됐을 때(= 마이그레이션 20260901000000 적용 전)는 **지금까지의
     상단 메뉴**를 그대로 낸다. 관제실은 여태 코드에 박혀 무조건 떴으므로, 여기서
     빈 배열을 돌려주면 스키마를 적용하기 전까지 전 기관의 상단에서 관제실이
     사라진다 — 배포와 스키마 적용 사이의 몇 분이 그대로 장애가 된다.
     ⚠ pins.loaded 가 true 인데 비어 있는 것은 다르다. 그건 지사가 정말로 아무것도
       안 올린 것이라 그대로 존중한다. */
  if (!pins.loaded) {
    const legacy = ORG_TOOLS.find((t) => t.key === "control-room");
    return legacy ? [legacy] : [];
  }

  if (pins.keys.size === 0) return [];

  return ORG_TOOLS.filter((t) => {
    if (!pins.keys.has(t.key)) return false;
    if (!t.featureCode) return true; // 코어는 늘 쓸 수 있다
    return canUse(flags, t.featureCode);
  });
}

/** 지사 화면용 — 알 수 없는 key(레지스트리에서 사라진 것)는 걸러 준다. */
export function knownPinnedTools(pins: PinnedTools): OrgTool[] {
  const out: OrgTool[] = [];
  for (const k of pins.keys) {
    const t = toolByKey(k);
    if (t) out.push(t);
  }
  return out;
}
