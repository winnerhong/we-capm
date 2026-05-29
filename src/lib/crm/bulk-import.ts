export interface ValidationResult<T> {
  valid: T[];
  duplicates: T[];
  errors: { row: number; data: unknown; message: string }[];
}

/** \ud55c \uc904\uc744 CSV \uc140\ub85c \ubd84\ud574 \u2014 \ub530\uc634\ud45c\u00b7\uc774\uc2a4\ucf00\uc774\ud504\u00b7\ube48 \uc140 \ubaa8\ub450 \ucc98\ub9ac. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        // "" \u2192 \ub9ac\ud130\ub7f4 \ub530\uc634\ud45c \ud55c \uac1c
        if (line[i + 1] === '"') {
          buf += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        buf += c;
      }
    } else {
      if (c === ",") {
        out.push(buf.trim());
        buf = "";
      } else if (c === '"' && buf.length === 0) {
        inQuotes = true;
      } else {
        buf += c;
      }
    }
  }
  out.push(buf.trim());
  return out;
}

export function parseCSV(text: string): Record<string, string>[] {
  // Handle BOM
  const cleaned = text.replace(/^\ufeff/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return raw;
}

export function normalizeBusinessNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  return raw;
}

export function validatePhone(phone: string): boolean {
  return /^01\d{1}-?\d{3,4}-?\d{4}$/.test(phone.replace(/\s/g, ""));
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateBusinessNumber(biz: string): boolean {
  return /^\d{3}-?\d{2}-?\d{5}$/.test(biz.replace(/\s/g, ""));
}
