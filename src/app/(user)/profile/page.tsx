import { requireAppUser } from "@/lib/user-auth-guard";
import {
  loadAppUserById,
  loadChildrenForUser,
} from "@/lib/app-user/queries";
import { ChildrenSection } from "./children-section";

export const dynamic = "force-dynamic";

function formatPhone(raw: string): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

function initialOf(name: string): string {
  const t = (name ?? "").trim();
  return t ? t.charAt(0) : "🌱";
}

export default async function UserProfilePage() {
  const session = await requireAppUser();
  const [detail, children] = await Promise.all([
    loadAppUserById(session.id),
    loadChildrenForUser(session.id),
  ]);

  const parentName = detail?.parent_name ?? session.parentName;
  const phoneFull = formatPhone(detail?.phone ?? session.phone);

  // 원생(is_enrolled) 자녀 중 첫 아이 이름 → "{이름} 학부모님" 표시
  const enrolledChild = children.find((c) => c.is_enrolled);
  const heroTitle = enrolledChild
    ? `${enrolledChild.name} 학부모님`
    : `${parentName || "보호자"}님`;
  const heroInitial = enrolledChild
    ? initialOf(enrolledChild.name)
    : initialOf(parentName);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 shadow-lg">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 text-2xl font-bold text-white backdrop-blur-sm"
            aria-hidden
          >
            {heroInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-[#D4E4BC]">
              {session.orgName || "소속 기관"}
            </p>
            <p className="mt-0.5 truncate text-lg font-bold text-white">
              {heroTitle}
            </p>
            <p className="mt-0.5 font-mono text-xs text-[#D4E4BC]">
              {phoneFull}
            </p>
          </div>
        </div>
      </section>

      {/* 우리 아이들 */}
      <ChildrenSection children={children} />

      {/* 계정 관리 */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-[#2D5A3D]">계정 관리</h2>
        <form action="/api/auth/user-logout" method="post" className="mt-3">
          <button
            type="submit"
            className="min-h-[44px] w-full rounded-2xl border border-rose-200 bg-white py-3 text-sm font-bold text-rose-700 shadow-sm transition hover:bg-rose-50"
          >
            🚪 로그아웃
          </button>
        </form>
      </section>
    </div>
  );
}
