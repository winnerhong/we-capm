"use client";

import { useState, useEffect } from "react";

interface Props {
  deliveryId: string;
  couponTitle: string;
  affiliateName: string;
  discountLabel: string;
}

export function GiftQRModal({ deliveryId, couponTitle, affiliateName, discountLabel }: Props) {
  const [showQR, setShowQR] = useState(false);
  const [timestamp, setTimestamp] = useState(Date.now());

  // 30초마다 QR 자동 갱신 (위변조 방지)
  useEffect(() => {
    if (!showQR) return;
    const interval = setInterval(() => {
      setTimestamp(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, [showQR]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrContent = `${origin}/api/gift/use?delivery_id=${deliveryId}&t=${timestamp}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrContent)}`;

  return (
    <>
      <button
        onClick={() => {
          setShowQR(true);
          setTimestamp(Date.now());
        }}
        className="w-full rounded-xl bg-violet-600 py-2.5 text-center text-sm font-bold text-white hover:bg-violet-700 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-violet-400"
        aria-label={`${couponTitle} 사용하기`}
      >
        사용하기 🎁
      </button>

      {showQR && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowQR(false)}
          role="dialog"
          aria-modal="true"
          aria-label="쿠폰 QR 코드"
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 text-center animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 쿠폰 요약 */}
            <div className="rounded-2xl bg-gradient-to-r from-[#FFF2D6] to-[#F5D9B5] p-4 mb-4">
              <div className="text-xs text-[#8B6F47] font-medium">{affiliateName}</div>
              <h3 className="mt-1 text-lg font-bold text-[#8B6F47]">🎁 {couponTitle}</h3>
              <div className="mt-2 inline-block rounded-full bg-[#C4956A] px-3 py-1 text-sm font-bold text-white">
                {discountLabel}
              </div>
            </div>

            {/* QR 코드 */}
            <div className="relative mx-auto mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt="쿠폰 사용 QR 코드"
                className="mx-auto h-52 w-52 rounded-2xl border-4 border-[#D4E4BC]"
              />
            </div>

            <p className="text-sm font-semibold text-[#2D5A3D] mb-1">
              가게에 이 QR을 보여주세요 🏪
            </p>
            <p className="text-[11px] text-[#A8A49F]">30초마다 자동으로 바뀌어요</p>

            <button
              onClick={() => setShowQR(false)}
              className="mt-5 w-full rounded-xl border-2 border-[#D4E4BC] py-3 text-sm font-semibold text-[#6B6560] hover:bg-[#E8F0E4] transition-colors focus:outline-none focus:ring-2 focus:ring-[#A8C686]"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
