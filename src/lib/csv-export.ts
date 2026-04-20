/**
 * CSV export helpers.
 *
 * Notes:
 * - Prepends a UTF-8 BOM so Excel opens Korean text correctly.
 * - Uses RFC 5987 `filename*=UTF-8''...` so Korean filenames survive the
 *   HTTP Content-Disposition header. A plain ASCII fallback is also supplied.
 */

export type CSVColumn<T> = { key: keyof T; label: string };

export function toCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: CSVColumn<T>[]
): string {
  const escape = (raw: unknown): string => {
    if (raw === null || raw === undefined) return "";
    const str = String(raw).replace(/"/g, '""');
    return `"${str}"`;
  };

  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escape(row[c.key])).join(","))
    .join("\n");

  // BOM so Excel detects UTF-8. \r\n for Excel row parsing friendliness.
  const BOM = "\ufeff";
  return BOM + header + "\r\n" + body;
}

export function csvResponse(csv: string, filename: string): Response {
  // ASCII-safe fallback: strip non-ASCII chars, collapse spaces.
  const asciiFallback =
    filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'") || "export.csv";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

export function formatDateKR(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Split "[반이름] 홍길동" into { className, name }. Safe for any input. */
export function splitClassName(raw: string): { className: string; name: string } {
  const match = raw.match(/^\[(.+?)\]\s*(.*)$/);
  if (match) return { className: match[1], name: match[2] || raw };
  return { className: "", name: raw };
}
