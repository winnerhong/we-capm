"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#4A7C59] print:hidden"
    >
      🖨️ 인쇄하기
    </button>
  );
}
