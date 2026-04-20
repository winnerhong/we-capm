// 토리로톡 아이콘 — 도토리 모티프 말풍선
export function WinnerTalkIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      {/* 말풍선 (포레스트 그린) */}
      <rect x="4" y="6" width="40" height="30" rx="10" fill="#2D5A3D" />
      {/* 말풍선 꼬리 */}
      <path d="M14 36L10 44L22 36" fill="#2D5A3D" />
      {/* 도토리 본체 (acorn brown) */}
      <ellipse cx="24" cy="24" rx="7" ry="9" fill="#C4956A" />
      {/* 도토리 모자 (bark brown) */}
      <path d="M17 19 Q17 15 24 15 Q31 15 31 19 L31 20 L17 20 Z" fill="#8B6F47" />
      {/* 도토리 꼭지 */}
      <rect x="23" y="13" width="2" height="3" rx="1" fill="#8B6F47" />
      {/* 잎사귀 (leaf green) */}
      <ellipse cx="33" cy="17" rx="3" ry="2" fill="#A8C686" transform="rotate(-30 33 17)" />
    </svg>
  );
}

export function WinnerTalkLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <WinnerTalkIcon size={28} />
      <span className="font-bold text-[#2D5A3D]">토리로톡</span>
    </div>
  );
}
