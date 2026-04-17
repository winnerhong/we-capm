import { cookies } from "next/headers";

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
