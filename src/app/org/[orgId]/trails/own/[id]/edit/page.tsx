import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgTrailById } from "@/lib/trails/queries";
import { OwnTrailForm } from "../../../own/own-trail-form";

export const dynamic = "force-dynamic";

export default async function EditOrgTrailPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>;
}) {
  const { orgId, id } = await params;
  const session = await requireOrg();

  const trail = await loadOrgTrailById(id);
  if (!trail) notFound();
  if (trail.org_id !== session.orgId) {
    redirect(`/org/${orgId}/trails`);
  }

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
        <span className="font-semibold text-[#2D5A3D]">코스 편집</span>
      </nav>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#2D5A3D]">
          <span aria-hidden>🗺️</span>
          <span>자체 코스 편집</span>
        </h1>
        <p className="mt-2 text-sm text-[#6B6560]">
          코스 내용을 수정하거나 삭제할 수 있어요.
        </p>
      </header>

      <OwnTrailForm
        orgId={orgId}
        trail={{
          id: trail.id,
          name: trail.name,
          description: trail.description,
          cover_image_url: trail.cover_image_url,
        }}
      />
    </div>
  );
}
