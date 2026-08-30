// 초대장 화면의 머리 — 제목 한 줄.
//
// 예전에는 여기에 breadcrumb 과 [초대장 모음|템플릿] 탭이 더 있었다. 상단에 기관
// 탭 한 줄(OrgSectionTabs)이 생기면서 그 둘은 층만 늘리는 꼴이 됐다 — 템플릿에
// 가려고 초대장을 거쳐야 했고, 같은 층 이동인데 생김새가 달랐다.
// 템플릿은 이제 형제 칸이라 바로 간다.

export function InvitationsHeader() {
  return (
    <header className="flex items-start gap-3">
      <span className="text-3xl" aria-hidden>
        💌
      </span>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">초대장</h1>
        <p className="mt-1 text-xs leading-relaxed text-[#6B6560] md:text-sm">
          참가자에게 보낼 링크를 발행하고 공유하세요.
        </p>
      </div>
    </header>
  );
}
