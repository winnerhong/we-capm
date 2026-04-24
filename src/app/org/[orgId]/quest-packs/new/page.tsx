import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { CreateQuestPackForm } from "./create-form";

export const dynamic = "force-dynamic";

export default async function NewOrgQuestPackPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const session = await requireOrg();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/quest-packs`}
          className="hover:text-[#2D5A3D]"
        >
          스탬프북 관리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">새 스탬프북</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🌲
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              새 스탬프북 만들기
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              이름과 기간을 정하고 레이아웃을 골라주세요. 만든 뒤에 미션을
              담을 수 있어요.
            </p>
          </div>
        </div>
      </header>

      <CreateQuestPackForm orgId={orgId} />

      <div className="rounded-2xl border border-[#E5D3B8] bg-[#FFF8F0] p-4 text-[11px] text-[#6B6560]">
        <p className="font-semibold text-[#8B6F47]">💡 안내</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>초안 상태에서는 아이들에게 보이지 않아요.</li>
          <li>
            미션을 1개 이상 담고 기간을 설정하면{" "}
            <strong>공개하기</strong>를 누를 수 있어요.
          </li>
          <li>이름·기간·레이아웃은 나중에 언제든 수정할 수 있어요.</li>
        </ul>
      </div>
    </div>
  );
}
