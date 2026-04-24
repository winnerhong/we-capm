import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPartner } from "@/lib/auth-guard";
import EventTeamSection from "./event-team-section";

export const dynamic = "force-dynamic";

export default async function EventTeamPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id,name")
    .eq("id", eventId)
    .single();
  if (!event) notFound();

  const partner = await getPartner();
  const canEditTeam =
    !!partner && (partner.role === "OWNER" || partner.role === "MANAGER");

  return (
    <div className="space-y-4">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/manager/${eventId}`} className="hover:text-[#2D5A3D]">
          {event.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">팀 배정</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-3xl">
            👥
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              팀 배정
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              <strong className="text-[#2D5A3D]">{event.name}</strong> ·
              팀장·부팀장·지원 역할을 배정하고 현장 운영 팀을 구성하세요
            </p>
          </div>
        </div>
      </header>

      <EventTeamSection
        eventId={eventId}
        partnerId={partner?.id ?? null}
        canEdit={canEditTeam}
      />
    </div>
  );
}
