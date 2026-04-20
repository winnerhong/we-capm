import { hashPassword } from "@/lib/password";

export function generateUsername(type: "ORG" | "CUSTOMER" | "COMPANY", seed: string): string {
  const random = Math.random().toString(36).slice(2, 6);
  const prefix = type === "ORG" ? "org" : type === "CUSTOMER" ? "user" : "co";
  // Sanitize seed (remove non-alphanumeric)
  const clean = seed.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 10);
  return `${prefix}_${clean}_${random}`;
}

export function generateTempPassword(): string {
  // 8-digit random with letters + numbers (no confusing chars)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pw = "";
  for (let i = 0; i < 8; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pw;
}

export async function createAutoAccount(type: "ORG" | "CUSTOMER" | "COMPANY", seed: string) {
  const username = generateUsername(type, seed);
  const plaintext = generateTempPassword();
  const hash = await hashPassword(plaintext);
  return { username, plaintext, hash };
}
