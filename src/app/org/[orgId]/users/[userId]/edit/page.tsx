import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { EditUserForm } from "./edit-form";

export const dynamic = "force-dynamic";

type UserStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

type AppUserRow = {
  id: string;
  phone: string;
  parent_name: string;
  org_id: string;
  status: UserStatus;
};

type ChildRow = {
  id: string;
  name: string;
  birth_date: string | null;
  is_enrolled: boolean;
};

type SbErr = { message: string } | null;
type SbOne<T> = { data: T | null; error: SbErr };
type SbMany<T> = { data: T[] | null; error: SbErr };

async function loadUser(userId: string): Promise<{
  user: AppUserRow | null;
  children: ChildRow[];
}> {
  const supabase = await createClient();

  const userResp = (await (
    supabase.from("app_users" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<SbOne<AppUserRow>>;
        };
      };
    }
  )
    .select("id, phone, parent_name, org_id, status")
    .eq("id", userId)
    .maybeSingle()) as SbOne<AppUserRow>;

  if (!userResp.data) return { user: null, children: [] };

  const childrenResp = (await (
    supabase.from("app_children" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<SbMany<ChildRow>>;
        };
      };
    }
  )
    .select("id, name, birth_date, is_enrolled")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })) as SbMany<ChildRow>;

  return {
    user: userResp.data,
    children: childrenResp.data ?? [],
  };
}

export default async function OrgUserEditPage({
  params,
}: {
  params: Promise<{ orgId: string; userId: string }>;
}) {
  const { orgId, userId } = await params;
  await requireOrg();

  const { user, children } = await loadUser(userId);
  if (!user || user.org_id !== orgId) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/org/${orgId}/users`} className="hover:text-[#2D5A3D]">
          참가자 관리
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/users/${userId}`}
          className="hover:text-[#2D5A3D]"
        >
          {user.parent_name}
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">편집</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            ✏️
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              참가자 편집
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              보호자 이름, 상태, 자녀 정보를 수정할 수 있어요.
            </p>
          </div>
        </div>
      </header>

      <EditUserForm
        orgId={orgId}
        userId={userId}
        initialParentName={user.parent_name}
        initialStatus={user.status}
        phone={user.phone}
        children={children}
      />
    </div>
  );
}
