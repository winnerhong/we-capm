"use client";

// admin 컨텍스트로 MemberListView 를 마운트하는 얇은 wrapper.
//  - detailLoader 에 관리자 권한용 server action 을 wire
//  - canImpersonate=true (admin 만 임퍼소네이트 가능)

import { useCallback } from "react";
import { MemberListView } from "@/components/org-members/member-list-view";
import type { OrgMembersResult } from "@/lib/org-members/queries";
import { loadOrgMemberDetailForAdminAction } from "./actions";

type Props = {
  orgId: string;
  data: OrgMembersResult;
  basePath: string;
};

export function AdminMembersClient({ orgId, data, basePath }: Props) {
  const detailLoader = useCallback(
    (userId: string) => loadOrgMemberDetailForAdminAction(orgId, userId),
    [orgId]
  );
  return (
    <MemberListView
      families={data.families}
      classOptions={data.classOptions}
      totalChildren={data.totalChildren}
      totalEnrolled={data.totalEnrolled}
      basePath={basePath}
      canImpersonate
      detailLoader={detailLoader}
    />
  );
}
