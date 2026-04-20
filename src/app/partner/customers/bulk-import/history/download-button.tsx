"use client";

import { useCallback } from "react";

type ErrorRow = {
  row: number;
  reason: string;
  data?: Record<string, string>;
};

export function DownloadErrorsButton({
  rowId,
  fileName,
  errors,
}: {
  rowId: string;
  fileName: string;
  errors: unknown;
}) {
  const onDownload = useCallback(() => {
    const list: ErrorRow[] = Array.isArray(errors)
      ? (errors as ErrorRow[])
      : [];
    if (list.length === 0) return;

    const BOM = "\ufeff";
    const headers = ["행", "오류사유", "원본데이터"];
    const lines = [headers.join(",")];
    for (const err of list) {
      const data = err.data ? JSON.stringify(err.data).replace(/"/g, '""') : "";
      lines.push(
        `${err.row},"${(err.reason ?? "").replace(/"/g, '""')}","${data}"`
      );
    }
    const blob = new Blob([BOM + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = fileName.replace(/[^a-zA-Z0-9가-힣._-]/g, "_");
    a.href = url;
    a.download = `오류_${safeName}_${rowId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [errors, fileName, rowId]);

  return (
    <button
      type="button"
      onClick={onDownload}
      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
    >
      📥 오류 CSV
    </button>
  );
}
