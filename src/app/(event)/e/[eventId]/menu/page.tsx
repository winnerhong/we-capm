// 전체 기능 — 이 행사에서 할 수 있는 것을 한 화면에 모은다.
//
// 왜 만들었나: 참가자 기능이 아홉인데 하단 탭은 다섯 칸이다. 나머지는 행사홈을
//   끝까지 스크롤해야 나오는 카드였고, 그 카드들은 데이터가 없으면 `null` 을
//   돌려주며 **조용히 사라졌다**(빙고는 보드 0개일 때, 방송은 진행중 0개일 때).
//   참가자 눈에는 "지금은 없구나" 가 아니라 "그런 기능이 없구나" 로 읽힌다.
//   게다가 스탬프·라디오·선물함 탭은 canPlay 로 감싸여 있어 예정·종료 행사에서는
//   탭 자체가 사라졌다 — 어제 있던 게 오늘 없어지는 화면이었다.
//
// 그래서 원칙은 하나다. **기능을 숨기지 말고 상태를 보여준다.**
//   못 쓰는 칸도 회색으로 남기고 왜 못 쓰는지 한 줄을 붙인다. 칸 수는 늘 같다.
//
// ⚠ 잠금 판정은 각 페이지의 실제 가드와 **같아야** 한다. 여기서 열어 놓고 들어가면
//   리다이렉트로 튕기고, 여기서 잠갔는데 실제로는 열려 있으면 못 들어간다.
//   가드 원본: gifts·radio·broadcasts = !canPlay → 행사홈,
//              stampbook·acorns = phase==="upcoming" → 행사홈, photos·survey·schedule = 제한 없음.

import Link from "next/link";
import { requireEventContext } from "@/lib/event-context";
import { getEventAcornBalance } from "@/lib/app-user/event-acorns";
import { loadUserGifts } from "@/lib/gifts/queries";
import { loadTimelineSlots } from "@/lib/event-timeline/queries";
import { loadLiveBoardsForOrg } from "@/lib/bingo/queries";
import { loadLiveBroadcastsForOrg } from "@/lib/missions/queries";
import { loadLiveFmSessionForEvent } from "@/lib/org-events/queries";
import { AcornIcon } from "@/components/acorn-icon";
import { F } from "@/lib/features/codes";

export const dynamic = "force-dynamic";

interface Tile {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** 지금 이 기능이 어떤 상태인지 한 줄. 이게 있어야 '없다' 와 '아직이다' 가 갈린다. */
  status: string;
  /** 잠긴 이유. 있으면 회색 + 누를 수 없음. */
  locked: string | null;
  /**
   * 기관이 이 기능을 끄면 **칸째 사라진다.**
   *
   * locked(회색으로 남김) 와 다르게 대하는 이유: locked 는 "있는데 지금은",
   * feature 꺼짐은 "여기서는 안 씀" 이다. 보호자에게 지사 계약 사정을 회색으로
   * 보여줘 봐야 알 수 없는 이유로 불만만 생긴다. 기관 담당자 화면에서는 반대로
   * 자물쇠로 남긴다(org/_home/all-tools-card.tsx).
   */
  feature?: string;
}

export default async function EventMenuPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ctx = await requireEventContext(eventId);
  const { access } = ctx;

  /* 아홉 칸의 상태 줄을 만드는 조회. 서로를 필요로 하지 않으므로 한꺼번에 간다 —
     줄줄이 기다리면 이 화면이 그만큼 늦게 뜬다.
     ⚠ 하나가 실패해도 화면은 떠야 한다. 상태 줄 하나 못 채우자고 전체 메뉴가
       사라지는 건 원래 고치려던 문제(기능이 조용히 없어짐)와 같은 실수다. */
  const [acorns, gifts, slots, boards, casts, fm] = await Promise.all([
    getEventAcornBalance(ctx.user.id, eventId).catch(() => null),
    loadUserGifts(ctx.user.id, eventId).catch(() => null),
    loadTimelineSlots(ctx.event.id).catch(() => null),
    loadLiveBoardsForOrg(ctx.orgId).catch(() => null),
    loadLiveBroadcastsForOrg(ctx.orgId).catch(() => null),
    loadLiveFmSessionForEvent(ctx.event.id).catch(() => null),
  ]);

  // 잠금 사유 — 각 페이지 가드와 같은 조건을 쓴다(파일 머리 주석 참고).
  const playLock = access.canPlay ? null : (access.notice ?? "지금은 이용할 수 없어요");
  const pastLock = access.phase === "upcoming" ? "행사가 시작되면 열려요" : null;

  const n = (v: unknown[] | null) => (v === null ? null : v.length);

  const tiles: Tile[] = [
    {
      href: ctx.href("/stampbook"),
      label: "스탬프북",
      feature: F.STAMPBOOK,
      icon: "🌿",
      status: pastLock ? "행사 시작 후" : "미션 하고 도장 모으기",
      locked: pastLock,
    },
    {
      href: ctx.href("/acorns"),
      label: "도토리",
      feature: F.ACORN,
      icon: <AcornIcon size={22} />,
      status: acorns === null ? "기록 보기" : `${acorns.toLocaleString("ko-KR")}개`,
      locked: pastLock,
    },
    {
      href: ctx.href("/gifts"),
      label: "선물함",
      feature: F.GIFT,
      icon: "🎁",
      status:
        playLock ? "행사 중에만" : n(gifts) === null ? "받은 선물 보기" : `${n(gifts)}개`,
      locked: playLock,
    },
    {
      href: ctx.href("/radio"),
      label: "라디오",
      feature: F.TORI_FM,
      icon: "📻",
      status: playLock ? "행사 중에만" : fm ? "방송 중" : "사연 보내기",
      locked: playLock,
    },
    {
      href: ctx.href("/broadcasts"),
      label: "방송",
      feature: F.BROADCAST,
      icon: "📢",
      status:
        playLock ? "행사 중에만"
        : n(casts) === null ? "진행 중인 방송"
        : n(casts)! > 0 ? `진행 중 ${n(casts)}개`
        : "예정된 방송 없어요",
      locked: playLock,
    },
    {
      href: ctx.href("/bingo"),
      label: "빙고",
      feature: F.BINGO,
      icon: "🎱",
      status:
        n(boards) === null ? "빙고판 보기"
        : n(boards)! > 0 ? `${n(boards)}판 진행 중`
        : "아직 열리지 않았어요",
      // 보드가 없으면 들어가도 빈 화면이다 — 기능이 있다는 것만 알리고 막는다.
      locked: n(boards) === 0 ? "아직 열리지 않았어요" : null,
    },
    {
      href: ctx.href("/photos"),
      label: "사진",
      feature: F.PHOTO,
      icon: "📸",
      status: "우리 행사 사진",
      locked: null,
    },
    {
      href: ctx.href("/survey"),
      label: "설문",
      feature: F.SURVEY,
      icon: "📝",
      status: "행사가 어땠나요",
      locked: null,
    },
    {
      href: ctx.href("/schedule"),
      label: "일정",
      icon: "📅",
      status: n(slots) === null ? "행사 일정" : `${n(slots)}개 순서`,
      locked: null,
    },
  ];

  /* 기관이 끈 기능은 여기서 빠진다. 3×3 격자라 칸이 줄면 마지막 줄이 비지만,
     없는 기능을 채워 넣는 것보다 낫다 — grid 는 알아서 흐른다. */
  const visible = tiles.filter((t) => !t.feature || ctx.hasFeature(t.feature));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-[#2D5A3D]">전체 기능</h1>
        <p className="mt-0.5 text-xs text-[#8B7F75]">
          {ctx.event.name}에서 할 수 있는 것들이에요
        </p>
      </header>

      {/* 잠긴 이유가 행사 전체에 걸린 경우 한 번만 말한다 — 칸마다 반복하면 시끄럽다. */}
      {access.phase !== "live" && access.notice && (
        <p className="rounded-2xl border border-[#E8E4DE] bg-[#FAF8F5] px-4 py-3 text-center text-xs font-semibold text-[#6B6560]">
          {access.badgeEmoji} {access.notice}
        </p>
      )}

      <ul className="grid grid-cols-3 gap-2.5">
        {visible.map((t) => (
          <li key={t.href}>
            <TileBox tile={t} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 잠긴 칸은 링크가 아니라 div 다 — 눌리는데 아무 일도 안 나는 것이 제일 나쁘다. */
function TileBox({ tile }: { tile: Tile }) {
  const inner = (
    <>
      <span className="text-2xl leading-none" aria-hidden>
        {tile.icon}
      </span>
      <span className="mt-1.5 text-[13px] font-bold">{tile.label}</span>
      <span
        className={`mt-0.5 line-clamp-2 text-[10.5px] leading-tight ${
          tile.locked ? "text-[#B0A99F]" : "text-[#8B7F75]"
        }`}
      >
        {tile.locked ?? tile.status}
      </span>
    </>
  );

  const box =
    "flex h-full min-h-[104px] flex-col items-center justify-center rounded-2xl border px-2 py-3 text-center";

  if (tile.locked) {
    return (
      <div
        className={`${box} border-[#EDE8E0] bg-[#F7F5F2] text-[#B0A99F]`}
        aria-disabled
        title={tile.locked}
      >
        {inner}
      </div>
    );
  }
  return (
    <Link
      href={tile.href}
      className={`${box} border-[#E5D3B8] bg-white text-[#6B6560] shadow-sm transition hover:border-[#2D5A3D] hover:shadow-md`}
    >
      {inner}
    </Link>
  );
}
