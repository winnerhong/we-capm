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
import { F } from "@/lib/features/codes";

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

  // 자녀(아바타 글자)와 도토리 잔액은 서로를 필요로 하지 않는다. 줄줄이 기다리면
  // 참가자의 모든 화면이 그만큼 늦게 뜬다 — 껍데기는 바닥값이라 특히 아깝다.
  const [kids, acornBalance] = await Promise.all([
    loadChildrenForEvent(ctx.user.id, eventId).catch(() => []),
    // 이 행사에서 모은 도토리만. 다른 행사 도토리는 여기 뜨지 않는다.
    getEventAcornBalance(ctx.user.id, eventId).catch(() => 0),
  ]);

  const avatarLetter = (() => {
    const enrolled = kids.find((c) => c.is_enrolled && c.name?.trim());
    if (enrolled) return enrolled.name.trim().charAt(0);
    const parentFirst = (ctx.user.parentName ?? "").trim().charAt(0);
    return parentFirst || "🌱";
  })();

  // 열려 있어야 스탬프·라디오·선물이 의미가 있다. "열림" 의 판단은
  // resolveEventAccess 한 곳에서만 한다 — 여기서 status 를 다시 읽으면
  // 서버 액션과 어긋난다.
  const access = ctx.access;

  // 하단은 다섯 칸까지다. 360px 폰에서 여섯 칸부터 글자가 눌리기 시작한다.
  //
  // ⚠ 다섯 칸은 **행사 상태와 무관하게 항상 같다.** 예전엔 스탬프·라디오·선물함을
  //   canPlay 로 감싸서, 예정·종료 행사에서는 탭이 두세 칸으로 줄었다. 참가자 입장에선
  //   어제 있던 메뉴가 오늘 사라진 것이라 "고장났나" 로 읽힌다. 칸은 그대로 두고
  //   각 화면이 자기 가드로 안내하게 한다(잠긴 이유는 '더보기' 가 한 줄로 말해 준다).
  //
  //  · 선물함 — 도토리를 쓸 때만 들어가는 곳이라 '더보기' 첫 줄로 옮겼다.
  //    행사 중 계속 누르는 라디오·스탬프에 자리를 준다.
  //  · 사진·빙고·방송·설문·도토리 — 전부 '더보기' 안에 있다. 예전엔 행사홈을 끝까지
  //    스크롤해야 나오는 카드였고, 데이터가 없으면 카드째 사라져 못 찾았다.
  //  · 내 행사 — 상단 "토리로" 로고가 그 자리다(홈 로고 = 앱 홈, 흔한 규약).
  //
  // ⚠ 다만 **기관이 끈 기능**은 예외다. 다섯 칸 고정은 "행사 상태 때문에 어제
  //   있던 게 오늘 사라지지 마라" 는 규칙이지, 이 기관이 아예 안 쓰는 기능도
  //   자리를 지키라는 뜻이 아니다. 안 쓰는 기능은 어제도 오늘도 없다.
  const tabs: ShellTab[] = [
    { href: ctx.href(), label: "행사홈", icon: "🎪" },
    { href: ctx.href("/schedule"), label: "일정", icon: "📅" },
    ...(ctx.hasFeature(F.STAMPBOOK)
      ? [
          {
            href: ctx.href("/stamps"),
            label: "스탬프",
            icon: <AcornIcon size={20} />,
          },
        ]
      : []),
    ...(ctx.hasFeature(F.TORI_FM)
      ? [{ href: ctx.href("/radio"), label: "라디오", icon: "📻" }]
      : []),
    { href: ctx.href("/menu"), label: "더보기", icon: "☰" },
  ];

  return (
    <ParticipantShell
      tabs={tabs}
      orgId={ctx.orgId}
      userId={ctx.user.id}
      parentName={ctx.user.parentName}
      avatarLetter={avatarLetter}
      acornBalance={ctx.hasFeature(F.ACORN) ? acornBalance : null}
      acornLabel={`${ctx.event.name} 도토리`}
      invitationEventId={ctx.event.invitation_published_at ? eventId : null}
      // 로고 = 내 행사 목록. 행사홈은 첫 번째 탭이 맡는다.
      homeHref="/home"
    >
      {/* 잠긴 이유 한 줄. 예정(DRAFT) 행사는 행사홈이 통째로 "곧 만나요"
          화면이라 여기서 또 말하면 같은 말이 두 번 된다. */}
      {access.phase === "closed" && access.notice && (
        <p className="mb-3 rounded-2xl border border-[#E8E4DE] bg-[#FAF8F5] px-4 py-3 text-center text-xs font-semibold text-[#6B6560]">
          {access.badgeEmoji} {access.notice}
        </p>
      )}
      {children}
    </ParticipantShell>
  );
}

