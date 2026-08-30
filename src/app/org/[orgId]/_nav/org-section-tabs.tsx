// 기관 화면의 탭 한 줄 — 행사 목록 · 초대장 · 템플릿 · 참가자 · 스탬프북 · 통계.
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

export type OrgSection =
  | "home"
  | "events"
  | "invitations"
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
  { key: "invitations", label: "초대장", path: "/invitations" },
  { key: "templates", label: "템플릿", path: "/invitations/templates" },
  { key: "users", label: "참가자", path: "/users" },
  { key: "quest-packs", label: "스탬프북", path: "/quest-packs", feature: F.STAMPBOOK },
  { key: "stats", label: "통계", path: "/missions/stats", feature: F.MISSION_LIB },
];

export async function OrgSectionTabs({
  orgId,
  active,
  /** 템플릿 칸에 걸 개수 — 만들어 둔 게 있다는 걸 열기 전에 알 수 있다. */
  templateCount,
}: {
  orgId: string;
  active: OrgSection;
  templateCount?: number;
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
          const count = s.key === "templates" ? templateCount : undefined;
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
                {s.label}
                {typeof count === "number" && count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      on
                        ? "bg-[#E8F0E4] text-[#2D5A3D]"
                        : "bg-[#F5F1E8] text-[#8B7F75]"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
