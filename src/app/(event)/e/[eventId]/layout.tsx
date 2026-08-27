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

  // 하단은 다섯 칸까지다. 360px 폰에서 여섯 칸부터 글자가 눌리기 시작한다.
  //
  //  · 사진 — 행사홈의 [📸 우리 행사 사진] 카드로 들어간다. 작은 아이콘보다
  //    사진 석 장이 깔린 카드가 잘 보이고, 미션 화면 피드에도 "전체 보기" 가 있다.
  //  · 내 행사 — 상단 "토리로" 로고가 그 자리다(홈 로고 = 앱 홈, 흔한 규약).
  //    행사 안에서 행사홈은 첫 번째 탭이 이미 맡고 있어 로고와 겹쳤었다.
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
      // 로고 = 내 행사 목록. 행사홈은 첫 번째 탭이 맡는다.
      homeHref="/home"
    >
      {children}
    </ParticipantShell>
  );
}

