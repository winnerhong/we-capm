import { hashPassword } from "@/lib/password";

/**
 * 전화번호에서 숫자만 추출
 */
export function normalizeUserPhone(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

/**
 * 벌크 임포트용 — 보호자 계정(username/plaintext/hash) 생성.
 *   username  = 전화번호(숫자만)
 *   plaintext = 전화번호 뒷 4자리
 *   hash      = bcrypt(plaintext)
 *
 * 비밀번호 평문은 기관 관리자에게 공지용으로 1회만 노출하고, DB에는 hash만 저장한다.
 */
export async function createAppUserAccountFromPhone(
  phone: string,
  orgId: string,
  parentName: string
): Promise<{ username: string; plaintext: string; hash: string }> {
  const username = normalizeUserPhone(phone);
  if (username.length < 4) {
    throw new Error("전화번호는 숫자 4자리 이상이어야 합니다");
  }
  if (!orgId) {
    throw new Error("소속 기관(orgId)이 필요합니다");
  }
  const name = (parentName ?? "").trim();
  if (!name) {
    throw new Error("보호자 이름이 필요합니다");
  }

  const plaintext = username.slice(-4);
  const hash = await hashPassword(plaintext);
  return { username, plaintext, hash };
}
