import Link from "next/link";
import { requireAppUser } from "@/lib/user-auth-guard";
import { getAcornBalance, loadChildrenForUser } from "@/lib/app-user/queries";
import { loadActiveEventsForUser } from "@/lib/org-events/queries";
import { isToritalkEnabled } from "@/lib/toritalk/queries";
import { loadOrgHomepageBanner } from "@/lib/org-banner/queries";
import { AcornIcon } from "@/components/acorn-icon";
import { WinnerTalkIcon } from "@/components/winner-talk-icon";
import { HomepageBannerDisplay } from "@/components/homepage-banner-display";
import { OrgPresenceTracker } from "@/components/presence/org-presence-tracker";
import { PinnedNoticeBanner } from "./PinnedNoticeBanner";

export const dynamic = "force-dynamic";

// 안전 헬퍼 — 어떤 쿼리도 layout 전체를 죽이지 않도록 fallback.
// 서버 액션 후 자동 RSC refresh 단계에서 throw 가 발생하면 클라이언트가
// "An error occurred in the Server Components render" 만 보게 되므로,
// 각 쿼리를 개별 try/catch 로 격리하고 실제 원인은 console.error 로 남긴다.
async function safeQuery<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[UserLayout/${label}] threw`, e);
    return fallback;
  }
}

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAppUser();
  const [acornBalance, liveEvents, kids, toritalkOn, homepageBanner] =
    await Promise.all([
      safeQuery("getAcornBalance", () => getAcornBalance(user.id), 0),
      safeQuery(
        "loadActiveEventsForUser",
        () => loadActiveEventsForUser(user.id),
        []
      ),
      safeQuery("loadChildrenForUser", () => loadChildrenForUser(user.id), []),
      safeQuery("isToritalkEnabled", () => isToritalkEnabled(user.orgId), false),
      safeQuery(
        "loadOrgHomepageBanner",
        () => loadOrgHomepageBanner(user.orgId),
        null
      ),
    ]);
  const hasLive = liveEvents.length > 0;
  // 헤더 "초대장" 버튼이 가리킬 행사 — LIVE 중 가장 최근 1개.
  const firstLiveEventId = liveEvents[0]?.id ?? null;

  // 아바타 글자 우선순위:
  //   1) 원생(is_enrolled=true) 자녀의 첫 글자 — "홍유빈" → "홍"
  //   2) 보호자 이름 첫 글자 — fallback
  //   3) 🌱 — 그것도 없을 때
  const firstLetter = (() => {
    const enrolled = kids.find((c) => c.is_enrolled && c.name?.trim());
    if (enrolled) return enrolled.name.trim().charAt(0);
    const parentFirst = (user.parentName ?? "").trim().charAt(0);
    return parentFirst || "🌱";
  })();

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#FFF8F0] via-[#F5F1E8] to-[#E8F0E4]">
      {/* 호스트 공지사항 — 활성 LIVE 세션의 BANNER spotlight 가 있으면 상단 고정 노출 */}
      <PinnedNoticeBanner orgId={user.orgId} />

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
            {firstLiveEventId && (
              <Link
                href={`/invitation/${firstLiveEventId}`}
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
        {/* LIVE 행사가 없으면 스탬프/선물 탭은 숨김 — 행사 시작 후 활성화.
            토리톡은 기관이 활성화했을 때만 노출 (LIVE 와 무관). */}
        <ul className="mx-auto flex max-w-md items-stretch">
          <TabItem href="/home" label="홈" icon="🏠" />
          <TabItem href="/schedule" label="일정" icon="📅" />
          {hasLive && (
            <TabItem
              href="/stamps"
              label="스탬프"
              icon={<AcornIcon size={20} />}
            />
          )}
          {toritalkOn && (
            <TabItem
              href="/tori-talk"
              label="토리톡"
              icon={<WinnerTalkIcon size={22} />}
            />
          )}
          {hasLive && <TabItem href="/gifts" label="선물함" icon="🎁" />}
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
