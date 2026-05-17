// 쿠폰 템플릿 관리 — 기관이 자주 쓰는 선물(예: GS25 5천원) 을 미리 저장.
// 저장된 템플릿은 수동 발급(/gifts/grant) 과 관제실 인라인 발급에서 셀렉트로 불러옴.

import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgGiftTemplates } from "@/lib/gifts/queries";
import { GiftTemplateManager } from "./gift-template-manager";

export const dynamic = "force-dynamic";

export default async function OrgGiftTemplatesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrg();

  // 보관(archive) 된 것까지 함께 가져와 같은 화면에서 토글 가능.
  const templates = await loadOrgGiftTemplates(orgId, {
    includeArchived: true,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/gifts`}
          className="hover:text-[#2D5A3D]"
        >
          선물함 모아보기
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">쿠폰 만들기</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#FFF8F0] via-white to-[#FAE7D0] p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden>
            🎟️
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D]">쿠폰 만들기</h1>
            <p className="mt-1 text-xs text-[#6B6560]">
              자주 보내는 선물을 미리 저장해 두면, 수동 발급·관제실 인라인 발급
              화면에서 한 번 클릭으로 폼이 채워져요.
            </p>
          </div>
        </div>
      </header>

      <GiftTemplateManager orgId={orgId} initialTemplates={templates} />
    </div>
  );
}
