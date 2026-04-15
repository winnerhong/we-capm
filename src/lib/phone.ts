export function toE164Korean(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("82")) return `+${digits}`;
  if (digits.startsWith("010") && digits.length === 11) return `+82${digits.slice(1)}`;
  if (digits.startsWith("10") && digits.length === 10) return `+82${digits}`;
  return null;
}

export function formatKorean(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}
