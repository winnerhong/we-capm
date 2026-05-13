import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { OwnTrailForm } from "../own-trail-form";

export const dynamic = "force-dynamic";

export default async function NewOrgTrailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrg();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <nav className="mb-4 text-xs text-[#6B6560]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관홈
        </Link>
        <span className="mx-1">›</span>
        <Link href={`/org/${orgId}/trails`} className="hover:text-[#2D5A3D]">
          My 코스관리
        </Link>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">자체 코스 등록</span>
      </nav>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#2D5A3D]">
          <span aria-hidden>🗺️</span>
          <span>자체 코스 등록</span>
        </h1>
        <p className="mt-2 text-sm text-[#6B6560]">
          기관에서 직접 코스를 만들어 등록하세요. 이미지·제목·설명만 입력하면 됩니다.
        </p>
      </header>

      <OwnTrailForm orgId={orgId} />
    </div>
  );
}
