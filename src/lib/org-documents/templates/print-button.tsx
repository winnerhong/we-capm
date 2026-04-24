"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] focus:ring-offset-2"
    >
      🖨️ 인쇄 / PDF 저장
    </button>
  );
}

export function BackButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) window.history.back();
        else window.close();
      }}
      className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2"
    >
      ← 돌아가기
    </button>
  );
}
