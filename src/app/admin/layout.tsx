import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AdminNav } from "@/components/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("campnic_admin");
  const managerCookie = cookieStore.get("campnic_manager");

  if (!adminCookie?.value && !managerCookie?.value) redirect("/login");

  const isAdmin = !!adminCookie?.value;
  let displayName = "관리자";
  let managerEventId = "";

  try {
    if (isAdmin) {
      displayName = JSON.parse(adminCookie!.value).id ?? "관리자";
    } else if (managerCookie?.value) {
      const data = JSON.parse(managerCookie.value);
      displayName = data.managerId ?? "기관";
      managerEventId = data.eventId ?? "";
    }
  } catch {}

  return (
    <div className="min-h-dvh bg-[#FFF8F0]">
      <AdminNav isAdmin={isAdmin} displayName={displayName} managerEventId={managerEventId} />
      <div className="mx-auto max-w-7xl p-4">{children}</div>
    </div>
  );
}
