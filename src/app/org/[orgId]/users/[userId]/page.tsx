import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { UserRowActions } from "../user-row-actions";
import { AcornIcon } from "@/components/acorn-icon";

export const dynamic = "force-dynamic";

type UserStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

type AppUserRow = {
  id: string;
  phone: string;
  parent_name: string;
  org_id: string;
  acorn_balance: number;
  status: UserStatus;
  last_login_at: string | null;
  created_at: string;
};

type ChildRow = {
  id: string;
  name: string;
  birth_date: string | null;
};

type SbErr = { message: string } | null;
type SbOne<T> = { data: T | null; error: SbErr };
type SbMany<T> = { data: T[] | null; error: SbErr };

const STATUS_META: Record<
  UserStatus,
  { label: string; chip: string }
> = {
  ACTIVE: {
    label: "활성",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  SUSPENDED: {
    label: "정지",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
  },
  CLOSED: {
    label: "해지",
    chip: "bg-zinc-100 text-zinc-600 border-zinc-200",
  },
};

function formatPhone(digitsOrFormatted: string): string {
  const digits = (digitsOrFormatted ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digitsOrFormatted;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
}

async function loadUserAndChildren(userId: string): Promise<{
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
    .select(
      "id, phone, parent_name, org_id, acorn_balance, status, last_login_at, created_at"
    )
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
    .select("id, name, birth_date")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })) as SbMany<ChildRow>;

  return {
    user: userResp.data,
    children: childrenResp.data ?? [],
  };
}

export default async function OrgUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; userId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { orgId, userId } = await params;
  const sp = await searchParams;
  await requireOrg();

  const { user, children } = await loadUserAndChildren(userId);
  if (!user || user.org_id !== orgId) notFound();

  const status = STATUS_META[user.status] ?? STATUS_META.ACTIVE;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
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
        <span className="font-semibold text-[#2D5A3D]">
          {user.parent_name}
        </span>
      </nav>

      {/* Saved banner */}
      {sp.saved === "1" && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          ✅ 변경사항이 저장되었어요.
        </div>
      )}

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              🙋
            </span>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold text-[#2D5A3D] md:text-2xl">
                <span>{user.parent_name}</span>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.chip}`}
                >
                  {status.label}
                </span>
              </h1>
              <p className="mt-1 font-mono text-xs text-[#6B6560] md:text-sm">
                📞 {formatPhone(user.phone)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <UserRowActions
              orgId={orgId}
              userId={user.id}
              userName={user.parent_name}
              status={user.status}
              variant="table"
            />
          </div>
        </div>
      </header>

      {/* 기본 정보 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📋</span>
          <span>기본 정보</span>
        </h2>
        <dl className="grid grid-cols-1 gap-y-3 gap-x-6 text-sm md:grid-cols-2">
          <InfoRow label="핸드폰 (로그인 아이디)">
            <span className="font-mono text-[#2D5A3D]">
              {formatPhone(user.phone)}
            </span>
          </InfoRow>
          <InfoRow label="도토리 잔액">
            <span className="font-bold text-[#6B4423]">
              <AcornIcon /> {user.acorn_balance.toLocaleString("ko-KR")}
            </span>
          </InfoRow>
          <InfoRow label="상태">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.chip}`}
            >
              {status.label}
            </span>
          </InfoRow>
          <InfoRow label="최근 로그인">
            <span className="text-[#6B6560]">
              {formatDateTime(user.last_login_at)}
            </span>
          </InfoRow>
          <InfoRow label="가입일">
            <span className="text-[#6B6560]">
              {formatDateTime(user.created_at)}
            </span>
          </InfoRow>
        </dl>
      </section>

      {/* 자녀 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🧒</span>
            <span>자녀 ({children.length}명)</span>
          </h2>
          <Link
            href={`/org/${orgId}/users/${userId}/edit`}
            className="rounded-lg border border-[#E5D3B8] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#6B4423] hover:bg-[#FFF8F0]"
          >
            ✏️ 자녀 관리
          </Link>
        </div>
        {children.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E5D3B8] bg-[#FFFDF8] p-6 text-center text-xs text-[#8B7F75]">
            등록된 자녀가 없어요.
          </div>
        ) : (
          <ul className="space-y-2">
            {children.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-[#F0E8D8] bg-[#FFFDF8] px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg" aria-hidden>
                    🧒
                  </span>
                  <span className="font-semibold text-[#2D5A3D]">
                    {c.name}
                  </span>
                </div>
                <span className="text-xs text-[#6B6560]">
                  🎂 {formatDate(c.birth_date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* CTA */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/org/${orgId}/users`}
          className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
        >
          ← 목록으로
        </Link>
        <div className="flex flex-wrap gap-2">
          {user.status === "ACTIVE" && (
            <a
              href={`/api/org/impersonate-user?id=${user.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-100"
            >
              🔑 이 참가자로 로그인↗
            </a>
          )}
          <Link
            href={`/org/${orgId}/users/${userId}/edit`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D]"
          >
            <span aria-hidden>✏️</span>
            <span>편집</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-dashed border-[#F4EFE8] pb-2 md:border-b-0 md:pb-0">
      <dt className="text-[11px] font-semibold text-[#8B7F75]">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
