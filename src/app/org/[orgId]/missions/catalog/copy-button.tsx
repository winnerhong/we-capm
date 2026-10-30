"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { copyToOrgAction } from "../actions";

type Props = {
  partnerMissionId: string;
  questPackId?: string;
  alreadyInPack?: boolean;
};

export function CopyToOrgButton({
  partnerMissionId,
  questPackId,
  alreadyInPack,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function handleClick() {
    setErr(null);
    startTransition(async () => {
      try {
        // 액션은 편집 화면 URL 을 돌려준다 — 서버 redirect() 는 세션이 풀리는
        // 버그가 있어 클라이언트에서 이동한다 (missions/actions.ts 주석 참고).
        const url = await copyToOrgAction(partnerMissionId, questPackId);
        router.push(url);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "복사 실패");
      }
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-60 ${
          alreadyInPack
            ? "border border-[#D4E4BC] bg-[#E8F0E4] text-[#2D5A3D] hover:bg-[#D4E4BC]"
            : "bg-[#2D5A3D] text-white hover:bg-[#234a30]"
        }`}
      >
        <span aria-hidden>📋</span>
        <span>
          {isPending
            ? "복사 중..."
            : alreadyInPack
              ? "한 번 더 복사하기"
              : "복사해서 쓰기"}
        </span>
      </button>
      {err && (
        <p role="alert" className="text-[10px] font-semibold text-rose-700">
          {err}
        </p>
      )}
    </div>
  );
}
