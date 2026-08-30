// 초대장 인사말/내용 템플릿 관리 — 자주 쓰는 문구 미리 저장.
// 행사 편집 폼의 초대장 섹션에서 셀렉터로 불러옴.

import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgInvitationTemplates } from "@/lib/invitation-templates/queries";
import { OrgSectionTabs } from "../../_nav/org-section-tabs";
import { InvitationTemplateManager } from "./invitation-template-manager";

export const dynamic = "force-dynamic";

export default async function OrgInvitationTemplatesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrg();

  const templates = await loadOrgInvitationTemplates(orgId, {
    includeArchived: true,
  });

  const liveCount = templates.filter((t) => !t.is_archived).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <OrgSectionTabs
        orgId={orgId}
        active="templates"
        templateCount={liveCount}
      />

      <header className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden>
          📨
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
            초대장 템플릿
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-[#6B6560] md:text-sm">
            자주 쓰는 인사말을 저장해 두면 매번 다시 쓰지 않아도 돼요.
          </p>
        </div>
      </header>

      <InvitationTemplateManager orgId={orgId} initialTemplates={templates} />
    </div>
  );
}
