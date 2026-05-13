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

// 스캔 URL 생성 — QR 안에 인코딩될 절대 URL.
// 우선순위: 명시적 baseUrl > NEXT_PUBLIC_SITE_URL > VERCEL_PROJECT_PRODUCTION_URL > VERCEL_URL > window.location (브라우저).
// 상대 경로(`/trail/...`) 로 끝나면 폰 카메라가 URL 로 인식 못 함 — 절대 URL 보장 필수.
export function buildQrUrl(qrCode: string, baseUrl?: string): string {
  const base = resolveBaseUrl(baseUrl);
  return `${base}/trail/${qrCode}`;
}

function resolveBaseUrl(explicit?: string): string {
  if (explicit && explicit.trim()) return stripTrailingSlash(explicit.trim());

  const envBase =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (envBase) return stripTrailingSlash(envBase);

  // 브라우저 컨텍스트 — current origin
  if (typeof window !== "undefined" && window.location?.origin) {
    return stripTrailingSlash(window.location.origin);
  }

  // 마지막 보루 — 빈 문자열 반환하면 상대 URL 이 되어 폰 스캔 시 동작 안 함.
  // 개발 환경에서만 표시되도록 콘솔 경고 (production 에서는 위에서 잡힘).
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[buildQrUrl] base URL 미설정 — NEXT_PUBLIC_SITE_URL 또는 VERCEL_URL 환경변수 필요"
    );
  }
  return "";
}

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
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

/**
 * SVG 문자열 생성 — 벡터라 A3/A0 등 어떤 크기로 인쇄해도 깨지지 않음.
 * `<div dangerouslySetInnerHTML={{ __html: svg }} />` 로 렌더하거나
 * `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` 로 img src 에 사용.
 */
export async function generateQrSvg(
  qrCode: string,
  options?: { baseUrl?: string }
): Promise<string> {
  const url = buildQrUrl(qrCode, options?.baseUrl);
  return QRCode.toString(url, {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "M",
  });
}
