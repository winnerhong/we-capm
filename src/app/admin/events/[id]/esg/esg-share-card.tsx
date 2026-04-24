"use client";

import { useRef, useState } from "react";
import { AcornIcon } from "@/components/acorn-icon";

interface Props {
  eventName: string;
  companyName: string;
  eventDate: string;
  totalScore: number;
  grade: string;
  co2Saved: number;
  treesPlanted: number;
  familiesConnected: number;
  averageRating: number;
}

const GRADE_THEME: Record<string, string> = {
  AAA: "from-[#FFD700] via-[#F5C518] to-[#B8860B]",
  AA: "from-[#FFD66B] via-[#E6B800] to-[#9C7409]",
  A: "from-[#7FD687] via-[#4A7C59] to-[#2D5A3D]",
  BBB: "from-[#A8E6A1] via-[#6AB04A] to-[#2D5A3D]",
  BB: "from-[#C8E6C9] via-[#81C784] to-[#388E3C]",
  B: "from-[#E0E0E0] via-[#9E9E9E] to-[#616161]",
};

export function ESGShareCard({
  eventName,
  companyName,
  eventDate,
  totalScore,
  grade,
  co2Saved,
  treesPlanted,
  familiesConnected,
  averageRating,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const gradient = GRADE_THEME[grade] ?? GRADE_THEME.B;

  const handleShare = async () => {
    if (!cardRef.current || isSharing) return;
    setIsSharing(true);

    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#FFFFFF",
        scale: 2,
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) return;

      const fileName = `${companyName}_${eventName}_ESG리포트.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${eventName} ESG 리포트`,
          text: `${companyName}의 ESG 임팩트 — 등급 ${grade}, 점수 ${totalScore}/100`,
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      alert("이미지 생성에 실패했습니다");
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("링크 복사에 실패했습니다");
    }
  };

  return (
    <div className="space-y-3">
      {/* Shareable Card */}
      <div
        ref={cardRef}
        className="rounded-3xl bg-white p-8 shadow-xl border-2 border-[#D4E4BC]"
      >
        {/* Header: Logo + Title */}
        <div className="flex items-center justify-between border-b-2 border-[#E8F0E4] pb-4">
          <div className="flex items-center gap-2">
            <AcornIcon size={24} className="text-[#2D5A3D]" />
            <span className="font-bold text-[#2D5A3D]">토리로</span>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold tracking-widest text-[#8B6F47]">
              ESG IMPACT REPORT
            </div>
            <div className="text-[10px] text-[#6B6560]">{eventDate}</div>
          </div>
        </div>

        {/* Company + Event */}
        <div className="mt-5 text-center">
          <div className="text-[10px] font-semibold tracking-widest text-[#8B6F47]">
            PREPARED FOR
          </div>
          <div className="mt-1 text-xl font-extrabold text-[#2D5A3D]">{companyName}</div>
          <div className="mt-1 text-sm text-[#6B6560]">{eventName}</div>
        </div>

        {/* Grade Badge */}
        <div className="mt-6 flex justify-center">
          <div
            className={`relative rounded-3xl bg-gradient-to-br ${gradient} px-10 py-6 text-center text-white shadow-xl`}
          >
            <div className="text-[10px] font-bold tracking-widest opacity-80">ESG GRADE</div>
            <div className="mt-1 text-5xl font-extrabold">{grade}</div>
            <div className="mt-1 text-xs opacity-90">Score {totalScore}/100</div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-center">
            <div className="text-xl">🌳</div>
            <div className="mt-1 text-lg font-extrabold text-green-800">
              {co2Saved.toLocaleString("ko-KR")}
              <span className="text-xs font-semibold"> kg</span>
            </div>
            <div className="text-[10px] text-green-700">CO2 절감</div>
          </div>
          <div className="rounded-xl bg-lime-50 border border-lime-200 p-3 text-center">
            <div className="text-xl">🌱</div>
            <div className="mt-1 text-lg font-extrabold text-lime-800">
              {treesPlanted.toLocaleString("ko-KR")}
              <span className="text-xs font-semibold"> 그루</span>
            </div>
            <div className="text-[10px] text-lime-700">가상 나무 심기</div>
          </div>
          <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 text-center">
            <div className="text-xl">👨‍👩‍👧</div>
            <div className="mt-1 text-lg font-extrabold text-sky-800">
              {familiesConnected.toLocaleString("ko-KR")}
              <span className="text-xs font-semibold"> 가족</span>
            </div>
            <div className="text-[10px] text-sky-700">연결된 가족</div>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
            <div className="text-xl">⭐</div>
            <div className="mt-1 text-lg font-extrabold text-amber-800">
              {averageRating.toFixed(1)}
              <span className="text-xs font-semibold"> / 5</span>
            </div>
            <div className="text-[10px] text-amber-700">평균 만족도</div>
          </div>
        </div>

        {/* Signature */}
        <div className="mt-6 border-t-2 border-[#E8F0E4] pt-4 text-center">
          <div className="text-[10px] text-[#8B6F47]">
            🌲 본 리포트는 토리로 플랫폼 데이터를 기반으로 생성되었습니다
          </div>
          <div className="mt-1 text-[9px] text-[#8B6F47] opacity-60">
            Toriro ESG Analytics · toriro.kr
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleShare}
          disabled={isSharing}
          className="w-full rounded-xl border-2 border-[#2D5A3D] bg-[#2D5A3D] py-3 text-sm font-bold text-white hover:bg-[#3A7A52] disabled:opacity-50"
        >
          {isSharing ? "생성중..." : "🖼️ 이미지로 저장/공유"}
        </button>
        <button
          type="button"
          onClick={handleCopyLink}
          className="w-full rounded-xl border-2 border-[#D4E4BC] bg-white py-3 text-sm font-bold text-[#2D5A3D] hover:bg-[#FFF8F0]"
        >
          {copied ? "✅ 복사됨" : "🔗 공유 링크 복사"}
        </button>
      </div>
    </div>
  );
}
