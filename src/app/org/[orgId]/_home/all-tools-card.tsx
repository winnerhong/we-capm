// 기관 홈 「모든 기능」 — 이 기관이 쓸 수 있는 화면 전부의 목록판.
//
// 왜 필요했나:
//   기능은 다 만들어져 있는데 들어가는 길이 행사 상세 안(RunToolsPanel)에만 있었다.
//   토리FM·사연 관리·미션 검수·선물함·토리톡·빙고가 전부 그렇다. 그래서 행사를 아직
//   안 만들었거나 목록 화면에 있는 관리자에게는 "그런 기능이 없는 것"과 같았다.
//   ("보이는 라디오 같은 건 어디서 설정하냐"는 질문이 여기서 나왔다.)
//
//   탭 한 줄(기관 홈·행사 목록·초대장·템플릿·참가자·스탬프북·통계)은 일부러 줄여 둔 것이라
//   늘리지 않는다. 대신 홈에 목록판을 두고, 여기서는 전부 보이게 한다.
//
// ⚠ 새 org 화면을 만들면 여기에도 한 줄 추가할 것. 안 그러면 또 "감춰진 기능"이 된다.
// ⚠ 링크 나열이라 서버 컴포넌트다(클라이언트 번들에 안 실린다).

import Link from "next/link";
import {
  loadOrgFeatureFlags,
  canUse,
  lockReason,
} from "@/lib/features/org-switches";
import { F } from "@/lib/features/codes";

type Tool = {
  icon: string;
  label: string;
  /** 기관 상대경로(/org/{orgId} 뒤). 절대경로는 abs 로 준다. */
  path?: string;
  /** 기관 밖 경로(전광판 등) */
  abs?: string;
  /** 프로젝터·TV 로 띄우는 화면 — 새 탭으로 연다. */
  newTab?: boolean;
  /** 지사가 기관별로 끌 수 있는 기능이면 그 코드. 없으면 코어(항상 켜짐). */
  feature?: string;
};

type Group = { title: string; hint: string; tools: Tool[] };

const GROUPS: Group[] = [
  {
    title: "행사 진행",
    hint: "행사 당일 손에 들고 쓰는 것",
    tools: [
      { icon: "🛰", label: "관제실", path: "/control-room", feature: F.CONTROL_ROOM },
      { icon: "📺", label: "관제실 TV 모드", path: "/control-room/tv", feature: F.CONTROL_ROOM },
      { icon: "🎙", label: "토리FM 방송", path: "/tori-fm", feature: F.TORI_FM },
      // 참가자가 보는 쪽 화면. 프로젝터에 띄우는 용도라 새 탭.
      { icon: "📻", label: "보이는 라디오(전광판)", abs: "/screen/tori-fm/", newTab: true, feature: F.TORI_FM },
      { icon: "💌", label: "사연 관리", path: "/missions/radio", feature: F.TORI_FM },
      { icon: "🔍", label: "미션 검수", path: "/missions/review", feature: F.STAMPBOOK },
      { icon: "⚡", label: "돌발 미션 방송", path: "/missions/broadcast", feature: F.BROADCAST },
      { icon: "💬", label: "토리톡", path: "/toritalk", feature: F.TORITALK },
      { icon: "🎯", label: "토리 빙고", path: "/bingo", feature: F.BINGO },
    ],
  },
  {
    title: "선물 · 쿠폰",
    hint: "무엇을 주고 어떻게 받게 할지",
    tools: [
      { icon: "🎁", label: "선물함", path: "/gifts", feature: F.GIFT },
      { icon: "📷", label: "선물 수령 QR", path: "/gifts/redeem", feature: F.GIFT },
      { icon: "🎟", label: "쿠폰 만들기", path: "/gifts/templates", feature: F.GIFT },
    ],
  },
  {
    title: "만들기",
    hint: "행사 전에 미리 준비하는 것",
    tools: [
      { icon: "📚", label: "스탬프북", path: "/quest-packs", feature: F.STAMPBOOK },
      { icon: "🗂", label: "프로그램", path: "/programs" },
      { icon: "🗺", label: "My 코스관리", path: "/trails", feature: F.TRAIL },
      { icon: "🧩", label: "미션 카탈로그", path: "/missions/catalog", feature: F.MISSION_LIB },
      { icon: "🗓", label: "행사 템플릿", path: "/event-templates", feature: F.EVENT_TEMPLATE },
      { icon: "✉️", label: "초대장 템플릿", path: "/invitations/templates" },
      { icon: "🔎", label: "프로그램 템플릿 둘러보기", path: "/templates" },
    ],
  },
  {
    title: "관리",
    hint: "사람 · 서류 · 기관 설정",
    tools: [
      { icon: "👨‍👩‍👧", label: "참가자", path: "/users" },
      { icon: "🧑‍💼", label: "담당자", path: "/members" },
      { icon: "📄", label: "서류", path: "/documents" },
      { icon: "📊", label: "미션 통계", path: "/missions/stats", feature: F.MISSION_LIB },
      // 토리FM 표시명(우리 기관 라디오 이름)도 여기 있다.
      { icon: "⚙️", label: "기관 설정", path: "/settings" },
    ],
  },
];

export async function AllToolsCard({ orgId }: { orgId: string }) {
  // 여기는 탭 한 줄과 반대로 **감추지 않는다.** 이 카드의 존재 이유가
  // "그런 기능이 있는 줄도 몰랐다" 를 없애는 것이라, 꺼진 기능까지 자리를
  // 지키고 왜 못 쓰는지 말해야 한다. (참가자 앱에서는 반대로 완전히 숨긴다 —
  //  보호자에게 지사 계약 사정은 알 필요 없는 정보이고 불만만 만든다)
  const flags = await loadOrgFeatureFlags(orgId);

  return (
    <section className="rounded-3xl border border-[#E8DDC8] bg-white p-5 shadow-sm">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-bold text-[#2D5A3D]">🧭 모든 기능</h2>
        <p className="text-[11px] text-[#8B7F75]">
          행사를 열지 않아도 여기서 바로 갑니다
        </p>
      </div>

      <div className="mt-4 space-y-4">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="text-[11px] font-bold text-[#8B7F75]">
              {g.title}
              <span className="ml-1.5 font-normal text-[#B5AA9E]">{g.hint}</span>
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {g.tools.map((t) => {
                const off = t.feature ? !canUse(flags, t.feature) : false;
                const why = t.feature ? lockReason(flags, t.feature) : null;

                // 잠긴 칸은 Link 가 아니라 span 이다 — 눌리는데 아무 일도
                // 안 나는 것이 제일 나쁘다(참가자 '더보기' 와 같은 규칙).
                if (off) {
                  return (
                    <li key={t.label}>
                      <span
                        aria-disabled
                        title={why ?? "지금은 사용할 수 없어요"}
                        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-dashed border-[#E5DDD0] bg-[#F7F5F2] px-2.5 py-1.5 text-[12px] font-semibold text-[#B0A99F]"
                      >
                        <span aria-hidden>🔒</span>
                        <span className="line-through decoration-[#D8D0C4]">
                          {t.label}
                        </span>
                      </span>
                    </li>
                  );
                }

                const href = t.abs ? `${t.abs}${orgId}?tv=1` : `/org/${orgId}${t.path}`;
                return (
                  <li key={t.label}>
                    <Link
                      href={href}
                      {...(t.newTab ? { target: "_blank", rel: "noopener" } : {})}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8DDC8] bg-[#FDFBF6] px-2.5 py-1.5 text-[12px] font-semibold text-[#4A4139] transition hover:border-[#2D5A3D] hover:bg-[#E8F0E4] hover:text-[#2D5A3D]"
                    >
                      <span aria-hidden>{t.icon}</span>
                      <span>{t.label}</span>
                      {t.newTab && (
                        <span aria-hidden className="text-[#B5AA9E]">
                          ↗
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
