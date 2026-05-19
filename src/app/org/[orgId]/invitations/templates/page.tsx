// 초대장 인사말/내용 템플릿 관리 — 자주 쓰는 문구 미리 저장.
// 행사 편집 폼의 초대장 섹션에서 셀렉터로 불러옴.

import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgInvitationTemplates } from "@/lib/invitation-templates/queries";
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">초대장 템플릿</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-emerald-50/60 via-white to-[#FAE7D0]/40 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden>
            📨
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D]">
              초대장 템플릿
            </h1>
            <p className="mt-1 text-xs text-[#6B6560]">
              자주 쓰는 인사말·초대장 내용을 미리 저장해 두면, 행사 편집 폼의
              초대장 섹션에서 한 번 클릭으로 폼이 채워져요.
            </p>
          </div>
        </div>
      </header>

      <InvitationTemplateManager orgId={orgId} initialTemplates={templates} />
    </div>
  );
}
