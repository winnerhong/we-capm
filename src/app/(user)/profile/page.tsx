import Link from "next/link";
import { requireAppUser } from "@/lib/user-auth-guard";
import {
  getAcornBalance,
  loadAppUserById,
  loadChildrenForUser,
} from "@/lib/app-user/queries";
import { AcornIcon } from "@/components/acorn-icon";
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
  const [detail, children, acornBalance] = await Promise.all([
    loadAppUserById(session.id),
    loadChildrenForUser(session.id),
    getAcornBalance(session.id),
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

      {/* 도토리 / 선물함 바로가기 */}
      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/acorns"
          className="group rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition hover:border-[#3A7A52] hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FAE7D0] text-2xl"
              aria-hidden
            >
              <AcornIcon size={24} />
            </span>
            <span
              className="text-[10px] font-bold text-[#8B7F75] transition group-hover:text-[#2D5A3D]"
              aria-hidden
            >
              →
            </span>
          </div>
          <p className="mt-3 text-[11px] font-bold text-[#6B6560]">
            내 도토리
          </p>
          <p className="mt-0.5 flex items-baseline gap-1 font-mono text-2xl font-black tabular-nums text-[#2D5A3D]">
            {acornBalance}
            <span className="text-[11px] font-bold text-[#8B7F75]">개</span>
          </p>
          <p className="mt-1 text-[10px] text-[#8B7F75]">내역 보기 →</p>
        </Link>

        <Link
          href="/gifts"
          className="group rounded-3xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition hover:border-[#3A7A52] hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-2xl"
              aria-hidden
            >
              🎁
            </span>
            <span
              className="text-[10px] font-bold text-[#8B7F75] transition group-hover:text-[#2D5A3D]"
              aria-hidden
            >
              →
            </span>
          </div>
          <p className="mt-3 text-[11px] font-bold text-[#6B6560]">
            선물함
          </p>
          <p className="mt-0.5 text-base font-bold text-[#2D5A3D]">
            받은 선물 모아보기
          </p>
          <p className="mt-1 text-[10px] text-[#8B7F75]">QR 수령 →</p>
        </Link>
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
