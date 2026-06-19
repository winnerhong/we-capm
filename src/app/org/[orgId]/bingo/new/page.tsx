import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { createBingoBoardAction } from "@/lib/bingo/actions";
import { BoardForm } from "./board-form";

export const dynamic = "force-dynamic";

export default async function NewBingoBoardPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrg();

  async function action(formData: FormData) {
    "use server";
    await createBingoBoardAction(orgId, formData);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <nav className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}/bingo`} className="hover:text-[#2D5A3D]">
          🎯 빙고
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">새 빙고</span>
      </nav>

      <header>
        <h1 className="text-2xl font-bold text-[#2D5A3D]">🎯 새 빙고 만들기</h1>
        <p className="mt-1 text-sm text-[#6B6560]">
          크기·승리 줄·키워드 주제를 정하면 DRAFT 로 저장돼요. 발행하면
          참가자에게 노출됩니다.
        </p>
      </header>

      <BoardForm action={action} />
    </div>
  );
}
