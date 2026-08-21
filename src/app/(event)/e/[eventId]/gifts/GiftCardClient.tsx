"use client";

// pending 상태 선물 카드의 [QR 보기] 버튼 + QR 모달 래퍼.
// page.tsx(SSR)는 카드 레이아웃만 그리고, 실제 인터랙션(QR 생성/Realtime 구독)은 여기서 처리.

import { useState } from "react";
import type { UserGiftRow } from "@/lib/gifts/types";
import { GiftQrModal } from "./GiftQrModal";

interface Props {
  gift: UserGiftRow;
  userId: string;
}

export function GiftCardClient({ gift, userId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-bold text-white shadow-sm transition hover:bg-amber-600 active:scale-95"
        aria-label={`${gift.gift_label} QR 보기`}
      >
        <span aria-hidden>📱</span>
        <span>QR 보기</span>
      </button>

      {open ? (
        <GiftQrModal
          gift={gift}
          userId={userId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
