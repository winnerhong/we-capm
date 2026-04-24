import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { loadTrailsAssignedToOrg } from "@/lib/trails/queries";
import {
  MISSION_TYPE_META,
  type TrailRow,
  type TrailStopRow,
} from "@/lib/trails/types";
import { generateQrDataUrl } from "@/lib/trails/qr-code";
import { PrintButton } from "@/app/partner/trails/[id]/qr/print-button";

export const dynamic = "force-dynamic";

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

async function loadStops(trailId: string): Promise<TrailStopRow[]> {
  const supabase = await createClient();
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: unknown[] | null }>;
        };
      };
    };
  };
  const { data } = await client
    .from("partner_trail_stops")
    .select("*")
    .eq("trail_id", trailId)
    .order("order", { ascending: true });
  return (data ?? []) as TrailStopRow[];
}

type Layout = "a4" | "card";

export default async function OrgTrailQrPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; id: string }>;
  searchParams: Promise<{ layout?: string }>;
}) {
  const { orgId, id } = await params;
  const org = await requireOrg();
  const { layout: rawLayout } = await searchParams;

  const trail = await loadTrail(id);
  if (!trail) notFound();

  // 권한: 이 숲길이 우리 기관에 노출되는지(visibility='ALL' 또는 assigned)
  const assignedTrails = await loadTrailsAssignedToOrg(orgId);
  if (!assignedTrails.some((t) => t.id === id)) notFound();

  const layout: Layout = rawLayout === "card" ? "card" : "a4";
  const stops = await loadStops(id);

  const qrDataUrls = await Promise.all(
    stops.map((s) => generateQrDataUrl(s.qr_code))
  );
  const stopsWithQr = stops.map((s, i) => ({ ...s, qrDataUrl: qrDataUrls[i] }));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <nav className="text-xs text-[#6B6560] print:hidden">
        <Link href={`/org/${orgId}`} className="hover:underline">
          기관홈
        </Link>
        <span className="mx-1">›</span>
        <Link href={`/org/${orgId}/trails`} className="hover:underline">
          우리 기관 숲길
        </Link>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">{trail.name}</span>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">QR 인쇄</span>
      </nav>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm print:hidden">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-[#2D5A3D]">
            🎫 QR 인쇄
          </h1>
          <p className="mt-1 text-xs text-[#6B6560]">
            {trail.name} · 지점 {stopsWithQr.length}개
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-xl border border-[#D4E4BC]">
            <Link
              href={`/org/${orgId}/trails/${id}/qr?layout=a4`}
              className={`px-3 py-1.5 text-xs font-bold transition ${
                layout === "a4"
                  ? "bg-[#2D5A3D] text-white"
                  : "bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
              }`}
            >
              📄 A4 (장당 1개)
            </Link>
            <Link
              href={`/org/${orgId}/trails/${id}/qr?layout=card`}
              className={`px-3 py-1.5 text-xs font-bold transition ${
                layout === "card"
                  ? "bg-[#2D5A3D] text-white"
                  : "bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
              }`}
            >
              🃏 카드 (12개)
            </Link>
          </div>
          <PrintButton />
        </div>
      </section>

      {stopsWithQr.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center print:hidden">
          <div className="text-5xl">🎫</div>
          <p className="mt-3 text-base font-bold text-[#2D5A3D]">
            인쇄할 QR이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            아직 이 숲길에 지점이 없어요. 지사에 문의해 주세요.
          </p>
          <Link
            href={`/org/${orgId}/trails`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#4A7C59]"
          >
            ← 숲길 목록으로
          </Link>
        </div>
      ) : layout === "a4" ? (
        <A4Layout trail={trail} stops={stopsWithQr} />
      ) : (
        <CardLayout trail={trail} stops={stopsWithQr} />
      )}

      <style>{`
        @media print {
          body { background: white !important; }
          @page { size: A4; margin: 10mm; }
          .page-break { page-break-after: always; break-after: page; }
          .page-break:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>
    </div>
  );
}

type StopWithQr = TrailStopRow & { qrDataUrl: string };

function A4Layout({
  trail,
  stops,
}: {
  trail: TrailRow;
  stops: StopWithQr[];
}) {
  return (
    <div className="space-y-4 print:space-y-0">
      {stops.map((s) => {
        const m = MISSION_TYPE_META[s.mission_type];
        return (
          <div
            key={s.id}
            className="page-break flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-[#D4E4BC] bg-white p-10 text-center shadow-sm print:min-h-[90vh] print:rounded-none print:border-0 print:shadow-none"
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-[#6B6560]">
              🏡 토리로 · {trail.name}
            </div>
            <div className="mt-2 text-3xl font-extrabold text-[#2D5A3D]">
              #{s.order}. {s.name}
            </div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-3 py-1 text-xs font-semibold text-[#2D5A3D]">
              {m.icon} {m.label} · {s.reward_points}점
            </div>
            {s.description && (
              <p className="mt-4 max-w-md text-sm text-[#6B6560]">
                {s.description}
              </p>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.qrDataUrl}
              alt={`${s.name} QR`}
              className="mt-6 h-64 w-64 rounded-2xl border-4 border-[#2D5A3D] bg-white p-2 shadow-sm"
            />
            <div className="mt-4 text-[10px] text-[#6B6560]">
              📱 카메라로 QR을 스캔해 미션을 완료하세요
            </div>
            {s.location_hint && (
              <div className="mt-2 rounded-full border border-[#C4956A] bg-[#FFF8F0] px-3 py-1 text-[11px] font-semibold text-[#C4956A]">
                📌 위치: {s.location_hint}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CardLayout({
  trail,
  stops,
}: {
  trail: TrailRow;
  stops: StopWithQr[];
}) {
  const pages: StopWithQr[][] = [];
  for (let i = 0; i < stops.length; i += 12) {
    pages.push(stops.slice(i, i + 12));
  }

  return (
    <div className="space-y-4 print:space-y-0">
      {pages.map((page, pi) => (
        <div
          key={pi}
          className="page-break rounded-2xl border border-[#D4E4BC] bg-white p-6 shadow-sm print:rounded-none print:border-0 print:shadow-none"
        >
          <div className="mb-4 flex items-center justify-between text-xs text-[#6B6560] print:mb-3">
            <span className="font-bold text-[#2D5A3D]">
              🏡 토리로 · {trail.name}
            </span>
            <span>
              {pi + 1} / {pages.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {page.map((s) => {
              const m = MISSION_TYPE_META[s.mission_type];
              return (
                <div
                  key={s.id}
                  className="flex flex-col items-center rounded-xl border border-[#D4E4BC] bg-white p-3 text-center"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.qrDataUrl}
                    alt={`${s.name} QR`}
                    className="h-28 w-28 rounded-lg border-2 border-[#2D5A3D] bg-white p-1"
                  />
                  <div className="mt-2 line-clamp-1 text-xs font-bold text-[#2C2C2C]">
                    #{s.order}. {s.name}
                  </div>
                  <div className="mt-1 text-[9px] text-[#6B6560]">
                    {m.icon} {m.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
