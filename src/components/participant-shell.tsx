// 참가자 화면 공용 크롬 — 상단바 + 본문 + 하단 탭바.
//
// 두 레이아웃이 이걸 공유한다:
//   (user)/layout.tsx        — 계정 단위 화면 (행사 허브·내 정보·보상)
//   (event)/e/[eventId]/…    — 행사 컨텍스트 화면
//
// 다른 건 딱 두 가지뿐이라 props 로 받는다:
//   · 탭 목록 (행사 안에서는 행사 하위 경로를 가리켜야 한다)
//   · 기관 종속 요소의 orgId (공지 배너·홈페이지 배너·접속 추적)
//
// 기관 정보를 shell 이 스스로 결정하지 않는 게 핵심이다. 예전에는 레이아웃이
// 세션 쿠키의 orgId 를 직접 읽어서, 보고 있는 행사와 다른 기관의 배너·공지가
// 뜨는 일이 있었다. 이제 어느 기관인지는 호출하는 쪽이 정한다.

import Link from "next/link";
import { AcornIcon } from "@/components/acorn-icon";
import { HomepageBannerDisplay } from "@/components/homepage-banner-display";
import { OrgPresenceTracker } from "@/components/presence/org-presence-tracker";
import { PinnedNoticeBanner } from "@/components/pinned-notice-banner";
import { loadOrgHomepageBanner } from "@/lib/org-banner/queries";

export interface ShellTab {
  href: string;
  label: string;
  icon: React.ReactNode;
}

/** 어떤 쿼리도 크롬 전체를 죽이지 않도록. */
async function safeQuery<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[ParticipantShell/${label}] threw`, e);
    return fallback;
  }
}

export async function ParticipantShell({
  children,
  tabs,
  orgId,
  userId,
  parentName,
  avatarLetter,
  acornBalance,
  acornLabel = "도토리 잔액",
  /** 상단 "초대장" 버튼이 가리킬 행사. 없으면 버튼 숨김. */
  invitationEventId,
  /** 로고 클릭 시 이동할 곳. 행사 안에서는 그 행사 홈. */
  homeHref = "/home",
}: {
  children: React.ReactNode;
  tabs: ShellTab[];
  orgId: string | null;
  userId: string;
  parentName: string;
  avatarLetter: string;
  acornBalance: number;
  acornLabel?: string;
  invitationEventId?: string | null;
  homeHref?: string;
}) {
  const homepageBanner = orgId
    ? await safeQuery(
        "loadOrgHomepageBanner",
        () => loadOrgHomepageBanner(orgId),
        null
      )
    : null;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#FFF8F0] via-[#F5F1E8] to-[#E8F0E4]">
      {/* 호스트 공지사항 — 활성 LIVE 세션의 BANNER spotlight 가 있으면 상단 고정 노출 */}
      {orgId && <PinnedNoticeBanner orgId={orgId} />}

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-[#D4E4BC]/60 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
          <Link
            href={homeHref}
            className="flex items-center gap-1.5 font-bold text-[#2D5A3D]"
            aria-label="토리로 홈"
          >
            <AcornIcon size={24} />
            <span className="text-base">토리로</span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {invitationEventId && (
              <Link
                href={`/invitation/${invitationEventId}`}
                className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#FFF8F0] px-2.5 py-1 text-[11px] font-semibold text-[#2D5A3D] shadow-sm transition hover:bg-[#FAE7D0]"
                aria-label="초대장 보기"
                title="초대장 보기"
              >
                <span aria-hidden>💌</span>
                <span>초대장</span>
              </Link>
            )}

            <span
              className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#E8F0E4] px-3 py-1 text-sm font-bold text-[#2D5A3D]"
              aria-label={`${acornLabel} ${acornBalance}`}
              title={acornLabel}
            >
              <AcornIcon />
              <span className="tabular-nums">{acornBalance}</span>
            </span>

            <Link
              href="/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3A7A52] to-[#4A7C59] text-sm font-bold text-white shadow-sm transition hover:scale-105"
              aria-label="내 정보"
              title={parentName}
            >
              {avatarLetter}
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

      <main className="mx-auto max-w-md px-4 py-4 pb-24">
        {children}
        {/* 하단 홈페이지 배너 — 기관 admin 이 설정했을 때만 노출. 탭바와 겹치지
            않도록 main 안쪽 (pb-24 영역 내부 상단) 마지막에 배치. */}
        {homepageBanner && (
          <div className="mt-6">
            <HomepageBannerDisplay banner={homepageBanner} />
          </div>
        )}
      </main>

      {/* Supabase Presence: 이 참가자의 접속 상태를 org 채널에 track — 관제실이 구독 */}
      {orgId && (
        <OrgPresenceTracker
          orgId={orgId}
          userId={userId}
          parentName={parentName}
        />
      )}

      {/* Bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D4E4BC]/60 bg-white/95 backdrop-blur-md"
        aria-label="주요 메뉴"
      >
        <ul className="mx-auto flex max-w-md items-stretch">
          {tabs.map((t) => (
            <TabItem key={t.href} href={t.href} label={t.label} icon={t.icon} />
          ))}
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
