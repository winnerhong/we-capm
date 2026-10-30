"use client";

// 프리셋 → 스탬프북 생성 버튼.
// 예전엔 <form action={serverAction}> 이었는데, 서버 액션 안의 redirect() 가
// Next 16 내부 재요청에서 세션 쿠키를 떨어뜨려 로그인 화면으로 튕겼다.
// 액션이 편집 URL 을 돌려주고 여기서 router.push 한다 (missions/actions.ts 주석).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPackFromPresetAction } from "../../missions/actions";

export function CreateFromPresetButton({
  orgId,
  presetId,
  eventId,
  disabled,
  disabledTitle,
}: {
  orgId: string;
  presetId: string;
  eventId?: string;
  disabled: boolean;
  disabledTitle?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onClick() {
    setErr(null);
    startTransition(async () => {
      try {
        const url = await createPackFromPresetAction(orgId, presetId, eventId);
        router.push(url);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "스탬프북 생성에 실패했어요");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || isPending}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
        title={disabled ? disabledTitle : undefined}
      >
        <span aria-hidden>✨</span>
        <span>{isPending ? "만드는 중..." : "이 구성으로 스탬프북 만들기"}</span>
      </button>
      {err && (
        <p role="alert" className="mt-1 text-[10px] font-semibold text-rose-700">
          {err}
        </p>
      )}
    </>
  );
}
