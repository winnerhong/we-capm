// 행사 5단계 막대 — 내 행사 → 초대장 → 참가자 → 진행 → 결과.
//
// 페이지 맨 위에 놓는 네비게이션이다. 예전에는 커버 이미지(160px)와 제목 카드
// 아래, 화면 한가운데 있었다 — 단계를 옮길 때마다 400px 을 다시 스크롤해야 했다.
// 이동 수단은 가려는 곳보다 위에 있어야 한다.
//
// 모양은 기관 탭줄(_nav/org-section-tabs)과 맞춘다. 같은 층의 이동인데 저기는
// 밑줄 탭이고 여기는 카드 + 알약 + › 화살표면, 볼 때마다 "이건 탭인가 버튼인가"
// 를 다시 판단하게 된다. 상자·화살표·아이콘을 빼고 밑줄 하나로 "지금 여기" 를
// 말한다.
//
// 뺀 것과 남긴 것:
//   뺌   테두리·그림자·흰 배경 / › 화살표 / 진한 알약 / 하위탭 아이콘
//   남김 ✓·번호, 단계 이름, **상태 한 단어**("발행됨", "3명 대기", "스탬프북 없음")
// 상태 한 단어가 이 막대를 목차가 아니라 할 일 목록으로 만든다. 읽지 않아도
// ✓ 가 없는 칸이 할 일이다.
//
// 서버 컴포넌트 — 링크와 글자뿐이라 클라이언트 JS 를 쓸 이유가 없다.

import Link from "next/link";
import {
  EVENT_STEPS,
  stepHref,
  stepOf,
  type StepKey,
  type StepStatus,
} from "@/lib/org-events/event-steps";

export function EventStepBar({
  base,
  current,
  currentSub,
  statuses,
  backHref,
}: {
  /** /org/{orgId}/events/{eventId} */
  base: string;
  current: StepKey;
  currentSub: string;
  statuses: Record<StepKey, StepStatus>;
  /**
   * 행사 목록으로 돌아가는 길.
   *
   * 예전 빵부스러기(기관 홈 / 행사 / 행사이름) 세 조각을 이 한 줄이 대신한다.
   * 기관 홈은 상단 🌿 로고가 이미 맡고 있고(모바일에서도 늘 보인다), 세 번째
   * 조각인 행사 이름은 바로 아래 제목과 같은 글자였다.
   */
  backHref: string;
}) {
  const step = stepOf(current);

  return (
    <div>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B7F75] transition hover:text-[#2D5A3D]"
      >
        <span aria-hidden>←</span>
        행사 목록
      </Link>

      {/* 5단계. 좁은 화면에서는 가로로 밀린다 — 접거나 줄이면 몇 번째 단계인지가
          사라진다. 실선은 화면 폭을 다 쓴다(-mx-4). */}
      <nav
        aria-label="행사 준비 단계"
        className="tab-scroll -mx-4 mt-2 overflow-x-auto border-b border-[#E8DDC8] px-4"
      >
        <ol className="flex min-w-max gap-1">
          {EVENT_STEPS.map((s, idx) => {
            const on = s.key === current;
            const st = statuses[s.key];
            const done = st.state === "done";
            return (
              // li 를 flex 로 두는 이유: 상태 한 단어가 없는 단계는 두 번째 줄이
              // 없어 칸이 짧아진다. 그러면 밑줄 높이가 칸마다 달라진다.
              <li key={s.key} className="flex">
                <Link
                  href={stepHref(base, s.key)}
                  aria-current={on ? "page" : undefined}
                  className={`-mb-px flex flex-col justify-start gap-0.5 whitespace-nowrap border-b-2 px-3 py-2.5 transition ${
                    on
                      ? "border-[#2D5A3D]"
                      : "border-transparent hover:bg-[#F5F1E8]"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-bold">
                    <span
                      aria-hidden
                      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                        done
                          ? "bg-[#2D5A3D] text-white"
                          : on
                            ? "bg-[#E8F0E4] text-[#2D5A3D]"
                            : "bg-[#F4EFE8] text-[#8B7F75]"
                      }`}
                    >
                      {done ? "✓" : idx + 1}
                    </span>
                    <span className={on ? "text-[#2D5A3D]" : "text-[#8B7F75]"}>
                      {s.label}
                    </span>
                  </span>
                  {/* 상태 한 단어 — 설명문 대신 이 자리가 다음 할 일을 말한다.
                      동그라미(16px) + 간격(6px) 만큼 들여 이름과 줄을 맞춘다. */}
                  <span className="pl-[1.375rem] text-[10px] text-[#8B7F75]">
                    {st.hint ?? (done ? "완료" : "")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* 하위 탭 — 단계 안에서 하는 일들. 하나뿐이면 띄우지 않는다.
          아이콘은 뺐다: ④ 진행은 하위탭이 다섯이라 아이콘까지 붙으면
          알록달록해지고, 그러면 단계 막대와 어느 쪽이 위인지 흐려진다. */}
      {step.subs.length > 1 && (
        <nav
          aria-label={`${step.label} 세부`}
          className="mt-2 flex flex-wrap gap-1"
        >
          {step.subs.map((sub) => {
            const on = sub.key === currentSub;
            return (
              <Link
                key={sub.key}
                href={stepHref(base, step.key, sub.key)}
                aria-current={on ? "page" : undefined}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  on
                    ? "bg-[#E8F0E4] text-[#2D5A3D]"
                    : "text-[#8B7F75] hover:bg-[#F5F1E8] hover:text-[#2D5A3D]"
                }`}
              >
                {sub.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
