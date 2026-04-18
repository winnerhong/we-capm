"use client";

import { useState } from "react";

interface Props {
  claimId: string;
  rewardName: string;
}

export function ClaimQRButton({ claimId, rewardName }: Props) {
  const [showQR, setShowQR] = useState(false);

  const qrUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/claim?claimId=${claimId}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`;

  return (
    <>
      <button onClick={() => setShowQR(true)}
        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700">
        📱 수령하기
      </button>

      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowQR(false)}>
          <div className="w-full max-w-xs rounded-2xl bg-white p-6 text-center"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">🎁 {rewardName}</h3>
            <p className="text-xs text-neutral-500 mb-4">스태프에게 이 QR을 보여주세요</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrImageUrl} alt="QR" className="mx-auto h-48 w-48 rounded-xl border" />
            <p className="text-[10px] text-neutral-400 mt-3 break-all">{qrUrl}</p>
            <button onClick={() => setShowQR(false)}
              className="mt-4 w-full rounded-xl border py-2.5 text-sm hover:bg-neutral-50">
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
