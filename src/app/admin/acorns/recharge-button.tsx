"use client";

import { useState } from "react";
import { RechargeModal, type PartnerLite } from "./recharge-modal";
import { AcornIcon } from "@/components/acorn-icon";

/**
 * 관리자 페이지에서 충전 모달을 여는 버튼 + 선택자 묶음.
 * 서버 컴포넌트에서 partners를 전달받아 렌더합니다.
 */
export function RechargeButton({ partners }: { partners: PartnerLite[] }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(partners[0]?.id ?? "");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex-1">
        <label
          htmlFor="acorn-partner-select"
          className="block text-xs font-medium text-[#8B6F47] mb-1"
        >
          숲지기 선택
        </label>
        <select
          id="acorn-partner-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={partners.length === 0}
          className="w-full rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] disabled:bg-neutral-50 disabled:text-neutral-400"
        >
          {partners.length === 0 ? (
            <option>등록된 숲지기 없음</option>
          ) : (
            partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.business_name ? ` (${p.business_name})` : ""} · 도토리{" "}
                {p.acorn_balance.toLocaleString("ko-KR")}
              </option>
            ))
          )}
        </select>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={partners.length === 0}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#2D5A3D] px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1F4229] disabled:opacity-50 disabled:cursor-not-allowed sm:self-end"
      >
        <AcornIcon /> 충전하기
      </button>

      <RechargeModal
        open={open}
        onClose={() => setOpen(false)}
        partners={partners}
        defaultPartnerId={selectedId}
      />
    </div>
  );
}
