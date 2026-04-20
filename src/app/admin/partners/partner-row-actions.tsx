"use client";

import { useTransition } from "react";
import {
  deletePartnerAction,
  updatePartnerStatusAction,
  updatePartnerTierAction,
} from "./actions";

type Status = "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED";
type Tier = "SPROUT" | "EXPLORER" | "TREE" | "FOREST" | "LEGEND";

export function PartnerRowActions({
  id,
  status,
  tier,
  name,
}: {
  id: string;
  status: Status;
  tier: Tier;
  name: string;
}) {
  const [pending, start] = useTransition();

  const onStatus = (next: Status) => {
    start(async () => {
      try {
        await updatePartnerStatusAction(id, next);
      } catch (e) {
        alert(e instanceof Error ? e.message : "상태 변경 실패");
      }
    });
  };

  const onTier = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (next === tier) return;
    start(async () => {
      try {
        await updatePartnerTierAction(id, next);
      } catch (err) {
        alert(err instanceof Error ? err.message : "등급 변경 실패");
      }
    });
  };

  const onDelete = () => {
    if (!confirm(`정말로 "${name}" 숲지기를 삭제할까요? 되돌릴 수 없어요.`)) return;
    start(async () => {
      try {
        await deletePartnerAction(id);
      } catch (e) {
        alert(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={tier}
        onChange={onTier}
        disabled={pending}
        aria-label="등급 변경"
        className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-xs text-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
      >
        <option value="SPROUT">🌱 새싹</option>
        <option value="EXPLORER">🌿 탐험가</option>
        <option value="TREE">🌳 나무</option>
        <option value="FOREST">🏞️ 숲</option>
        <option value="LEGEND">🌟 레전드</option>
      </select>

      {status === "PENDING" && (
        <button
          type="button"
          onClick={() => onStatus("ACTIVE")}
          disabled={pending}
          className="rounded-lg bg-[#2D5A3D] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#3A7A52] disabled:opacity-50"
        >
          승인
        </button>
      )}
      {status === "ACTIVE" && (
        <button
          type="button"
          onClick={() => onStatus("SUSPENDED")}
          disabled={pending}
          className="rounded-lg border border-[#E5D3B8] bg-[#FFF8F0] px-2.5 py-1 text-xs font-semibold text-[#B8860B] hover:bg-[#FFE9C7] disabled:opacity-50"
        >
          정지
        </button>
      )}
      {status === "SUSPENDED" && (
        <button
          type="button"
          onClick={() => onStatus("ACTIVE")}
          disabled={pending}
          className="rounded-lg bg-[#2D5A3D] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#3A7A52] disabled:opacity-50"
        >
          재활성
        </button>
      )}
      {status === "CLOSED" && (
        <button
          type="button"
          onClick={() => onStatus("ACTIVE")}
          disabled={pending}
          className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4] disabled:opacity-50"
        >
          복구
        </button>
      )}

      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        삭제
      </button>
    </div>
  );
}
