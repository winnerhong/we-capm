// 공용 유틸 — 시간 포맷 / 대기 뱃지 색 결정
export function formatAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

export type WaitTone = "calm" | "warn" | "hot";

export function waitTone(minutes: number): WaitTone {
  if (minutes >= 30) return "hot";
  if (minutes >= 10) return "warn";
  return "calm";
}

export const WAIT_TONE_CLASSES: Record<WaitTone, string> = {
  calm: "border-[#D4E4BC] bg-[#F5F1E8] text-[#6B6560]",
  warn: "border-[#FFC83D]/60 bg-[#FFF4D6] text-[#8A6A10]",
  hot: "border-rose-300 bg-rose-50 text-rose-700",
};
