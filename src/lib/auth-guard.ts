import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { TeamRole } from "@/lib/team/types";

export type PartnerSession = {
  id: string;
  teamMemberId: string | null;
  /** display name (예: "위너 숲지기") — 레거시 호환용. 표시는 businessName 우선. */
  name: string;
  /** 사업자명 (예: "(주)위너사업자"). 모든 표시명의 1순위. 없으면 name 으로 fallback. */
  businessName: string | null;
  username: string;
  role: TeamRole;
  loginAt: string;
};

type RawPartnerCookie = {
  id?: string;
  teamMemberId?: string | null;
  name?: string;
  business_name?: string | null;
  businessName?: string | null;
  username?: string;
  role?: string;
  loginAt?: string;
};

function normalizePartnerSession(raw: RawPartnerCookie): PartnerSession {
  const role = (raw.role as TeamRole | undefined) ?? "OWNER"; // 하위 호환
  // business_name 또는 businessName 둘 다 허용 (구 쿠키 호환)
  const bizRaw =
    typeof raw.businessName === "string"
      ? raw.businessName
      : typeof raw.business_name === "string"
        ? raw.business_name
        : null;
  const businessName =
    bizRaw && bizRaw.trim().length > 0 ? bizRaw.trim() : null;
  return {
    id: String(raw.id ?? ""),
    teamMemberId: raw.teamMemberId ?? null,
    name: String(raw.name ?? ""),
    businessName,
    username: String(raw.username ?? ""),
    role,
    loginAt: String(raw.loginAt ?? ""),
  };
}

/**
 * 파트너 표시명 — 모든 UI 노출 표면에서 사용해야 하는 단일 진입점.
 * 우선순위: businessName(사업자명) > name(레거시 display name) > "지사"
 */
export function partnerDisplayName(session: PartnerSession | null): string {
  if (!session) return "지사";
  return (
    session.businessName?.trim() ||
    session.name?.trim() ||
    "지사"
  );
}

export async function requirePartner(): Promise<PartnerSession> {
  const cookieStore = await cookies();
  const partnerCookie = cookieStore.get("campnic_partner")?.value;
  if (!partnerCookie) redirect("/partner");
  try {
    return normalizePartnerSession(JSON.parse(partnerCookie) as RawPartnerCookie);
  } catch {
    redirect("/partner");
  }
}

export async function getPartner(): Promise<PartnerSession | null> {
  const cookieStore = await cookies();
  const partnerCookie = cookieStore.get("campnic_partner")?.value;
  if (!partnerCookie) return null;
  try {
    return normalizePartnerSession(JSON.parse(partnerCookie) as RawPartnerCookie);
  } catch {
    return null;
  }
}

export async function requirePartnerWithRole(
  allowedRoles: TeamRole[]
): Promise<PartnerSession> {
  const p = await requirePartner();
  if (!allowedRoles.includes(p.role)) {
    throw new Error(`권한 없음: ${p.role}`);
  }
  return p;
}

export async function requireAdmin() {
  const cookieStore = await cookies();
  const admin = cookieStore.get("campnic_admin")?.value;
  if (!admin) throw new Error("관리자 권한이 필요합니다");
  return JSON.parse(admin);
}

export async function requireAdminOrManager(eventId?: string) {
  const cookieStore = await cookies();
  const admin = cookieStore.get("campnic_admin")?.value;
  if (admin) return { role: "admin" as const, ...JSON.parse(admin) };

  const manager = cookieStore.get("campnic_manager")?.value;
  if (!manager) throw new Error("로그인이 필요합니다");

  const data = JSON.parse(manager);
  if (eventId && data.eventId !== eventId) {
    throw new Error("이 행사에 대한 권한이 없습니다");
  }
  return { role: "manager" as const, ...data };
}

export async function getRole(): Promise<"admin" | "manager" | null> {
  const cookieStore = await cookies();
  if (cookieStore.get("campnic_admin")?.value) return "admin";
  if (cookieStore.get("campnic_manager")?.value) return "manager";
  return null;
}
