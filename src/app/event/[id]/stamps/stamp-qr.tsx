"use client";

import { useState, useEffect } from "react";
import { AcornIcon } from "@/components/acorn-icon";

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
        className="w-full rounded-2xl bg-violet-600 py-4 text-center font-bold text-white shadow-lg shadow-[#2D5A3D]/20 hover:bg-violet-700 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2"
      >
        <AcornIcon size={20} /> 도토리 받기
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
            <div className="rounded-2xl bg-gradient-to-r from-[#E8F0E4] to-[#D4E4BC] p-4 mb-4">
              <div className="text-sm text-[#4A7C59] font-medium">{currentTier}</div>
              <h3 className="text-xl font-bold text-[#2D5A3D]">🐿️ {participantName}</h3>
              <div className="mt-1 text-sm text-[#4A7C59]">
                도토리 <span className="font-bold text-[#2D5A3D]">{stampCount}</span>개 모음 <AcornIcon />
              </div>
            </div>

            {/* QR code */}
            <div className="relative mx-auto mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt="도토리 QR 코드"
                className="mx-auto h-52 w-52 rounded-2xl border-4 border-[#D4E4BC]"
              />
            </div>

            <p className="text-xs text-[#6B6560] mb-1">숲지기에게 이 화면을 보여주세요 🌲</p>
            <p className="text-[10px] text-[#A8A49F]">30초마다 자동으로 바뀌어요</p>

            <button
              onClick={() => setShowQR(false)}
              className="mt-5 w-full rounded-xl border-2 border-[#D4E4BC] py-3 text-sm font-semibold text-[#6B6560] hover:bg-[#E8F0E4] transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
