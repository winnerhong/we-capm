// server-only: 기관별 기능 온오프 조회.
//
// 열쇠가 둘이다:
//   지사가 보유(partner_feature_grants) AND 기관 스위치 ON(org_feature_switches)
// 둘 다여야 쓸 수 있다. DB 쪽은 org_feature_flags(org_id) 함수 한 번으로 끝난다
// (마이그레이션 20260831000000).
//
// ⚠ 실패하면 **전부 켜진 것으로 본다(fail open)**.
//   이 파일을 쓰는 곳은 메뉴·탭·페이지 가드다. 조회가 실패했을 때 꺼진 것으로
//   처리하면 DB 가 잠깐 흔들리거나 마이그레이션 전에 배포된 순간 앱 전체가
//   빈 화면이 된다. 기능이 잠깐 더 보이는 쪽이 압도적으로 안전하다.
//   (반대로 서버 액션의 requireOrgFeature 는 같은 이유로 fail open 이면 안
//    되냐고 할 수 있는데, 거기도 열어 둔다 — 스위치는 과금·보안 경계가 아니라
//    "이 기관은 이 기능을 안 쓴다" 는 운영 설정이다. 권한 검사는 별도로 이미
//    requireOrg/requireEventContext 가 한다.)

import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { reportQueryFailure } from "@/lib/supabase/schema-gap";

export type OrgFeatureFlag = {
  code: string;
  /** 기관 스위치. 행이 없으면 platform_features.org_default_on 값. */
  onForOrg: boolean;
  /** 지사가 이 기능을 보유 중인가. */
  partnerHas: boolean;
  /** 실제로 쓸 수 있는가 = onForOrg && partnerHas */
  available: boolean;
};

export type OrgFeatureMap = {
  /** 조회에 성공했나. false 면 전부 available=true 로 채워져 있다. */
  loaded: boolean;
  byCode: Record<string, OrgFeatureFlag>;
};

/** 조회 실패 시의 지도 — 무엇을 물어봐도 "쓸 수 있다". */
export const OPEN_FEATURE_MAP: OrgFeatureMap = { loaded: false, byCode: {} };

type FlagRow = {
  code: string;
  on_for_org: boolean;
  partner_has: boolean;
};

/**
 * 기관 하나의 기능 상태 전부. **한 요청에 왕복 한 번.**
 *
 * cache() 로 감싼 이유 — 여기 달린 옛 주석은 "화면 하나에서 여러 번 부르지 말
 * 것" 이었는데, 실제로는 그렇게 되지 않았다. 기관 홈 한 장을 계측해 보니 같은
 * orgId 로 **세 번** 나갔다:
 *   layout → loadTopMenuTools · OrgSectionTabs · AllToolsCard
 * 셋은 서로를 모르는 남남이고, 알게 만들면 orgId 옆에 flags 를 끌고 다니는
 * prop 이 화면마다 늘어난다. 주의로 지킬 수 없는 규칙은 도구로 지킨다.
 *
 * 유효 범위는 **요청 하나**다. 요청이 끝나면 같이 버려지므로, 지사가 스위치를
 * 바꾼 다음 요청은 새 값을 읽는다.
 */
export const loadOrgFeatureFlags = cache(async function loadOrgFeatureFlags(
  orgId: string
): Promise<OrgFeatureMap> {
  if (!orgId) return OPEN_FEATURE_MAP;

  try {
    const supabase = await createClient();
    const { data, error } = await (
      supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, string>
        ) => Promise<{ data: FlagRow[] | null; error: unknown }>;
      }
    ).rpc("org_feature_flags", { p_org_id: orgId });

    if (error || !data) {
      reportQueryFailure(
        "org_feature_flags",
        "20260831000000_org_feature_switches.sql",
        error
      );
      return OPEN_FEATURE_MAP;
    }

    const byCode: Record<string, OrgFeatureFlag> = {};
    for (const r of data) {
      byCode[r.code] = {
        code: r.code,
        onForOrg: r.on_for_org,
        partnerHas: r.partner_has,
        available: r.on_for_org && r.partner_has,
      };
    }
    return { loaded: true, byCode };
  } catch (e) {
    reportQueryFailure(
      "org_feature_flags",
      "20260831000000_org_feature_switches.sql",
      e
    );
    return OPEN_FEATURE_MAP;
  }
});

/**
 * 이 기능을 쓸 수 있나.
 *
 * 모르는 코드(카탈로그에 없는 것)는 **켜진 것으로 본다.** 아직 등재하지 않은
 * 기능을 코드에서 참조했을 때 조용히 사라지는 것보다, 그대로 보이는 쪽이 낫다.
 */
export function canUse(map: OrgFeatureMap, code: string): boolean {
  if (!map.loaded) return true;
  const f = map.byCode[code];
  return f ? f.available : true;
}

/** 왜 못 쓰는지 — 기관 담당자에게 보여줄 한 줄. 쓸 수 있으면 null. */
export function lockReason(map: OrgFeatureMap, code: string): string | null {
  if (!map.loaded) return null;
  const f = map.byCode[code];
  if (!f || f.available) return null;
  return f.partnerHas
    ? "지사에서 꺼둔 기능이에요"
    : "지사가 아직 도입하지 않은 기능이에요";
}

/** 한 기능만 확인해야 할 때(서버 액션 등). 화면에서는 loadOrgFeatureFlags 를 쓸 것. */
export async function isOrgFeatureOn(
  orgId: string,
  code: string
): Promise<boolean> {
  const map = await loadOrgFeatureFlags(orgId);
  return canUse(map, code);
}

export class OrgFeatureOffError extends Error {
  code: string;
  constructor(code: string) {
    super("이 기관에서 사용하지 않는 기능이에요");
    this.name = "OrgFeatureOffError";
    this.code = code;
  }
}

/**
 * 서버 액션 가드. 화면만 감추면 주소창·직접 호출로 그대로 뚫린다.
 */
export async function requireOrgFeature(
  orgId: string,
  code: string
): Promise<void> {
  const ok = await isOrgFeatureOn(orgId, code);
  if (!ok) throw new OrgFeatureOffError(code);
}
