// server-only: 지사 스위치판이 그릴 값.
//
// 화면은 하나고 **보는 대상**만 바뀐다(전체 기관 / 특정 기관 하나). 그래서
// 로더도 하나다 — 둘로 갈라 두면 "전체에선 이렇게 보이는데 개별에선 저렇게"
// 같은 어긋남이 생기고, 그건 값이 아니라 코드가 만든 차이라 설명할 방법이 없다.
//
// ## 「따로」의 정의
//   행이 있으면 개별 — 이게 아니다. 그 정의로 세면 마이그레이션이 넣어 둔 행
//   (토리톡 이관)까지 "이 기관은 예외" 로 세어져서, 아무도 손대지 않은 기관 6곳이
//   전부 `따로 1` 로 보였다. 숫자가 거짓말을 하면 안 보느니만 못하다.
//
//   **값이 전체값과 실제로 다를 때**만 따로다. 행이 있어도 값이 같으면 따로가
//   아니다(되돌릴 것도 없다).
//
// ## 조회는 요청당 한 번씩만
//   /partner/features 한 장은 서버 컴포넌트 둘(목차용 loadScopeOptions,
//   스위치판용 loadPartnerToolBoard)이 각자 데이터를 읽는다. 둘은 같은 지사의
//   같은 표를 필요로 해서, 그냥 두면 **똑같은 질의가 두 벌** 나간다
//   (계측: 15회 중 7회가 완전 중복이었다). 서로를 알 필요 없이 각자 읽되 왕복은
//   한 번이면 되므로, 밑바닥 조회를 react 의 cache() 로 감싼다. 요청이 끝나면
//   같이 사라지므로 오래된 값이 남을 일도 없다.

import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { reportQueryFailure } from "@/lib/supabase/schema-gap";
import { ORG_TOOLS, type OrgTool } from "./registry";
import type { ToolState } from "./actions";
import type { OrgPhase, ScopeOption } from "./phases";

// 화면도 쓰는 정의는 phases.ts 에 있다(순수 모듈). 여기서 다시 내보내 두면
// 부르는 쪽이 "어느 파일에서 가져오지" 를 고민하지 않아도 된다.
export {
  ORG_PHASE_ORDER,
  ORG_PHASE_META,
  type OrgPhase,
  type ScopeOption,
} from "./phases";

export type ToolRow = {
  tool: OrgTool;
  /** 지금 보고 있는 대상에 실제로 적용되는 값. */
  state: ToolState;
  /** 지사 전체값 — 개별 화면에서 "원래 값" 을 보여주기 위해. */
  partnerState: ToolState;
  /** 지사가 이 기능을 보유했나. false 면 아예 못 준다. */
  partnerHas: boolean;
  /**
   * 전체 화면 : 이 도구를 전체값과 다르게 둔 기관 수
   * 개별 화면 : 1이면 이 기관이 전체값과 다름, 0이면 전체값 그대로
   */
  differs: number;
};

/* -------------------------------------------------------------------------- */
/* 밑바닥 조회                                                                 */
/* -------------------------------------------------------------------------- */

type Rows<T> = { data: T[] | null; error: unknown };
type Filter = ["eq", string, string] | ["in", string, string[]];

/** 어느 표가 어느 SQL 에서 오는지 — 아직 안 돌린 마이그레이션을 이름으로 알려준다. */
const FROM_MIGRATION: Record<string, string> = {
  org_feature_switches: "20260831000000_org_feature_switches.sql",
  partner_feature_defaults: "20260901000000_org_tool_pins.sql",
  partner_tool_pins: "20260901000000_org_tool_pins.sql",
  org_tool_pins: "20260901000000_org_tool_pins.sql",
};

/** PostgREST 가 한 번에 주는 최대 행 수(Supabase 기본). */
const PAGE = 1000;

/**
 * 표 하나를 조건대로 전부 읽는다.
 *
 * ⚠ **1000행에서 잘리던 문제.** 예전엔 range 없이 한 번만 읽었다. PostgREST 는
 *   기본으로 1000행에서 끊으므로, 행사나 스위치가 1000행을 넘는 순간 나머지가
 *   조용히 사라진다. 에러도 안 난다 — 화면의 「따로 N」 이 그냥 틀린 숫자가 된다.
 *   그래서 다 읽을 때까지 이어 받는다. 1000행 미만이면 왕복은 그대로 한 번이다.
 *
 * @param key **행을 유일하게 정하는 컬럼들.** 정렬 없이 range 로 나눠 읽으면
 *   페이지마다 순서가 달라질 수 있어서(SQL 은 ORDER BY 없는 순서를 보장하지
 *   않는다) 어떤 행은 두 번 오고 어떤 행은 영영 안 온다 — 잘림을 고치려다 더
 *   조용한 오답을 만드는 셈이다. 그래서 정렬 기준을 부르는 쪽이 반드시 준다.
 *   선택 컬럼에 없어도 된다(org_events 는 id 로 정렬하고 id 는 안 읽는다).
 */
async function all<T>(
  table: string,
  cols: string,
  filters: Filter[],
  key: string[]
): Promise<T[]> {
  // 빈 목록에 대한 in() 은 "물어볼 것이 없다" 는 뜻이다. 굳이 보내지 않는다.
  if (filters.some((f) => f[0] === "in" && f[2].length === 0)) return [];

  const supabase = await createClient();
  const out: T[] = [];

  for (let from = 0; ; from += PAGE) {
    type Q = {
      eq: (k: string, v: string) => Q;
      in: (k: string, v: string[]) => Q;
      order: (c: string) => Q;
      range: (a: number, b: number) => Q;
    } & Promise<Rows<T>>;

    let q = (
      supabase.from(table as never) as unknown as {
        select: (c: string) => unknown;
      }
    ).select(cols) as unknown as Q;

    for (const f of filters) {
      q = f[0] === "eq" ? q.eq(f[1], f[2]) : q.in(f[1], f[2]);
    }
    for (const c of key) q = q.order(c);
    q = q.range(from, from + PAGE - 1);

    try {
      const { data, error } = await q;
      if (error) {
        reportQueryFailure(table, FROM_MIGRATION[table] ?? "(확인 필요)", error);
        return out;
      }
      const rows = data ?? [];
      out.push(...rows);
      if (rows.length < PAGE) return out;
    } catch (e) {
      reportQueryFailure(table, FROM_MIGRATION[table] ?? "(확인 필요)", e);
      return out;
    }
  }
}

function toState(enabled: boolean, pinned: boolean): ToolState {
  if (!enabled) return "off";
  return pinned ? "pinned" : "on";
}

/* -------------------------------------------------------------------------- */
/* 요청당 한 번만 읽는 조각들                                                  */
/* -------------------------------------------------------------------------- */

/** 지사 전체 층까지 풀어 둔 값 — 개별은 이 위에 얹힌다. */
type PartnerBase = {
  enabled: (tool: OrgTool) => boolean;
  pinned: (tool: OrgTool) => boolean;
  state: (tool: OrgTool) => ToolState;
  owned: Set<string>;
};

const partnerBase = cache(async function partnerBase(
  partnerId: string
): Promise<PartnerBase> {
  const [catalog, grants, defaults, pins] = await Promise.all([
    all<{ code: string; org_default_on: boolean }>(
      "platform_features",
      "code,org_default_on",
      [],
      ["code"]
    ),
    all<{ feature_code: string }>(
      "partner_feature_grants",
      "feature_code",
      [
        ["eq", "partner_id", partnerId],
        ["eq", "status", "ACTIVE"],
      ],
      ["feature_code"]
    ),
    all<{ feature_code: string; enabled: boolean }>(
      "partner_feature_defaults",
      "feature_code,enabled",
      [["eq", "partner_id", partnerId]],
      ["feature_code"]
    ),
    all<{ tool_key: string; pinned: boolean }>(
      "partner_tool_pins",
      "tool_key,pinned",
      [["eq", "partner_id", partnerId]],
      ["tool_key"]
    ),
  ]);

  const platform = new Map(catalog.map((c) => [c.code, c.org_default_on]));
  const owned = new Set(grants.map((g) => g.feature_code));
  const defEnabled = new Map(defaults.map((d) => [d.feature_code, d.enabled]));
  const defPinned = new Map(pins.map((p) => [p.tool_key, p.pinned]));

  const enabled = (t: OrgTool) => {
    if (!t.featureCode) return true; // 코어는 끌 수 없다
    return defEnabled.get(t.featureCode) ?? platform.get(t.featureCode) ?? true;
  };
  const pinned = (t: OrgTool) => defPinned.get(t.key) ?? false;

  return {
    enabled,
    pinned,
    state: (t) => toState(enabled(t), pinned(t)),
    owned,
  };
});

export type LiveOrg = { id: string; org_name: string; status: string };

/**
 * 이 지사의 **살아 있는** 기관들.
 *
 * 해지(CLOSED)를 빼는 자리는 여기 하나여야 한다. 예전엔 목차만 걸러서, 전체
 * 스위치판은 해지된 기관의 예외까지 세어 「기관 3곳은 다르게 설정돼 있어요」 라고
 * 할 수 있었다 — 목차에는 그 3곳이 없으니 찾아갈 수도 없는 숫자다.
 */
const liveOrgs = cache(async function liveOrgs(
  partnerId: string
): Promise<LiveOrg[]> {
  const rows = await all<LiveOrg>(
    "partner_orgs",
    "id,org_name,status",
    [["eq", "partner_id", partnerId]],
    ["id"]
  );
  return rows.filter((o) => o.status !== "CLOSED");
});

type Overrides = {
  /** `${orgId}|${featureCode}` → 켬/끔 */
  sw: Map<string, boolean>;
  /** `${orgId}|${toolKey}` → 상단 고정 여부 */
  pn: Map<string, boolean>;
};

/**
 * 기관별로 덮어쓴 값들.
 *
 * ⚠ 예전엔 조건 없이 표를 통째로 읽고 JS 에서 내 기관만 골라냈다. 지사 하나를
 *   그리려고 **플랫폼 전체의 행**을 받아 왔다는 뜻이다 — 느린 것은 물론이고 남의
 *   지사 설정이 이 서버의 메모리까지 들어왔다. org_id 로 좁힌다.
 */
const orgOverrides = cache(async function orgOverrides(
  partnerId: string
): Promise<Overrides> {
  const ids = (await liveOrgs(partnerId)).map((o) => o.id);

  const [switches, pins] = await Promise.all([
    all<{ org_id: string; feature_code: string; enabled: boolean }>(
      "org_feature_switches",
      "org_id,feature_code,enabled",
      [["in", "org_id", ids]],
      ["org_id", "feature_code"]
    ),
    all<{ org_id: string; tool_key: string; pinned: boolean }>(
      "org_tool_pins",
      "org_id,tool_key,pinned",
      [["in", "org_id", ids]],
      ["org_id", "tool_key"]
    ),
  ]);

  const sw = new Map<string, boolean>();
  for (const s of switches) sw.set(`${s.org_id}|${s.feature_code}`, s.enabled);
  const pn = new Map<string, boolean>();
  for (const p of pins) pn.set(`${p.org_id}|${p.tool_key}`, p.pinned);
  return { sw, pn };
});

/** 도구 한 줄분의 전체값 — 기관 수만큼 다시 계산하지 않도록 미리 펴 둔다. */
type Baseline = {
  tool: OrgTool;
  pEnabled: boolean;
  pPinned: boolean;
  pState: ToolState;
};

function baselines(base: PartnerBase): Baseline[] {
  return ORG_TOOLS.map((tool) => {
    const pEnabled = base.enabled(tool);
    const pPinned = base.pinned(tool);
    return { tool, pEnabled, pPinned, pState: toState(pEnabled, pPinned) };
  });
}

/** 이 기관에 실제로 적용되는 값. */
function stateFor(b: Baseline, orgId: string, ov: Overrides): ToolState {
  const e = b.tool.featureCode
    ? (ov.sw.get(`${orgId}|${b.tool.featureCode}`) ?? b.pEnabled)
    : true;
  const p = ov.pn.get(`${orgId}|${b.tool.key}`) ?? b.pPinned;
  return toState(e, p);
}

function has(base: PartnerBase, tool: OrgTool): boolean {
  return tool.featureCode ? base.owned.has(tool.featureCode) : true;
}

/* -------------------------------------------------------------------------- */
/* 전체 기관                                                                   */
/* -------------------------------------------------------------------------- */

export async function loadPartnerToolBoard(
  partnerId: string
): Promise<ToolRow[]> {
  const [base, orgs, ov] = await Promise.all([
    partnerBase(partnerId),
    liveOrgs(partnerId),
    orgOverrides(partnerId),
  ]);

  return baselines(base).map((b) => {
    // 이 도구를 전체값과 **다르게** 둔 기관 수 — 행이 있는지가 아니라 값이 다른지.
    let differs = 0;
    for (const o of orgs) {
      if (stateFor(b, o.id, ov) !== b.pState) differs++;
    }
    return {
      tool: b.tool,
      state: b.pState,
      partnerState: b.pState,
      partnerHas: has(base, b.tool),
      differs,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* 기관 하나                                                                   */
/* -------------------------------------------------------------------------- */

export async function loadOrgToolBoard(
  orgId: string,
  partnerId: string
): Promise<ToolRow[]> {
  const [base, switches, pins] = await Promise.all([
    partnerBase(partnerId),
    all<{ feature_code: string; enabled: boolean }>(
      "org_feature_switches",
      "feature_code,enabled",
      [["eq", "org_id", orgId]],
      ["feature_code"]
    ),
    all<{ tool_key: string; pinned: boolean }>(
      "org_tool_pins",
      "tool_key,pinned",
      [["eq", "org_id", orgId]],
      ["tool_key"]
    ),
  ]);

  const ov: Overrides = { sw: new Map(), pn: new Map() };
  for (const s of switches) ov.sw.set(`${orgId}|${s.feature_code}`, s.enabled);
  for (const p of pins) ov.pn.set(`${orgId}|${p.tool_key}`, p.pinned);

  return baselines(base).map((b) => {
    const state = stateFor(b, orgId, ov);
    return {
      tool: b.tool,
      state,
      partnerState: b.pState,
      partnerHas: has(base, b.tool),
      differs: state === b.pState ? 0 : 1,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* 맨 위 대상 고르개                                                           */
/* -------------------------------------------------------------------------- */

/** 대상 고르개에 쓸 기관 목록 + 각 기관이 전체값에서 벗어난 항목 수. */
export async function loadScopeOptions(
  partnerId: string
): Promise<ScopeOption[]> {
  const [base, orgs, ov] = await Promise.all([
    partnerBase(partnerId),
    liveOrgs(partnerId),
    orgOverrides(partnerId),
  ]);

  const events = await all<{ org_id: string; status: string }>(
    "org_events",
    "org_id,status",
    [["in", "org_id", orgs.map((o) => o.id)]],
    ["id"]
  );

  // 기관 → 행사 상태별 개수
  const byOrg = new Map<string, Record<string, number>>();
  for (const e of events) {
    let m = byOrg.get(e.org_id);
    if (!m) byOrg.set(e.org_id, (m = {}));
    m[e.status] = (m[e.status] ?? 0) + 1;
  }
  const phaseOf = (orgId: string): { phase: OrgPhase; eventCount: number } => {
    const m = byOrg.get(orgId);
    if (!m) return { phase: "NONE", eventCount: 0 };
    for (const p of ["LIVE", "DRAFT", "ENDED", "ARCHIVED"] as const) {
      if (m[p]) return { phase: p, eventCount: m[p] };
    }
    return { phase: "NONE", eventCount: 0 };
  };

  const bs = baselines(base);

  return orgs
    .map((o) => {
      let differsCount = 0;
      for (const b of bs) {
        if (stateFor(b, o.id, ov) !== b.pState) differsCount++;
      }
      return {
        orgId: o.id,
        orgName: o.org_name,
        differsCount,
        ...phaseOf(o.id),
      };
    })
    .sort((a, b) => a.orgName.localeCompare(b.orgName, "ko"));
}
