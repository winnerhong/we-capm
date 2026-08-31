// 초대장 인사말/내용 템플릿 관리 — 자주 쓰는 문구 미리 저장.
// 행사 편집 폼의 초대장 섹션에서 셀렉터로 불러옴.
//
// 상단 탭에는 없다. 행사 안 [초대장 → 템플릿] 이 같은 화면을 같은 옵션으로
// 그리므로 탭 줄에 또 걸면 같은 것이 두 번 있는 셈이다. 이 주소를 남겨 둔 이유는
// 템플릿이 **기관 단위 자산**이라서다 — 행사가 하나도 없는 기관도 미리 만들어
// 둘 수 있어야 하는데, 행사 안에만 두면 그 길이 막힌다.
// 들어오는 길: 기관 홈 「모든 기능」 → [✉️ 초대장 템플릿].

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
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">

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
