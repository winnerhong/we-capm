"use client";

// QR 미션 토큰 미리보기 + SVG/PNG 다운로드.
//
// 토큰 문자열(예: "mq_1d1b22v1e7fs11l1h") 자체를 QR 에 인코딩.
// 참가자 앱의 QR 스캐너가 해당 문자열을 그대로 읽어 mission.qr_token 과 매칭.

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  /** 인코딩할 문자열 — qr_token. 비어있으면 안내 메시지만 노출. */
  token: string;
  /** 파일명 베이스 (예: 미션 제목). 영문/숫자/한글 외 문자는 _ 로 치환. */
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

export function QrTokenPreview({ token, filenameBase }: Props) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"svg" | "png" | null>(null);
  const trimmed = token.trim();
  const base = sanitize(filenameBase);

  useEffect(() => {
    if (!trimmed) {
      setSvg("");
      setError(null);
      return;
    }
    let cancelled = false;
    QRCode.toString(trimmed, {
      type: "svg",
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((s) => {
        if (!cancelled) {
          setSvg(s);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "QR 생성 실패");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [trimmed]);

  if (!trimmed) {
    return (
      <p className="rounded-lg border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-[11px] text-[#8B7F75]">
        🎲 위쪽 &quot;토큰 생성&quot; 버튼을 눌러 토큰을 먼저 만들면, 인쇄용 QR
        이미지가 여기에 나와요.
      </p>
    );
  }

  function downloadSvg() {
    if (!svg) return;
    setBusy("svg");
    try {
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${base}_QR.svg`);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(null);
    }
  }

  async function downloadPng() {
    setBusy("png");
    try {
      const dataUrl = await QRCode.toDataURL(trimmed, {
        width: 2048,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      triggerDownload(dataUrl, `${base}_QR_2048.png`);
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-800">
        ⚠️ {error}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-[#D4E4BC] bg-[#FFFDF8] p-4">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div
          role="img"
          aria-label="QR 미션 코드"
          dangerouslySetInnerHTML={{ __html: svg }}
          className="h-44 w-44 flex-shrink-0 rounded-lg border-2 border-[#2D5A3D] bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-semibold text-[#2D5A3D]">
            📱 인쇄해서 현장에 부착해주세요
          </p>
          <p className="text-[11px] text-[#6B6560]">
            참가자가 앱의 QR 스캐너로 이 코드를 찍으면 미션이 완료돼요. 토큰은
            아래 문자열입니다 — 인쇄 후 변경하면 기존 QR 은 동작하지 않으니
            주의.
          </p>
          <p className="break-all rounded-lg bg-[#F5F1E8] px-2 py-1.5 font-mono text-[10px] text-[#2C2C2C]">
            {trimmed}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={downloadSvg}
              disabled={busy !== null || !svg}
              className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8] disabled:opacity-50"
              title="벡터 — 어떤 크기로 인쇄해도 깨지지 않음"
            >
              <span aria-hidden>📐</span>
              <span>{busy === "svg" ? "준비 중…" : "SVG"}</span>
            </button>
            <button
              type="button"
              onClick={downloadPng}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8] disabled:opacity-50"
              title="2048×2048 PNG — 메신저/일반 인쇄용"
            >
              <span aria-hidden>🖼</span>
              <span>{busy === "png" ? "준비 중…" : "PNG"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
