"use client";

// org 매니저 컨텍스트로 MemberListView 를 마운트하는 얇은 wrapper.
//  - detailLoader 에 org-scope server action 을 wire (본인 orgId 만)
//  - canImpersonate=false (org 매니저는 다른 보호자 임퍼소네이트 불가)

import { useCallback } from "react";
import { MemberListView } from "@/components/org-members/member-list-view";
import type { OrgMembersResult } from "@/lib/org-members/queries";
import { loadOrgMemberDetailForOrgAction } from "./actions";

type Props = {
  data: OrgMembersResult;
  basePath: string;
};

export function OrgMembersClient({ data, basePath }: Props) {
  const detailLoader = useCallback(
    (userId: string) => loadOrgMemberDetailForOrgAction(userId),
    []
  );
  return (
    <MemberListView
      families={data.families}
      classOptions={data.classOptions}
      totalChildren={data.totalChildren}
      totalEnrolled={data.totalEnrolled}
      basePath={basePath}
      canImpersonate={false}
      detailLoader={detailLoader}
    />
  );
}
