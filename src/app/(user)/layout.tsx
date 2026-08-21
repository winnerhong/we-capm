// 계정 단위 화면의 레이아웃 — 행사 허브(/home)·내 정보·보상·토리톡.
//
// 행사 안(/e/[eventId]/…)의 레이아웃은 별도다.
//   → src/app/(event)/e/[eventId]/layout.tsx
// 크롬(상단바·탭바)은 둘 다 ParticipantShell 을 공유한다.
//
// 여기서 orgId 는 세션의 활성 기관을 그대로 쓴다. 이 화면들은 특정 행사에
// 속하지 않기 때문이다. 행사에 속한 화면은 URL 의 eventId 에서 기관을 얻는다.

import { requireAppUser } from "@/lib/user-auth-guard";
import { getAcornBalance, loadChildrenForUser } from "@/lib/app-user/queries";
import { loadActiveEventsForUser } from "@/lib/org-events/queries";
import { ParticipantShell, type ShellTab } from "@/components/participant-shell";

export const dynamic = "force-dynamic";

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
  const [acornBalance, liveEvents, kids] = await Promise.all([
    safeQuery("getAcornBalance", () => getAcornBalance(user.id), 0),
    safeQuery(
      "loadActiveEventsForUser",
      () => loadActiveEventsForUser(user.id),
      []
    ),
    safeQuery("loadChildrenForUser", () => loadChildrenForUser(user.id), []),
  ]);

  // 헤더 "초대장" 버튼이 가리킬 행사 — 활성 기관의 LIVE 를 우선.
  //   (기관을 안 보고 고르면 다른 기관 초대장이 뜬다)
  const liveHere = liveEvents.filter((e) => e.org_id === user.orgId);
  const invitationEventId = liveHere[0]?.id ?? liveEvents[0]?.id ?? null;

  // 아바타 글자 우선순위:
  //   1) 원생(is_enrolled=true) 자녀의 첫 글자 — "홍유빈" → "홍"
  //   2) 보호자 이름 첫 글자 — fallback
  //   3) 🌱 — 그것도 없을 때
  const avatarLetter = (() => {
    const enrolled = kids.find((c) => c.is_enrolled && c.name?.trim());
    if (enrolled) return enrolled.name.trim().charAt(0);
    const parentFirst = (user.parentName ?? "").trim().charAt(0);
    return parentFirst || "🌱";
  })();

  // 계정 단위 탭 — 행사 기능(스탬프·라디오·선물)은 행사 안에서만 의미가 있어
  // 여기엔 두지 않는다. 행사로 들어가는 입구는 /home 의 행사 카드.
  const tabs: ShellTab[] = [
    { href: "/home", label: "홈", icon: "🏠" },
    { href: "/tori-talk", label: "토리톡", icon: "💬" },
    { href: "/profile", label: "내 정보", icon: "👤" },
  ];

  return (
    <ParticipantShell
      tabs={tabs}
      orgId={user.orgId}
      userId={user.id}
      parentName={user.parentName}
      avatarLetter={avatarLetter}
      acornBalance={acornBalance}
      acornLabel="전체 누적 도토리"
      invitationEventId={invitationEventId}
      homeHref="/home"
    >
      {children}
    </ParticipantShell>
  );
}

