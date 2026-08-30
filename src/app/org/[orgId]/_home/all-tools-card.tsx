// 기관 홈 「모든 기능」 — 이 기관이 쓸 수 있는 화면 전부의 목록판.
//
// 왜 필요했나:
//   기능은 다 만들어져 있는데 들어가는 길이 행사 상세 안(RunToolsPanel)에만 있었다.
//   토리FM·사연 관리·미션 검수·선물함·토리톡·빙고가 전부 그렇다. 그래서 행사를 아직
//   안 만들었거나 목록 화면에 있는 관리자에게는 "그런 기능이 없는 것"과 같았다.
//   ("보이는 라디오 같은 건 어디서 설정하냐"는 질문이 여기서 나왔다.)
//
// 목록은 이제 lib/org-tools/registry.ts 가 갖는다 — 상단 메뉴도 같은 목록을 읽어야
// 해서 여기 두면 베낄 곳이 둘이 된다. 새 화면을 만들면 **레지스트리에** 한 줄
// 추가하면 되고, 그러면 홈과 상단 메뉴가 같이 안다.
//
// ⚠ 링크 나열이라 서버 컴포넌트다(클라이언트 번들에 안 실린다).

import Link from "next/link";
import {
  loadOrgFeatureFlags,
  canUse,
  lockReason,
} from "@/lib/features/org-switches";
import {
  ORG_TOOL_GROUPS,
  ORG_TOOL_GROUP_ORDER,
  toolsInGroup,
  toolHref,
} from "@/lib/org-tools/registry";

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
        {ORG_TOOL_GROUP_ORDER.map((g) => {
          const meta = ORG_TOOL_GROUPS[g];
          return (
            <div key={g}>
              <p className="text-[11px] font-bold text-[#8B7F75]">
                {meta.title}
                <span className="ml-1.5 font-normal text-[#B5AA9E]">
                  {meta.hint}
                </span>
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {toolsInGroup(g).map((t) => {
                  const off = t.featureCode
                    ? !canUse(flags, t.featureCode)
                    : false;
                  const why = t.featureCode
                    ? lockReason(flags, t.featureCode)
                    : null;

                  // 잠긴 칸은 Link 가 아니라 span 이다 — 눌리는데 아무 일도
                  // 안 나는 것이 제일 나쁘다(참가자 '더보기' 와 같은 규칙).
                  if (off) {
                    return (
                      <li key={t.key}>
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

                  return (
                    <li key={t.key}>
                      <Link
                        href={toolHref(t, orgId)}
                        {...(t.newTab
                          ? { target: "_blank", rel: "noopener" }
                          : {})}
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
          );
        })}
      </div>
    </section>
  );
}
