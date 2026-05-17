import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgMembers } from "@/lib/org-members/queries";
import { OrgMembersClient } from "./org-members-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function OrgMembersPage({ params }: PageProps) {
  const session = await requireOrg();
  const { orgId } = await params;

  // URL 의 orgId 와 세션 orgId 가 다르면 본인 페이지로 리다이렉트.
  if (orgId !== session.orgId) {
    redirect(`/org/${session.orgId}/members`);
  }

  const data = await loadOrgMembers(orgId);
  const basePath = `/org/${orgId}`;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <nav className="text-xs text-[#6B6560]">
        <Link href={basePath} className="hover:underline">
          {session.orgName}
        </Link>
        {" / "}
        <span className="font-semibold text-[#2D5A3D]">가족 명단</span>
      </nav>

      <header>
        <h1 className="text-xl font-bold text-[#2D5A3D]">
          👨‍👩‍👧 가족 명단
        </h1>
        <p className="mt-1 text-xs text-[#6B6560]">
          우리 어린이집에 가입한 보호자와 자녀를 한눈에 봅니다.
          반·이름·연락처로 검색하고 CSV로 내보낼 수 있어요.
        </p>
      </header>

      <OrgMembersClient data={data} basePath={basePath} />
    </main>
  );
}
