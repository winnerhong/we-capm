"use server";

// 기관 매니저 전용 — 가족 상세 fetch.
//  - requireOrg → 본인 orgId 만 접근. 다른 기관 데이터는 차단.

import { requireOrg } from "@/lib/org-auth-guard";
import {
  loadOrgMemberDetail,
  type OrgMemberDetail,
} from "@/lib/org-members/queries";

export async function loadOrgMemberDetailForOrgAction(
  userId: string
): Promise<
  { ok: true; detail: OrgMemberDetail } | { ok: false; error: string }
> {
  try {
    const session = await requireOrg();
    if (!userId) return { ok: false, error: "잘못된 요청이에요" };
    const detail = await loadOrgMemberDetail(session.orgId, userId);
    if (!detail) return { ok: false, error: "가족을 찾을 수 없어요" };
    return { ok: true, detail };
  } catch (e) {
    console.error("[org/members/detail] threw", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "불러오기 실패",
    };
  }
}
