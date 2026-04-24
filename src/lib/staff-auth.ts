// server-only: 쿠키 접근이 필요하므로 클라이언트에서 import 금지
import { redirect } from "next/navigation";
import { getPartner } from "@/lib/auth-guard";
import { getOrg } from "@/lib/org-auth-guard";

/**
 * 행사장 스태프(교환소 직원)가 될 수 있는 세션 추상화.
 * 파트너(지사) 세션 또는 기관(org) 세션 중 어느 쪽이든 허용.
 */
export interface StaffSession {
  type: "PARTNER" | "ORG";
  id: string;
  name: string;
}

export async function getStaff(): Promise<StaffSession | null> {
  const partner = await getPartner();
  if (partner) {
    return {
      type: "PARTNER",
      id: partner.id,
      name: partner.name || partner.username || "파트너 스태프",
    };
  }
  const org = await getOrg();
  if (org) {
    return {
      type: "ORG",
      id: org.orgId,
      name: org.orgName || "기관 스태프",
    };
  }
  return null;
}

/**
 * 스태프 세션 필수 — 없으면 /partner 로그인으로 리다이렉트.
 * redirect()는 try/catch 바깥에서 호출해야 NEXT_REDIRECT 예외가 삼켜지지 않음.
 */
export async function requireStaff(): Promise<StaffSession> {
  const s = await getStaff();
  if (!s) redirect("/partner");
  return s;
}
