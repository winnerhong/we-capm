"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteAppUserAction,
  updateAppUserStatusAction,
  type UserStatus,
} from "./actions";

type Variant = "table" | "card";

type Props = {
  orgId: string;
  userId: string;
  userName: string;
  status: UserStatus;
  variant?: Variant;
  /**
   * 비활성화/활성화 토글을 숨김. 행사 탭처럼 "행사제외" 가 더 적합한 컨텍스트에서 사용.
   * 기본 false (기관 전체 /users 페이지에서는 표시).
   */
  hideSuspend?: boolean;
  /**
   * 영구삭제 버튼을 숨김.
   *
   * 삭제는 app_users 행 자체를 지워 그 사람의 **모든 기관** 데이터를 없애므로
   * 홈 기관만 할 수 있다. 타 기관 계정 행에 이 버튼을 띄우면 눌러도 반드시
   * "권한이 없어요" 로 실패한다 — 될 수 없는 버튼은 아예 보이지 않는 게 맞다.
   * 그 자리에는 [기관에서 빼기](RemoveFromOrgButton)가 대신 있다.
   */
  hideDelete?: boolean;
  /** 테이블 좁은 폭에서 아이콘만 노출. variant=table 일 때만 적용. */
  iconOnly?: boolean;
};

export function UserRowActions({
  orgId,
  userId,
  userName,
  status,
  variant = "table",
  hideSuspend = false,
  hideDelete = false,
  iconOnly = false,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // 액션은 실패를 값으로 돌려준다 — throw 하면 프로덕션에서 메시지가
  // 통째로 지워져 사용자가 이유를 알 수 없다.
  const setStatus = (next: UserStatus) => {
    start(async () => {
      try {
        const res = await updateAppUserStatusAction(userId, next);
        if (!res.ok) {
          alert(res.message);
          return;
        }
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "상태 변경 실패");
      }
    });
  };

  const onDelete = () => {
    if (
      !confirm(
        `정말 "${userName}" 참가자를 삭제할까요?\n자녀·출석 기록도 함께 영구 삭제돼요. 되돌릴 수 없어요.`
      )
    )
      return;
    start(async () => {
      try {
        const res = await deleteAppUserAction(userId);
        if (!res.ok) {
          alert(res.message);
          return;
        }
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  };

  const base = iconOnly
    ? "inline-flex h-7 w-7 items-center justify-center rounded-md text-[13px] leading-none transition disabled:opacity-50"
    : "inline-flex h-7 items-center justify-center rounded-md px-2 text-[11px] font-semibold leading-none whitespace-nowrap transition disabled:opacity-50";
  const cardBase =
    "inline-flex h-8 flex-1 items-center justify-center rounded-md px-2 text-[11px] font-semibold leading-none transition disabled:opacity-50";

  const cls = variant === "card" ? cardBase : base;

  const statusButton = (() => {
    if (status === "ACTIVE") {
      return (
        <button
          type="button"
          onClick={() => setStatus("SUSPENDED")}
          disabled={pending}
          title="비활성화"
          aria-label="비활성화"
          className={`${cls} border border-[#E5D3B8] bg-[#FFF8F0] text-[#B8860B] hover:bg-[#FFE9C7]`}
        >
          {iconOnly && variant === "table" ? "💤" : "비활성화"}
        </button>
      );
    }
    if (status === "SUSPENDED") {
      return (
        <button
          type="button"
          onClick={() => setStatus("ACTIVE")}
          disabled={pending}
          title="활성화"
          aria-label="활성화"
          className={`${cls} bg-[#2D5A3D] text-white hover:bg-[#3A7A52]`}
        >
          {iconOnly && variant === "table" ? "✅" : "활성화"}
        </button>
      );
    }
    // CLOSED
    return (
      <button
        type="button"
        onClick={() => setStatus("ACTIVE")}
        disabled={pending}
        title="활성화"
        aria-label="활성화"
        className={`${cls} border border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]`}
      >
        {iconOnly && variant === "table" ? "✅" : "활성화"}
      </button>
    );
  })();

  // ?org=<orgId> 는 미들웨어가 다중 기관 쿠키 중 어느 것을 주입할지 결정하는 데 사용.
  const loginHref = `/api/org/impersonate-user?id=${userId}&org=${orgId}`;

  if (variant === "card") {
    return (
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#F4EFE8] pt-3">
        {status === "ACTIVE" && (
          <a
            href={loginHref}
            target="_blank"
            rel="noopener"
            title={`${userName}님으로 새 창에서 로그인`}
            className={`${cardBase} border border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100`}
          >
            🔑 로그인↗
          </a>
        )}
        {!hideSuspend && statusButton}
        {!hideDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className={`${cardBase} border border-red-200 bg-white text-red-600 hover:bg-red-50`}
          >
            삭제
          </button>
        )}
      </div>
    );
  }

  // Table variant
  return (
    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
      {status === "ACTIVE" ? (
        <a
          href={loginHref}
          target="_blank"
          rel="noopener"
          title={`${userName}님으로 새 창에서 로그인`}
          aria-label="로그인"
          className={`${base} ${iconOnly ? "" : "gap-0.5"} border border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100`}
        >
          {iconOnly ? "🔑" : "🔑 로그인↗"}
        </a>
      ) : null}
      {!hideSuspend && statusButton}
      {!hideDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          title="삭제"
          aria-label="삭제"
          className={`${base} border border-red-200 bg-white text-red-600 hover:bg-red-50`}
        >
          {iconOnly ? "🗑" : "삭제"}
        </button>
      )}
    </div>
  );
}
