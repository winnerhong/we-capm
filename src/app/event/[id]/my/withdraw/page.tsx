import { redirect } from "next/navigation";
import { getParticipant } from "@/lib/participant-session";
import { withdrawAccountAction } from "../actions";
import { WithdrawForm } from "./withdraw-form";

export const dynamic = "force-dynamic";

export default async function WithdrawPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getParticipant(id);
  if (!session) redirect("/join");

  const boundAction = withdrawAccountAction.bind(null, id);

  return (
    <main className="min-h-dvh bg-rose-50/50 p-4 pb-24">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 p-5 text-white shadow-lg">
          <h1 className="text-lg font-bold">⚠️ 회원 탈퇴</h1>
          <p className="mt-1 text-xs opacity-90">
            탈퇴하시면 모든 데이터가 삭제됩니다
          </p>
        </div>

        <WithdrawForm
          eventId={id}
          participantName={session.name}
          action={boundAction}
        />

        <div className="rounded-2xl border border-[#D4E4BC] bg-white p-4 text-xs leading-relaxed text-[#6B6560]">
          <p className="font-semibold text-[#2D5A3D]">💚 언제든 재가입 가능해요</p>
          <p className="mt-1">
            탈퇴 후에도 동일한 전화번호로 다시 가입하실 수 있어요. 다만 이전
            참여 이력과 도토리는 복구되지 않아요.
          </p>
          <p className="mt-2 text-[11px] text-[#8B7F75]">
            본 탈퇴는 개인정보보호법 제36조(삭제권)에 따른 즉시 삭제 처리입니다.
          </p>
        </div>
      </div>
    </main>
  );
}
