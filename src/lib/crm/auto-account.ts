import { hashPassword } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";

export function generateUsername(type: "ORG" | "CUSTOMER" | "COMPANY", seed: string): string {
  const random = Math.random().toString(36).slice(2, 6);
  const prefix = type === "ORG" ? "org" : type === "CUSTOMER" ? "user" : "co";
  const clean = seed.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 10);
  return `${prefix}_${clean}_${random}`;
}

export function generateTempPassword(): string {
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

// ============================================================
// 기관 계정 규칙 (초기셋팅):
//   아이디  = 기관 전화번호 (숫자만 추출, 필수)
//   비밀번호 = 담당자 핸드폰 뒷 4자리 (없으면 랜덤 4자리 숫자)
// ============================================================

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

function lastFourDigits(phone: string): string {
  const digits = digitsOnly(phone);
  if (digits.length >= 4) return digits.slice(-4);
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function resolveUniqueOrgUsername(base: string, excludeId?: string): Promise<string> {
  const supabase = await createClient();
  const baseTable = supabase.from("partner_orgs" as never) as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: { id: string } | null }>;
      };
    };
  };

  let candidate = base;
  for (let i = 2; i <= 20; i++) {
    const { data } = await baseTable.select("id").eq("auto_username", candidate).maybeSingle();
    if (!data || (excludeId && data.id === excludeId)) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * 기관 로그인 계정 생성 (초기셋팅):
 *   - username = 기관 전화번호 (숫자만)
 *   - password = 담당자 핸드폰 뒷 4자리
 */
export async function createOrgAccountFromProfile(
  orgPhone: string | null | undefined,
  representativePhone: string | null | undefined,
  excludeId?: string
) {
  const orgDigits = digitsOnly(orgPhone ?? "");
  if (!orgDigits) {
    throw new Error("기관 전화번호가 필요합니다 (아이디 생성용)");
  }

  const username = await resolveUniqueOrgUsername(orgDigits, excludeId);
  const plaintext = lastFourDigits(representativePhone ?? "");
  const hash = await hashPassword(plaintext);
  return { username, plaintext, hash };
}

/**
 * 기관 로그인 계정 생성 (지사가 아이디/비번을 직접 입력할 수 있는 버전):
 *   - usernameOverride 있으면 그 값을 기준으로 중복체크 → 충돌 시 -2, -3, ... suffix
 *   - 없으면 기관 전화번호 숫자로 자동
 *   - passwordOverride 있으면 그 평문을 해시
 *   - 없으면 담당자 핸드폰 뒷 4자리
 */
export async function createOrgAccountExplicit(opts: {
  usernameOverride?: string | null;
  passwordOverride?: string | null;
  orgPhone: string | null | undefined;
  representativePhone: string | null | undefined;
  excludeId?: string;
}) {
  const rawU = (opts.usernameOverride ?? "").trim();
  const rawP = (opts.passwordOverride ?? "").trim();

  let baseUsername: string;
  if (rawU) {
    baseUsername = rawU.replace(/\s+/g, "");
    if (baseUsername.length < 3) {
      throw new Error("아이디는 3자 이상이어야 합니다");
    }
  } else {
    const orgDigits = digitsOnly(opts.orgPhone ?? "");
    if (!orgDigits) {
      throw new Error(
        "아이디가 비어있고 기관 전화번호도 없어요. 둘 중 하나는 입력해 주세요"
      );
    }
    baseUsername = orgDigits;
  }
  const username = await resolveUniqueOrgUsername(baseUsername, opts.excludeId);

  const plaintext = rawP ? rawP : lastFourDigits(opts.representativePhone ?? "");
  if (plaintext.length < 4) {
    throw new Error("비밀번호는 4자 이상이어야 합니다");
  }
  const hash = await hashPassword(plaintext);
  return { username, plaintext, hash };
}
