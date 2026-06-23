import type { CSSProperties } from "react";

// 기관 문구 타일 — 긴 텍스트를 셀/카드 폭 기준(cqw)으로 자동 축소.
// 부모에 containerType: 'inline-size' 가 있어야 cqw 가 동작.
export function phraseSizeStyle(text: string): CSSProperties {
  const len = (text ?? "").trim().length;

  let cqw: number;
  if (len <= 4) cqw = 24;
  else if (len <= 8) cqw = 16;
  else if (len <= 12) cqw = 12;
  else if (len <= 18) cqw = 9.5;
  else if (len <= 26) cqw = 7.5;
  else cqw = 6;

  return {
    fontSize: `${cqw}cqw`,
    lineHeight: 1.12,
    display: "-webkit-box",
    WebkitLineClamp: 4,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
    overflowWrap: "anywhere" as const,
    textShadow: "0 1px 2px rgba(0,0,0,.55)",
  };
}
