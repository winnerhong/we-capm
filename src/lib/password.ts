import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  // Handle legacy plaintext passwords (backward compat during migration)
  if (!hash.startsWith("$2")) {
    return plaintext === hash;
  }
  return bcrypt.compare(plaintext, hash);
}

export function isHashedPassword(value: string): boolean {
  return value.startsWith("$2");
}
