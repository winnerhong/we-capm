import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { NewEventForm } from "./new-event-form";

export const dynamic = "force-dynamic";

export default async function NewOrgEventPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  // layout 에서 이미 orgId 매칭 검증됨
  await requireOrg();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/events`}
          className="hover:text-[#2D5A3D]"
        >
          행사
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">새 행사</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🎪
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              새 행사 만들기
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              기본 정보만 먼저 입력하세요. 만든 뒤에 스탬프북·참가자를 연결할
              수 있어요.
            </p>
          </div>
        </div>
      </header>

      <NewEventForm orgId={orgId} />

      <div className="rounded-2xl border border-[#E5D3B8] bg-[#FFF8F0] p-4 text-[11px] text-[#6B6560]">
        <p className="font-semibold text-[#8B6F47]">💡 안내</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>
            새 행사는 <strong>초안(DRAFT)</strong> 상태로 시작해요. 아이들에게
            보이지 않아요.
          </li>
          <li>행사 상세에서 스탬프북과 참가자를 연결한 뒤 시작할 수 있어요.</li>
          <li>이름·기간·커버 이미지는 언제든 수정할 수 있어요.</li>
        </ul>
      </div>
    </div>
  );
}
