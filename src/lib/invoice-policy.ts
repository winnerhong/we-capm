/** 도토리 충전 티어별 보너스율 (중앙 정책) */
export function acornBonusRate(amountKRW: number): number {
  if (amountKRW >= 3_000_000) return 20;
  if (amountKRW >= 1_000_000) return 15;
  if (amountKRW >= 300_000) return 10;
  return 0;
}
