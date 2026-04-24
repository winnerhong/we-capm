import type { ReactNode } from "react";
import Link from "next/link";
import { PrintButton, BackButton } from "./print-button";

interface PrintShellProps {
  children: ReactNode;
  title: string;
  uploadHref?: string;
}

/**
 * 인쇄용 A4 공통 래퍼.
 * - 화면에선 툴바 + 본문 (max-w-[210mm])
 * - 인쇄 시 툴바 숨기고 A4 여백 최적화
 */
export function PrintShell({ children, title, uploadHref }: PrintShellProps) {
  return (
    <>
      {/* 인쇄 전용 스타일 */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 18mm 16mm;
        }
        @media print {
          html, body { background: #ffffff !important; }
          .no-print { display: none !important; }
          .print-page { box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
        }
        .doc-body { font-family: "Nanum Myeongjo", "Batang", "Times New Roman", serif; }
      `}</style>

      {/* 화면 툴바 (인쇄 시 숨김) */}
      <div className="no-print sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-zinc-500">
              토리로 · 서류 템플릿
            </p>
            <h1 className="truncate text-base font-bold text-zinc-900">
              {title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <BackButton />
            {uploadHref && (
              <Link
                href={uploadHref}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#2D5A3D] bg-white px-4 py-2 text-sm font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
              >
                📤 업로드 화면
              </Link>
            )}
            <PrintButton />
          </div>
        </div>
      </div>

      {/* 화면 안내 */}
      <div className="no-print mx-auto max-w-[210mm] px-4 pt-4">
        <p className="rounded-xl border border-[#D4E4BC] bg-[#E8F0E4] px-3 py-2 text-xs text-[#2D5A3D]">
          💡 <b>인쇄</b> 버튼으로 브라우저 인쇄 다이얼로그를 열어 <b>PDF로 저장</b>하거나 바로 인쇄하세요.
          빈칸(<span className="font-mono">_______________</span>)은 수기로 채워 주세요.
        </p>
      </div>

      {/* A4 본문 */}
      <main className="doc-body print-page mx-auto my-6 max-w-[210mm] bg-white px-12 py-14 text-[11pt] leading-[1.75] text-zinc-900 shadow-[0_2px_16px_rgba(0,0,0,0.08)] print:my-0 print:px-0 print:py-0 print:shadow-none">
        {children}
      </main>
    </>
  );
}
