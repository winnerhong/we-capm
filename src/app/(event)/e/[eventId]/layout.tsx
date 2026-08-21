// 행사 컨텍스트 레이아웃 — /e/[eventId]/… 전부를 감싼다.
//
// (user)/layout.tsx 와 크롬(ParticipantShell)은 공유하되, 다른 점이 둘 있다:
//   1) 기관 종속 요소(공지 배너·홈페이지 배너·접속 추적)를 **세션이 아니라
//      이 행사의 주최 기관**에서 가져온다. 보고 있는 행사와 기관 표시가
//      어긋날 수 없다.
//   2) 탭이 전부 행사 하위 경로를 가리킨다. 탭을 눌러도 행사 밖으로 안 나간다.
//
// 이 레이아웃은 (user) 그룹 밖에 있다. 안에 두면 상단바·탭바가 두 번 그려진다.

import { requireEventContext } from "@/lib/event-context";
import { getEventAcornBalance } from "@/lib/app-user/event-acorns";
import { loadChildrenForEvent } from "@/lib/app-user/event-children";
import { AcornIcon } from "@/components/acorn-icon";
import { ParticipantShell, type ShellTab } from "@/components/participant-shell";

export const dynamic = "force-dynamic";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ctx = await requireEventContext(eventId);

  const kids = await loadChildrenForEvent(ctx.user.id, eventId).catch(() => []);

  const avatarLetter = (() => {
    const enrolled = kids.find((c) => c.is_enrolled && c.name?.trim());
    if (enrolled) return enrolled.name.trim().charAt(0);
    const parentFirst = (ctx.user.parentName ?? "").trim().charAt(0);
    return parentFirst || "🌱";
  })();

  // 행사가 시작돼야(LIVE) 스탬프·라디오·선물이 의미가 있다.
  const isLive = ctx.event.status === "LIVE";

  const tabs: ShellTab[] = [
    { href: ctx.href(), label: "행사홈", icon: "🎪" },
    { href: ctx.href("/schedule"), label: "일정", icon: "📅" },
    ...(isLive
      ? [
          {
            href: ctx.href("/stamps"),
            label: "스탬프",
            icon: <AcornIcon size={20} />,
          },
          { href: ctx.href("/radio"), label: "라디오", icon: "📻" },
          { href: ctx.href("/gifts"), label: "선물함", icon: "🎁" },
        ]
      : []),
    { href: "/home", label: "내 행사", icon: "🏠" },
  ];

  // 이 행사에서 모은 도토리만. 다른 행사 도토리는 여기 뜨지 않는다.
  const acornBalance = await getEventAcornBalance(ctx.user.id, eventId).catch(
    () => 0
  );

  return (
    <ParticipantShell
      tabs={tabs}
      orgId={ctx.orgId}
      userId={ctx.user.id}
      parentName={ctx.user.parentName}
      avatarLetter={avatarLetter}
      acornBalance={acornBalance}
      acornLabel={`${ctx.event.name} 도토리`}
      invitationEventId={ctx.event.invitation_published_at ? eventId : null}
      homeHref={ctx.href()}
    >
      {children}
    </ParticipantShell>
  );
}

