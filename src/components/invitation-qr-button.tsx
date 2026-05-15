"use client";

// 초대장 링크 QR 생성·다운로드 — 카드 형태로 표시 + SVG/PNG 다운로드.
// 초대장 공유 카드에서 사용.

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

type Props = {
  /** QR 에 인코딩할 절대 URL. */
  url: string;
  /** 파일명·모달 제목용 (예: 행사 이름). */
  eventName: string;
};

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9가-힣]+/g, "_").replace(/^_+|_+$/g, "") || "invitation";
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function InvitationQrButton({ url, eventName }: Props) {
  const [open, setOpen] = useState(false);
  const [svg, setSvg] = useState("");
  const [busy, setBusy] = useState<"svg" | "png" | null>(null);
  const base = sanitize(`${eventName}_초대장`);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    QRCode.toString(url, {
      type: "svg",
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((s) => {
        if (!cancelled) setSvg(s);
      })
      .catch(() => {
        if (!cancelled) setSvg("");
      });
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  function downloadSvg() {
    if (!svg) return;
    setBusy("svg");
    try {
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      triggerDownload(href, `${base}_QR.svg`);
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } finally {
      setBusy(null);
    }
  }

  async function downloadPng() {
    if (!url) return;
    setBusy("png");
    try {
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!url}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] hover:bg-[#F5F1E8] disabled:opacity-50"
        title="초대장 링크의 QR 코드 보기·다운로드"
      >
        <span aria-hidden>🎫</span>
        <span>QR 코드</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${eventName} 초대장 QR`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
                <span aria-hidden>🎫</span>
                <span className="line-clamp-1">초대장 QR</span>
              </h3>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D4E4BC] bg-white text-sm text-[#6B6560] hover:bg-[#F5F1E8]"
              >
                ✕
              </button>
            </div>

            <p className="mt-1 line-clamp-1 text-[11px] text-[#6B6560]">
              {eventName}
            </p>

            <div className="mt-4 flex justify-center">
              {svg ? (
                <div
                  role="img"
                  aria-label={`${eventName} 초대장 QR`}
                  dangerouslySetInnerHTML={{ __html: svg }}
                  className="h-56 w-56 rounded-xl border-2 border-[#2D5A3D] bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
                />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-xl border-2 border-dashed border-[#D4E4BC] text-xs text-[#8B7F75]">
                  ⏳ QR 생성 중…
                </div>
              )}
            </div>

            <p className="mt-3 break-all rounded-lg bg-[#F5F1E8] px-3 py-2 text-center text-[10px] text-[#2C2C2C]">
              🔗 {url}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={downloadSvg}
                disabled={busy !== null || !svg}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8] disabled:opacity-50"
                title="벡터 — 어떤 크기로 인쇄해도 깨지지 않음"
              >
                <span aria-hidden>📐</span>
                <span>{busy === "svg" ? "준비 중…" : "SVG"}</span>
              </button>
              <button
                type="button"
                onClick={downloadPng}
                disabled={busy !== null}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8] disabled:opacity-50"
                title="2048×2048 PNG — 메신저·일반 인쇄용"
              >
                <span aria-hidden>🖼</span>
                <span>{busy === "png" ? "준비 중…" : "PNG"}</span>
              </button>
            </div>

            <p className="mt-3 text-center text-[11px] leading-relaxed text-[#8B7F75]">
              💡 인쇄·게시판 부착·메신저 공유 모두 가능. SVG 는 무한 확대,
              PNG 는 2048px 고해상도.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
