"use server";

// 관리자 전용 — 가족 상세 fetch (Drawer 마운트 시 호출).
//  - 모든 조직에 대해 접근 가능 (admin 권한)
//  - orgId 는 URL 의 [id] 로 받음 (검증 통과한 path)

import { requireAdmin } from "@/lib/auth-guard";
import {
  loadOrgMemberDetail,
  type OrgMemberDetail,
} from "@/lib/org-members/queries";

export async function loadOrgMemberDetailForAdminAction(
  orgId: string,
  userId: string
): Promise<
  { ok: true; detail: OrgMemberDetail } | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    if (!orgId || !userId) {
      return { ok: false, error: "잘못된 요청이에요" };
    }
    const detail = await loadOrgMemberDetail(orgId, userId);
    if (!detail) return { ok: false, error: "가족을 찾을 수 없어요" };
    return { ok: true, detail };
  } catch (e) {
    console.error("[admin/orgs/members/detail] threw", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "불러오기 실패",
    };
  }
}
