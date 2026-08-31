// 기관 화면의 탭 한 줄 — 행사 목록 · 참가자 · 스탬프북 · 통계.
//
// 왜 이렇게 바꿨나:
//   행사 목록 위에는 테두리 달린 알약 버튼 네 개가, 초대장 화면에는 밑줄 탭 두 개가
//   따로 있었다. 같은 층의 이동인데 생김새가 달라서 "이건 탭이고 저건 버튼인가" 를
//   매번 판단해야 했다. 게다가 초대장 안의 [모음|템플릿] 은 층이 하나 더 깊어,
//   템플릿에 가려면 초대장을 거쳐야 했다.
//
//   전부 한 줄로 편다. 밑줄 하나가 "지금 여기" 를 말하고, 나머지는 글자뿐이다.
//   아이콘도 뺐다 — 여섯 칸에 아이콘까지 들어가면 다시 알록달록해진다.
//
// 서버 컴포넌트다. 어느 칸인지는 각 페이지가 이미 알고 있어 prop 으로 받는다.

import Link from "next/link";
import { loadOrgFeatureFlags, canUse } from "@/lib/features/org-switches";
import { F } from "@/lib/features/codes";

/**
 * 탭 줄에 없는 화면도 이 타입을 쓴다("templates" 가 그렇다). 그런 화면에서는
 * 밑줄이 아무 데도 안 그어지고, 탭 줄은 빠져나가는 길로만 쓰인다.
 */
export type OrgSection =
  | "home"
  | "events"
  | "templates"
  | "users"
  | "quest-packs"
  | "stats";

/** feature 가 있는 칸은 지사가 끄면 **줄에서 사라진다.**
 *  회색으로 남기지 않는 이유 — 탭 한 줄은 이동 수단이고, 눌리지 않는 이동 수단은
 *  그냥 고장으로 읽힌다. "있는데 꺼져 있다" 는 사실은 기관 홈의 「모든 기능」
 *  목록판이 자물쇠로 말해 준다(all-tools-card.tsx). 한 곳에서만 말하면 충분하다. */
const SECTIONS: {
  key: OrgSection;
  label: string;
  path: string;
  feature?: string;
}[] = [
  // 기관 홈 = 전체 목록판(프로그램·숲길·서류·멤버·설정 카드가 여기 있다).
  // 예전엔 왼쪽 위 로고로만 갈 수 있어서 "다른 기능은 어디 갔지" 가 됐다.
  { key: "home", label: "기관 홈", path: "" },
  { key: "events", label: "행사 목록", path: "/events" },
  // 「초대장」·「템플릿」 칸은 뺐다.
  //
  //   초대장 — 전 행사의 초대장 카드를 늘어놓던 화면인데, 같은 카드가 행사 안에
  //            두 군데 더 있었다.
  //   템플릿 — 행사 안 [초대장 → 템플릿] 과 **같은 컴포넌트에 같은 옵션**이다.
  //            글자 하나 다르지 않다.
  //
  // 행사 하나를 준비하는 일은 행사 안에서 끝난다 — 이 줄은 "어느 행사?" 만
  // 고른다. 템플릿 화면 자체는 남겨 뒀다(기관 단위 자산이라 행사가 하나도 없어도
  // 만들 수 있어야 한다). 기관 홈 「모든 기능」의 [✉️ 초대장 템플릿] 이 그 길이다.
  { key: "users", label: "참가자", path: "/users" },
  { key: "quest-packs", label: "스탬프북", path: "/quest-packs", feature: F.STAMPBOOK },
  { key: "stats", label: "통계", path: "/missions/stats", feature: F.MISSION_LIB },
];

export async function OrgSectionTabs({
  orgId,
  active,
}: {
  orgId: string;
  active: OrgSection;
}) {
  // 왕복 1회. 기관 화면마다 한 번 불린다.
  const flags = await loadOrgFeatureFlags(orgId);
  const sections = SECTIONS.filter(
    (s) => !s.feature || canUse(flags, s.feature)
  );

  return (
    <nav
      aria-label="기관 메뉴"
      className="tab-scroll -mx-4 overflow-x-auto border-b border-[#E8DDC8] px-4"
    >
      <ul className="flex min-w-max gap-1">
        {sections.map((s) => {
          const on = s.key === active;
          return (
            <li key={s.key}>
              <Link
                href={`/org/${orgId}${s.path}`}
                aria-current={on ? "page" : undefined}
                className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-bold transition ${
                  on
                    ? "border-[#2D5A3D] text-[#2D5A3D]"
                    : "border-transparent text-[#8B7F75] hover:text-[#2D5A3D]"
                }`}
              >
                {/* 개수 배지는 뺐다. 걸던 칸(템플릿)이 줄에서 빠지면서 어떤
                    칸도 개수를 갖지 않는데, 항상 false 인 분기를 남겨 두면
                    다음 사람이 "왜 안 나오지" 를 한참 들여다보게 된다. */}
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
