"use client";

// QR 다운로드 — 벡터(SVG) / 이미지(PNG 2048px)
//
// - SVG: 무한 확대 가능. 인쇄·디자인 작업용. 미리 서버에서 생성한 문자열을 Blob 으로 변환.
// - PNG: 클라이언트에서 qrcode 라이브러리로 2048px 고해상도 생성 후 dataURL → 다운로드.
//        2048px 면 A3(297mm) 인쇄에서 약 175 DPI — 충분히 선명.

import { useState } from "react";
import QRCode from "qrcode";
import { buildQrUrl } from "@/lib/trails/qr-code";

type Props = {
  /** 8자리 영숫자 QR 코드. PNG 생성에 사용 (스캔 URL 빌드용). */
  qrCode: string;
  /** SVG 문자열 — 서버에서 생성된 것을 그대로 다운로드. */
  qrSvg: string;
  /** 파일명 prefix (예: 코스 이름). 영문/숫자 외 문자는 _로 치환. */
  filenameBase: string;
};

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9가-힣]+/g, "_").replace(/^_+|_+$/g, "") || "qr";
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function QrDownloadButtons({ qrCode, qrSvg, filenameBase }: Props) {
  const [busy, setBusy] = useState<"svg" | "png" | null>(null);
  const base = sanitize(filenameBase);

  function downloadSvg() {
    setBusy("svg");
    try {
      const blob = new Blob([qrSvg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${base}_QR.svg`);
      // 다운로드 시작 후 URL 정리
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(null);
    }
  }

  async function downloadPng() {
    setBusy("png");
    try {
      const url = buildQrUrl(qrCode);
      // 2048px — A3 인쇄에 충분. errorCorrection M, margin 2.
      const dataUrl = await QRCode.toDataURL(url, {
        width: 2048,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      triggerDownload(dataUrl, `${base}_QR_2048.png`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={downloadSvg}
        disabled={busy !== null}
        className="inline-flex items-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8] disabled:opacity-50"
        title="벡터 — 어떤 크기로 확대해도 깨지지 않음. 인쇄·디자인 작업용."
      >
        <span aria-hidden>📐</span>
        <span>{busy === "svg" ? "준비 중…" : "SVG 다운로드"}</span>
      </button>
      <button
        type="button"
        onClick={downloadPng}
        disabled={busy !== null}
        className="inline-flex items-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8] disabled:opacity-50"
        title="2048×2048 px PNG — 메신저 공유·일반 인쇄에 적합."
      >
        <span aria-hidden>🖼</span>
        <span>{busy === "png" ? "준비 중…" : "PNG 다운로드"}</span>
      </button>
    </div>
  );
}
