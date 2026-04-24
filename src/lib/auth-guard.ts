import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { TeamRole } from "@/lib/team/types";

export type PartnerSession = {
  id: string;
  teamMemberId: string | null;
  name: string;
  username: string;
  role: TeamRole;
  loginAt: string;
};

type RawPartnerCookie = {
  id?: string;
  teamMemberId?: string | null;
  name?: string;
  username?: string;
  role?: string;
  loginAt?: string;
};

function normalizePartnerSession(raw: RawPartnerCookie): PartnerSession {
  const role = (raw.role as TeamRole | undefined) ?? "OWNER"; // 하위 호환
  return {
    id: String(raw.id ?? ""),
    teamMemberId: raw.teamMemberId ?? null,
    name: String(raw.name ?? ""),
    username: String(raw.username ?? ""),
    role,
    loginAt: String(raw.loginAt ?? ""),
  };
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
