// 기관 홈 맨 아래 — 서류와 설정, 둘뿐이다.
//
// 예전엔 그 밑에 작은 글씨 링크 줄(템플릿 둘러보기 · 미션 통계 · 돌발 미션 ·
// 로그아웃)이 하나 더 있었다. 넷 다 다른 데 이미 있었다 — 앞 세 개는 바로 위
// 「🧭 모든 기능」 목록판에, 로그아웃은 상단 계정 메뉴에. 같은 화면 안에서
// 같은 곳으로 가는 길이 둘이면, 둘이 다른 데로 가는 줄 알고 한 번 더 누른다.
import Link from "next/link";
import type { OrgHomeDashboard } from "@/lib/org-home/types";

type Props = {
  documents: OrgHomeDashboard["documents"];
  orgId: string;
};

export function FooterLinksCard({ documents, orgId }: Props) {
  const hasOverdue = documents.overdue > 0;

  return (
    <section className="rounded-3xl border border-[#E4E4E7] bg-[#F4F4F5] p-5 shadow-sm">
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/org/${orgId}/documents`}
          className="group rounded-2xl border border-[#D4D4D8] bg-white p-4 transition hover:shadow-md active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <div className="text-2xl" aria-hidden>
              📄
            </div>
            {hasOverdue && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                지연 {documents.overdue}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm font-bold text-[#18181B]">서류</p>
          <p className="mt-1 text-[11px] leading-tight text-[#6B6560]">
            제출 {documents.submitted} / 필수 {documents.required}
          </p>
        </Link>

        <Link
          href={`/org/${orgId}/settings`}
          className="group rounded-2xl border border-[#D4D4D8] bg-white p-4 transition hover:shadow-md active:scale-[0.98]"
        >
          <div className="text-2xl" aria-hidden>
            🔧
          </div>
          <p className="mt-2 text-sm font-bold text-[#18181B]">설정</p>
          <p className="mt-1 text-[11px] leading-tight text-[#6B6560]">
            기관 정보 관리
          </p>
        </Link>
      </div>
    </section>
  );
}
