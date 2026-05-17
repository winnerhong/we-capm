import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadOrgMembers } from "@/lib/org-members/queries";
import { AdminMembersClient } from "./admin-members-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminOrgMembersPage({ params }: PageProps) {
  await requireAdmin();
  const { id: orgId } = await params;

  // 조직 이름 확인 — 헤더 표시 + 존재 검증
  const supabase = await createClient();
  const orgResp = (await (
    supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { id: string; org_name: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .select("id, org_name")
    .eq("id", orgId)
    .maybeSingle()) as {
    data: { id: string; org_name: string } | null;
    error: { message: string } | null;
  };

  if (!orgResp.data) notFound();

  const data = await loadOrgMembers(orgId);
  const basePath = `/admin/orgs/${orgId}`;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <nav className="text-xs text-[#6B6560]">
        <Link href="/admin/orgs" className="hover:underline">
          기관 목록
        </Link>
        {" / "}
        <Link href={basePath} className="hover:underline">
          {orgResp.data.org_name}
        </Link>
        {" / "}
        <span className="font-semibold text-[#2D5A3D]">가족 명단</span>
      </nav>

      <header>
        <h1 className="text-xl font-bold text-[#2D5A3D]">
          👨‍👩‍👧 {orgResp.data.org_name} · 가족 명단
        </h1>
        <p className="mt-1 text-xs text-[#6B6560]">
          가입한 보호자와 자녀를 한눈에 보고, 행 클릭으로 상세를 확인하세요
        </p>
      </header>

      <AdminMembersClient orgId={orgId} data={data} basePath={basePath} />
    </main>
  );
}
