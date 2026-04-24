import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { bulkImportAppUsersAction } from "./actions";
import { BulkImportForm } from "./csv-preview";

export const dynamic = "force-dynamic";

export default async function OrgUsersBulkImportPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const session = await requireOrg();

  // Bind orgId into server action (partial application)
  const action = bulkImportAppUsersAction.bind(null, orgId);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/users`}
          className="hover:text-[#2D5A3D]"
        >
          참가자 관리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">일괄 등록</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🌱
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              참가자 일괄 등록
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              🔑 <b>아이디 = 전화번호</b> · 같은 번호는 한 계정으로 묶여요
            </p>
          </div>
        </div>
      </header>


      {/* 폼 + 미리보기 (클라이언트) */}
      <BulkImportForm orgId={orgId} action={action} />

      <div className="text-center">
        <Link
          href={`/org/${orgId}/users`}
          className="text-xs text-[#6B6560] hover:text-[#2D5A3D]"
        >
          ← 참가자 목록으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
