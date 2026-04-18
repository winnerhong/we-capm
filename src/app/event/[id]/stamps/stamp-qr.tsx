"use client";

import { useState, useEffect } from "react";

interface Props {
  participantId: string;
  eventId: string;
  participantName: string;
  stampCount: number;
  currentTier: string;
}

export function StampQRModal({ participantId, eventId, participantName, stampCount, currentTier }: Props) {
  const [showQR, setShowQR] = useState(false);
  const [timestamp, setTimestamp] = useState(Date.now());

  // Auto-refresh QR every 30 seconds
  useEffect(() => {
    if (!showQR) return;
    const interval = setInterval(() => {
      setTimestamp(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, [showQR]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrContent = `${origin}/api/stamp?pid=${participantId}&eid=${eventId}&t=${timestamp}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrContent)}`;

  return (
    <>
      <button
        onClick={() => { setShowQR(true); setTimestamp(Date.now()); }}
        className="w-full rounded-2xl bg-violet-600 py-4 text-center font-bold text-white shadow-lg shadow-violet-200 hover:bg-violet-700 active:scale-[0.98] transition-all"
      >
        📱 도장 요청하기
      </button>

      {showQR && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowQR(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 text-center animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Participant info */}
            <div className="rounded-2xl bg-gradient-to-r from-violet-50 to-purple-50 p-4 mb-4">
              <div className="text-sm text-violet-600 font-medium">{currentTier}</div>
              <h3 className="text-xl font-bold text-violet-800">{participantName}</h3>
              <div className="mt-1 text-sm text-violet-500">
                도장 <span className="font-bold text-violet-700">{stampCount}</span>개 수집
              </div>
            </div>

            {/* QR code */}
            <div className="relative mx-auto mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt="스탬프 QR 코드"
                className="mx-auto h-52 w-52 rounded-2xl border-4 border-violet-100"
              />
            </div>

            <p className="text-xs text-neutral-500 mb-1">스태프에게 이 화면을 보여주세요</p>
            <p className="text-[10px] text-neutral-300">30초마다 자동 갱신됩니다</p>

            <button
              onClick={() => setShowQR(false)}
              className="mt-5 w-full rounded-xl border-2 border-neutral-200 py-3 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
