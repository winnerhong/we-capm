import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import type { TrailRow } from "@/lib/trails/types";

export const dynamic = "force-dynamic";

type CompletionRow = {
  id: string;
  trail_id: string;
  event_id: string | null;
  participant_phone: string | null;
  participant_name: string | null;
  stops_cleared: string[];
  total_score: number;
  started_at: string;
  completed_at: string | null;
  certificate_url: string | null;
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

async function loadCompletions(trailId: string): Promise<CompletionRow[]> {
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
    .from("partner_trail_completions")
    .select("*")
    .eq("trail_id", trailId)
    .order("started_at", { ascending: false });
  return (data ?? []) as CompletionRow[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function maskPhone(raw: string | null): string {
  if (!raw) return "-";
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return raw;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default async function TrailCompletionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const partner = await requirePartner();
  const { id } = await params;

  const trail = await loadTrail(id);
  if (!trail || trail.partner_id !== partner.id) notFound();

  const all = await loadCompletions(id);
  const totalAttempts = all.length;
  const completed = all.filter((c) => c.completed_at !== null).length;
  const completionRate =
    totalAttempts > 0 ? (completed / totalAttempts) * 100 : 0;
  const totalStops = trail.total_slots ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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
        <span className="font-semibold text-[#2D5A3D]">완주 기록</span>
      </nav>

      <section className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-[#2D5A3D] md:text-xl">
            📜 완주 기록
          </h1>
          <p className="mt-1 text-xs text-[#6B6560]">
            {trail.name} · 총 {totalStops}개 지점
          </p>
        </div>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] px-3 py-1.5 text-xs font-bold text-[#6B6560]"
          title="Phase 2에 제공 예정"
        >
          ⬇ CSV 다운로드 (준비 중)
        </button>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard icon="🚶" label="총 시도" value={totalAttempts} />
        <StatCard icon="🏆" label="완주" value={completed} highlight />
        <StatCard
          icon="📈"
          label="완주율"
          value={`${completionRate.toFixed(1)}%`}
        />
      </div>

      {/* Table */}
      {all.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="text-5xl">📭</div>
          <p className="mt-3 text-base font-bold text-[#2D5A3D]">
            아직 완주 기록이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            숲길을 공개하고 참가자에게 공유해 보세요.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F5F1E8] text-[10px] font-bold uppercase tracking-wide text-[#6B6560]">
                <tr>
                  <th className="px-4 py-2 text-left">이름</th>
                  <th className="px-4 py-2 text-left">전화</th>
                  <th className="px-4 py-2 text-left">시작</th>
                  <th className="px-4 py-2 text-left">완료</th>
                  <th className="px-4 py-2 text-right">진행</th>
                  <th className="px-4 py-2 text-right">점수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F0E4]">
                {all.map((c) => {
                  const cleared = (c.stops_cleared ?? []).length;
                  const isDone = c.completed_at !== null;
                  return (
                    <tr key={c.id} className="hover:bg-[#FFF8F0]">
                      <td className="px-4 py-2 font-semibold text-[#2C2C2C]">
                        {c.participant_name ?? "익명"}
                      </td>
                      <td className="px-4 py-2 text-[#6B6560]">
                        {maskPhone(c.participant_phone)}
                      </td>
                      <td className="px-4 py-2 text-[11px] text-[#6B6560]">
                        {fmtDate(c.started_at)}
                      </td>
                      <td className="px-4 py-2 text-[11px]">
                        {isDone ? (
                          <span className="text-[#2D5A3D]">
                            {fmtDate(c.completed_at)}
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            진행중
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            isDone
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-[#D4E4BC] bg-[#F5F1E8] text-[#2D5A3D]"
                          }`}
                        >
                          {cleared} / {totalStops}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-[#2D5A3D]">
                        {c.total_score.toLocaleString("ko-KR")}점
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-[#2D5A3D] bg-gradient-to-br from-[#F5F1E8] to-[#D4E4BC]"
          : "border-[#D4E4BC] bg-white"
      }`}
    >
      <div className="text-xl">{icon}</div>
      <div className="mt-1 text-[10px] font-semibold text-[#6B6560]">
        {label}
      </div>
      <div
        className={`mt-0.5 text-xl font-extrabold ${
          highlight ? "text-[#2D5A3D]" : "text-[#2C2C2C]"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
      </div>
    </div>
  );
}
