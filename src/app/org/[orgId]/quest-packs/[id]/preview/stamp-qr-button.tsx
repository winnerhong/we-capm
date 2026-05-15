"use client";

// 스탬프북 격자 미리보기 — 칸별 QR 다운로드 버튼 + 모달.
// QR_QUIZ 의 qr_token, TREASURE 의 final_qr_token 만 인코딩 (참가자 스캐너가 그대로 매칭).

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

type Props = {
  /** 인코딩할 토큰 문자열. */
  token: string;
  /** 다운로드 파일명 베이스 (미션 제목). */
  filenameBase: string;
  /** 칸 라벨 (모달 제목용). */
  missionTitle: string;
  /** 칸 번호 (모달 제목용). */
  index: number;
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

export function StampQrButton({
  token,
  filenameBase,
  missionTitle,
  index,
}: Props) {
  const [open, setOpen] = useState(false);
  const [svg, setSvg] = useState("");
  const [busy, setBusy] = useState<"svg" | "png" | null>(null);
  const trimmed = token.trim();
  const base = sanitize(`${index}_${filenameBase}`);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !trimmed) return;
    let cancelled = false;
    QRCode.toString(trimmed, {
      type: "svg",
      margin: 2,
      errorCorrectionLevel: "M",
    }).then((s) => {
      if (!cancelled) setSvg(s);
    });
    return () => {
      cancelled = true;
    };
  }, [open, trimmed]);

  // ESC 로 모달 닫기 + 열렸을 때 닫기 버튼 포커스
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

  if (!trimmed) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`${missionTitle} QR 다운로드`}
        title="이 미션의 QR 보기·다운로드"
        className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#2D5A3D]/90 text-xs text-white shadow-sm transition hover:bg-[#2D5A3D]"
      >
        🎫
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${missionTitle} QR`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#2D5A3D]">
                🎫 {index}. {missionTitle}
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

            <div className="mt-4 flex justify-center">
              {svg ? (
                <div
                  role="img"
                  aria-label={`${missionTitle} QR`}
                  dangerouslySetInnerHTML={{ __html: svg }}
                  className="h-56 w-56 rounded-xl border-2 border-[#2D5A3D] bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
                />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-xl border-2 border-dashed border-[#D4E4BC] text-xs text-[#8B7F75]">
                  ⏳ QR 생성 중…
                </div>
              )}
            </div>

            <p className="mt-3 break-all rounded-lg bg-[#F5F1E8] px-3 py-2 text-center font-mono text-[10px] text-[#2C2C2C]">
              {trimmed}
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
              💡 인쇄해서 현장에 부착하세요. SVG는 무한 확대 가능, PNG는 2048px
              고해상도.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
