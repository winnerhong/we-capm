"use client";

// 타 기관 계정을 "우리 기관에서만" 내보내는 버튼.
//
// 영구삭제(🗑)와 행사제외(🚫) 사이를 메운다:
//   🚫 행사제외    이 행사 한 건에서만 빠짐. 기관 명단에는 그대로 남는다.
//   📤 기관 내보내기 우리 기관 소속·행사·신청서를 전부 정리. 계정은 그대로.
//   🗑 영구삭제    계정 자체를 지움 — 홈 기관만 가능(타 기관 데이터까지 날아가므로).
//
// 그래서 이 버튼은 홈 기관이 우리가 아닌 행(home_org_name 이 있는 행)에만 뜬다.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeUserFromOrgAction } from "./actions";

export function RemoveFromOrgButton({
  orgId,
  userId,
  displayName,
  /** 그 사람의 홈 기관명 — 무엇이 남는지 문구로 알려주기 위해. */
  homeOrgName,
  variant = "table",
  iconOnly = false,
}: {
  orgId: string;
  userId: string;
  displayName: string;
  homeOrgName: string;
  variant?: "table" | "card";
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (isPending) return;
    const ok = window.confirm(
      `[${displayName}] 가족을 우리 기관에서 내보낼까요?\n\n` +
        `지워지는 것 — 우리 기관 소속, 우리 기관 행사 참가 기록 전부, 접수 신청서\n` +
        `그대로 남는 것 — 계정과 자녀, 도토리, ${homeOrgName}의 데이터\n\n` +
        `기관 명단에서 사라집니다. 다시 부르려면 초대장을 새로 보내거나 참가자로 등록하면 돼요.`
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await removeUserFromOrgAction(orgId, userId);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "내보내기 실패");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        aria-label={`${displayName} 기관에서 내보내기`}
        title={`우리 기관 소속·행사 기록만 제거 (계정과 ${homeOrgName} 데이터는 보존)`}
        className={
          variant === "card"
            ? "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-orange-300 bg-orange-50 px-3 text-[11px] font-semibold leading-none text-orange-800 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
            : iconOnly
              ? "inline-flex h-7 w-7 items-center justify-center rounded-md border border-orange-300 bg-orange-50 text-[13px] leading-none text-orange-800 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
              : "inline-flex h-7 items-center justify-center gap-0.5 whitespace-nowrap rounded-md border border-orange-300 bg-orange-50 px-2 text-[11px] font-semibold leading-none text-orange-800 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        <span aria-hidden>{isPending ? "⏳" : "📤"}</span>
        {!iconOnly && <span>기관에서 빼기</span>}
      </button>
      {error && (
        <span
          role="alert"
          className="ml-1 text-[10px] font-semibold text-rose-700"
        >
          {error}
        </span>
      )}
    </>
  );
}
