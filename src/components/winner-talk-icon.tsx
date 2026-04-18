export function WinnerTalkIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      {/* 말풍선 */}
      <rect x="4" y="6" width="40" height="30" rx="8" fill="#7C3AED" />
      {/* 말풍선 꼬리 */}
      <path d="M14 36L10 44L22 36" fill="#7C3AED" />
      {/* W 글자 */}
      <path d="M12 16L16 28L20 20L24 28L28 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* 하트 */}
      <path d="M33 15C34.5 13 37.5 13 38 15.5C38.5 18 35 21 33 23C31 21 27.5 18 28 15.5C28.5 13 31.5 13 33 15Z" fill="#FBBF24" />
    </svg>
  );
}

export function WinnerTalkLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <WinnerTalkIcon size={28} />
      <span className="font-bold text-violet-600">윙크톡</span>
    </div>
  );
}
