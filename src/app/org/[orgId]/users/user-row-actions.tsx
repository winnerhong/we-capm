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
};

export function UserRowActions({
  orgId,
  userId,
  userName,
  status,
  variant = "table",
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const setStatus = (next: UserStatus) => {
    start(async () => {
      try {
        await updateAppUserStatusAction(userId, next);
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
        await deleteAppUserAction(userId);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  };

  const base =
    "inline-flex h-7 items-center justify-center rounded-md px-2 text-[11px] font-semibold leading-none whitespace-nowrap transition disabled:opacity-50";
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
          className={`${cls} border border-[#E5D3B8] bg-[#FFF8F0] text-[#B8860B] hover:bg-[#FFE9C7]`}
        >
          비활성화
        </button>
      );
    }
    if (status === "SUSPENDED") {
      return (
        <button
          type="button"
          onClick={() => setStatus("ACTIVE")}
          disabled={pending}
          className={`${cls} bg-[#2D5A3D] text-white hover:bg-[#3A7A52]`}
        >
          활성화
        </button>
      );
    }
    // CLOSED
    return (
      <button
        type="button"
        onClick={() => setStatus("ACTIVE")}
        disabled={pending}
        className={`${cls} border border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]`}
      >
        활성화
      </button>
    );
  })();

  const loginHref = `/api/org/impersonate-user?id=${userId}`;

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
        {statusButton}
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className={`${cardBase} border border-red-200 bg-white text-red-600 hover:bg-red-50`}
        >
          삭제
        </button>
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
          className={`${base} gap-0.5 border border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100`}
        >
          🔑 로그인↗
        </a>
      ) : null}
      {statusButton}
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className={`${base} border border-red-200 bg-white text-red-600 hover:bg-red-50`}
      >
        삭제
      </button>
    </div>
  );
}
