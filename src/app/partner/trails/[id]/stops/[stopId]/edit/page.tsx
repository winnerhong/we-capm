import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  MISSION_TYPE_META,
  type TrailRow,
  type TrailStopRow,
  type MissionType,
} from "@/lib/trails/types";
import { updateStopAction } from "../../../../actions";
import { StopEditForm } from "./stop-edit-form";

export const dynamic = "force-dynamic";

const MISSION_STYLE: Record<MissionType, string> = {
  PHOTO: "bg-sky-50 text-sky-800 border-sky-200",
  QUIZ: "bg-violet-50 text-violet-800 border-violet-200",
  LOCATION: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CHECKIN: "bg-[#F5F1E8] text-[#2D5A3D] border-[#D4E4BC]",
};

async function loadTrail(id: string): Promise<TrailRow | null> {
  const supabase = await createClient();
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: unknown | null }>;
        };
      };
    };
  };
  const { data } = await client
    .from("partner_trails")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as TrailRow | null) ?? null;
}

async function loadStop(stopId: string): Promise<TrailStopRow | null> {
  const supabase = await createClient();
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: unknown | null }>;
        };
      };
    };
  };
  const { data } = await client
    .from("partner_trail_stops")
    .select("*")
    .eq("id", stopId)
    .maybeSingle();
  return (data as TrailStopRow | null) ?? null;
}

export default async function EditStopPage({
  params,
}: {
  params: Promise<{ id: string; stopId: string }>;
}) {
  const partner = await requirePartner();
  const { id, stopId } = await params;

  const trail = await loadTrail(id);
  if (!trail || trail.partner_id !== partner.id) notFound();

  const stop = await loadStop(stopId);
  if (!stop || stop.trail_id !== id) notFound();

  const m = MISSION_TYPE_META[stop.mission_type];
  const updateBound = updateStopAction.bind(null, stopId, id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="text-xs text-[#6B6560]">
        <Link href="/partner/dashboard" className="hover:underline">
          대시보드
        </Link>
        <span className="mx-1">›</span>
        <Link href="/partner/trails" className="hover:underline">
          나만의 숲길
        </Link>
        <span className="mx-1">›</span>
        <Link href={`/partner/trails/${id}`} className="hover:underline">
          {trail.name}
        </Link>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">지점 편집</span>
      </nav>

      <section className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${MISSION_STYLE[stop.mission_type]}`}
              >
                {m.icon} {m.label}
              </span>
              <span className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                #{stop.order}
              </span>
            </div>
            <h1 className="mt-2 text-xl font-bold text-[#2C2C2C] md:text-2xl">
              📍 {stop.name}
            </h1>
            <p className="mt-1 text-[11px] text-[#6B6560]">
              QR 코드:{" "}
              <code className="rounded bg-[#F5F1E8] px-1.5 py-0.5 font-mono text-[10px] text-[#2D5A3D]">
                {stop.qr_code}
              </code>
            </p>
          </div>
        </div>
      </section>

      <StopEditForm
        action={updateBound}
        stop={stop}
        trailId={id}
      />
    </div>
  );
}
