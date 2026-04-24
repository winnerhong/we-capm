import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { OrgAccountMenu } from "./org-account-menu";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const org = await requireOrg();

  if (org.orgId !== orgId) {
    redirect("/manager");
  }

  const supabase = await createClient();
  const { data: orgRow } = await (supabase
    .from("partner_orgs" as never) as any)
    .select("id, org_name")
    .eq("id", orgId)
    .maybeSingle();

  const orgName: string = orgRow?.org_name ?? org.orgName ?? "기관";

  return (
    <div className="min-h-dvh bg-[#FFF8F0]">
      <header className="sticky top-0 z-30 border-b border-[#D4E4BC] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href={`/org/${orgId}`}
            className="flex items-center gap-2 font-extrabold text-[#2D5A3D]"
          >
            <span className="text-xl" aria-hidden>
              🌿
            </span>
            <span className="text-sm sm:text-base">{orgName}</span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              href={`/org/${orgId}/programs`}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              🗂️ 내 프로그램
            </Link>
            <Link
              href={`/org/${orgId}/trails`}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              🗺️ 숲길
            </Link>
            <Link
              href={`/org/${orgId}/events`}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              🎪 행사
            </Link>
            <Link
              href={`/org/${orgId}/documents`}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
            >
              📄 서류
            </Link>
            <Link
              href={`/org/${orgId}/control-room`}
              className="rounded-xl border border-[#5EE9F0]/40 px-3 py-2 text-sm font-semibold text-[#0891A8] hover:bg-[#E6FAFB]"
              style={{ textShadow: "0 0 6px rgba(94,233,240,0.35)" }}
            >
              🎛️ 관제실
            </Link>
            <Link
              href={`/org/${orgId}/users`}
              className="rounded-xl bg-[#2D5A3D] px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#3A7A52]"
            >
              ➕ 참가자
            </Link>
          </nav>

          <OrgAccountMenu orgId={orgId} orgName={orgName} />
        </div>

        {/* Mobile nav */}
        <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 pb-2 sm:hidden">
          <Link
            href={`/org/${orgId}/programs`}
            className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            🗂️ 내 프로그램
          </Link>
          <Link
            href={`/org/${orgId}/trails`}
            className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            🗺️ 숲길
          </Link>
          <Link
            href={`/org/${orgId}/events`}
            className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            🎪 행사
          </Link>
          <Link
            href={`/org/${orgId}/documents`}
            className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
          >
            📄 서류
          </Link>
          <Link
            href={`/org/${orgId}/control-room`}
            className="shrink-0 rounded-xl border border-[#5EE9F0]/40 px-3 py-1.5 text-xs font-semibold text-[#0891A8] hover:bg-[#E6FAFB]"
          >
            🎛️ 관제실
          </Link>
          <Link
            href={`/org/${orgId}/users`}
            className="shrink-0 rounded-xl bg-[#2D5A3D] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#3A7A52]"
          >
            ➕ 참가자
          </Link>
        </nav>
      </header>

      <main>{children}</main>
    </div>
  );
}
