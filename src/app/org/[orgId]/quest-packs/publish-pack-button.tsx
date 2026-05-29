"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishQuestPackAction } from "../missions/actions";

type Props = {
  packId: string;
  packName: string;
};

export function PublishPackButton({ packId, packName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    const ok = window.confirm(
      `"${packName || "(이름 없음)"}" 스탬프북을 공개할까요?\n공개 후 참가자에게 노출됩니다.`
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        await publishQuestPackAction(packId);
        router.refresh();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "공개 실패");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      title="스탬프북 공개"
      aria-label="스탬프북 공개"
      className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
    >
      <span aria-hidden>{isPending ? "⏳" : "📡"}</span>
      <span>{isPending ? "공개 중…" : "공개하기"}</span>
    </button>
  );
}
