import QRCode from "qrcode";

// 8자리 영숫자 (혼동 글자 O,I,0,1 제외) 고유 코드 생성
export function generateQrCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 스캔 URL 생성
export function buildQrUrl(qrCode: string, baseUrl?: string): string {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return `${base}/trail/${qrCode}`;
}

// DataURL PNG 생성 (이미지 태그 src로 바로 사용)
export async function generateQrDataUrl(
  qrCode: string,
  options?: { baseUrl?: string; size?: number }
): Promise<string> {
  const url = buildQrUrl(qrCode, options?.baseUrl);
  return QRCode.toDataURL(url, {
    width: options?.size ?? 512,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}
