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

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[#6B6560]">
        <Link
          href={`/org/${orgId}/templates`}
          className="font-semibold hover:text-[#2D5A3D] hover:underline"
        >
          템플릿 둘러보기
        </Link>
        <span aria-hidden>·</span>
        <Link
          href={`/org/${orgId}/missions/stats`}
          className="font-semibold hover:text-[#2D5A3D] hover:underline"
        >
          미션 통계
        </Link>
        <span aria-hidden>·</span>
        <Link
          href={`/org/${orgId}/missions/broadcast`}
          className="font-semibold hover:text-[#2D5A3D] hover:underline"
        >
          돌발 미션
        </Link>
        <span aria-hidden>·</span>
        <form action="/api/auth/manager-logout" method="post" className="inline">
          <button
            type="submit"
            className="font-semibold hover:text-rose-600 hover:underline"
          >
            로그아웃
          </button>
        </form>
      </div>
    </section>
  );
}
