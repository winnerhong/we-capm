import Link from "next/link";
import { requireAppUser } from "@/lib/user-auth-guard";
import { getAcornBalance } from "@/lib/app-user/queries";
import { AcornIcon } from "@/components/acorn-icon";
import { WinnerTalkIcon } from "@/components/winner-talk-icon";
import { OrgPresenceTracker } from "@/components/presence/org-presence-tracker";

export const dynamic = "force-dynamic";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAppUser();
  const acornBalance = await getAcornBalance(user.id);

  const firstLetter =
    (user.parentName ?? "").trim().charAt(0) || "🌱";

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#FFF8F0] via-[#F5F1E8] to-[#E8F0E4]">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-[#D4E4BC]/60 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
          <Link
            href="/home"
            className="flex items-center gap-1.5 font-bold text-[#2D5A3D]"
            aria-label="토리로 홈"
          >
            <AcornIcon size={24} />
            <span className="text-base">토리로</span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#E8F0E4] px-3 py-1 text-sm font-bold text-[#2D5A3D]"
              aria-label={`도토리 잔액 ${acornBalance}`}
            >
              <AcornIcon />
              <span className="tabular-nums">{acornBalance}</span>
            </span>

            <Link
              href="/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3A7A52] to-[#4A7C59] text-sm font-bold text-white shadow-sm transition hover:scale-105"
              aria-label="내 정보"
              title={user.parentName}
            >
              {firstLetter}
            </Link>

            <form action="/api/auth/user-logout" method="post" className="inline">
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-white px-3 py-1 text-[11px] font-semibold text-[#6B6560] transition hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                aria-label="로그아웃"
                title="로그아웃"
              >
                <span aria-hidden>🚪</span>
                <span>로그아웃</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4 pb-24">{children}</main>

      {/* Supabase Presence: 이 참가자의 접속 상태를 org 채널에 track — 관제실이 구독 */}
      <OrgPresenceTracker
        orgId={user.orgId}
        userId={user.id}
        parentName={user.parentName}
      />

      {/* Bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D4E4BC]/60 bg-white/95 backdrop-blur-md"
        aria-label="주요 메뉴"
      >
        <ul className="mx-auto flex max-w-md items-stretch">
          <TabItem href="/home" label="홈" icon="🏠" />
          <TabItem href="/stamps" label="스탬프" icon={<AcornIcon size={20} />} />
          <TabItem href="/tori-talk" label="토리톡" icon={<WinnerTalkIcon size={22} />} />
          <TabItem href="/acorns" label="도토리" icon="🎁" />
          <TabItem href="/profile" label="내 정보" icon="👤" />
        </ul>
      </nav>
    </div>
  );
}

function TabItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold text-[#6B6560] transition hover:bg-[#F5F1E8] hover:text-[#2D5A3D]"
      >
        <span className="text-xl leading-none" aria-hidden>
          {icon}
        </span>
        <span>{label}</span>
      </Link>
    </li>
  );
}
