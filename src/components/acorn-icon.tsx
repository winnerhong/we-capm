import type { SVGProps } from "react";

// 도토리 아이콘 (미니멀 라인 스타일)
// - `currentColor` 로 부모 텍스트 색상을 상속 → `text-[#2D5A3D]` 같은 클래스로 제어.
// - 기본 16px. 인라인 기본 · 베이스라인 정렬.
type Props = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number | string;
};

export function AcornIcon({ size = 16, className = "", ...rest }: Props) {
  return (
    <svg
      {...rest}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block align-[-0.125em] ${className}`}
      aria-hidden
    >
      <path d="M32 6 L32 14" />
      <path d="M14 22 Q14 14 32 14 Q50 14 50 22 L50 26 Q50 30 46 30 L18 30 Q14 30 14 26 Z" />
      <path d="M14 26 L50 26" />
      <path d="M18 30 Q18 52 32 58 Q46 52 46 30" />
    </svg>
  );
}
