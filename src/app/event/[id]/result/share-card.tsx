"use client";

import { useRef } from "react";

interface Props {
  eventName: string;
  rank: number;
  totalParticipants: number;
  score: number;
  completedMissions: number;
  totalMissions: number;
  rewardCount: number;
}

export function ShareCard({
  eventName,
  rank,
  totalParticipants,
  score,
  completedMissions,
  totalMissions,
  rewardCount,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    if (!cardRef.current) return;

    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#7c3aed",
        scale: 2,
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) return;

      if (navigator.share && navigator.canShare?.({ files: [new File([blob], "result.png")] })) {
        await navigator.share({
          title: `${eventName} 결과`,
          files: [new File([blob], `${eventName}_결과.png`, { type: "image/png" })],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${eventName}_결과.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      alert("이미지 생성에 실패했습니다");
    }
  };

  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}등`;

  return (
    <div className="space-y-3">
      <div
        ref={cardRef}
        className="rounded-2xl bg-gradient-to-br from-violet-600 to-purple-800 p-8 text-center text-white"
      >
        <p className="text-sm opacity-80">{eventName}</p>
        <div className="mt-4 text-6xl">{medal}</div>
        <p className="mt-2 text-lg">
          {totalParticipants}명 중 <strong>{rank}등</strong>
        </p>
        <div className="mt-4 text-4xl font-bold">{score}점</div>
        <div className="mt-4 flex justify-center gap-6 text-sm opacity-90">
          <div>
            <div className="text-lg font-bold">{completedMissions}/{totalMissions}</div>
            <div>미션 완료</div>
          </div>
          <div>
            <div className="text-lg font-bold">{rewardCount}</div>
            <div>보상 획득</div>
          </div>
        </div>
        <p className="mt-6 text-xs opacity-60">캠프닉 CampNic</p>
      </div>

      <button
        onClick={handleShare}
        className="w-full rounded-lg border bg-white py-3 font-semibold hover:bg-neutral-50"
      >
        📤 결과 카드 저장/공유
      </button>
    </div>
  );
}
