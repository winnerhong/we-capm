"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOrgAction, updateOrgStatusAction } from "./actions";
import type { OrgStatus } from "./actions";

type Variant = "table" | "card";

type Props = {
  orgId: string;
  orgName: string;
  status: OrgStatus;
  variant?: Variant;
};

export function OrgRowActions({
  orgId,
  orgName,
  status,
  variant = "table",
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const setStatus = (next: OrgStatus) => {
    start(async () => {
      try {
        await updateOrgStatusAction(orgId, next);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "상태 변경 실패");
      }
    });
  };

  const onDelete = () => {
    if (
      !confirm(
        `정말로 "${orgName}" 기관을 삭제(해지)할까요? 되돌리려면 상태를 다시 활성으로 바꿔야 해요.`
      )
    )
      return;
    start(async () => {
      try {
        await deleteOrgAction(orgId);
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

  // 상태별 주요 토글 버튼
  const statusButton = (() => {
    if (status === "ACTIVE") {
      return (
        <button
          type="button"
          onClick={() => setStatus("SUSPENDED")}
          disabled={pending}
          className={`${cls} border border-[#E5D3B8] bg-[#FFF8F0] text-[#B8860B] hover:bg-[#FFE9C7]`}
        >
          정지
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
          재활성
        </button>
      );
    }
    if (status === "CLOSED") {
      return (
        <button
          type="button"
          onClick={() => setStatus("ACTIVE")}
          disabled={pending}
          className={`${cls} border border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]`}
        >
          복구
        </button>
      );
    }
    // INACTIVE
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
  })();

  if (variant === "card") {
    return (
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#D4E4BC] pt-3">
        <a
          href={`/api/partner/impersonate-org?id=${orgId}`}
          target="_blank"
          rel="noopener"
          title={`${orgName}(으)로 새 창에서 로그인 전환`}
          className={`${cardBase} border border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100`}
        >
          🔑 로그인↗
        </a>
        <Link
          href={`/partner/customers/org/${orgId}/edit`}
          className={`${cardBase} border border-[#E5D3B8] bg-white text-[#6B4423] hover:bg-[#FFF8F0]`}
        >
          편집
        </Link>
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
      <a
        href={`/api/partner/impersonate-org?id=${orgId}`}
        target="_blank"
        rel="noopener"
        title={`${orgName}(으)로 새 창에서 로그인 전환`}
        className={`${base} gap-0.5 border border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100`}
      >
        🔑 로그인↗
      </a>
      <Link
        href={`/partner/customers/org/${orgId}`}
        className={`${base} border border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#E8F0E4]`}
      >
        상세
      </Link>
      <Link
        href={`/partner/customers/org/${orgId}/edit`}
        className={`${base} border border-[#E5D3B8] bg-white text-[#6B4423] hover:bg-[#FFF8F0]`}
      >
        편집
      </Link>
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
