"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteQuestPackAction } from "../missions/actions";

type Props = {
  packId: string;
  packName: string;
  disabled?: boolean;
  disabledReason?: string;
};

export function DeletePackButton({
  packId,
  packName,
  disabled,
  disabledReason,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (disabled) {
      if (disabledReason) window.alert(disabledReason);
      return;
    }
    const ok = window.confirm(
      `정말로 "${packName || "(이름 없음)"}" 스탬프북을 삭제할까요?\n담긴 미션은 삭제되지 않고 '미션 카탈로그'로 돌아갑니다.`
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        const res = await deleteQuestPackAction(packId);
        if (!res.ok) {
          window.alert(res.message);
          return;
        }
        router.refresh();
      } catch {
        window.alert("삭제에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      title={disabled ? disabledReason : "스탬프북 삭제"}
      aria-label="스탬프북 삭제"
      className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-bold transition disabled:opacity-50 ${
        disabled
          ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400"
          : "border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
      }`}
    >
      <span aria-hidden>🗑️</span>
      <span className="sr-only md:not-sr-only">삭제</span>
    </button>
  );
}
