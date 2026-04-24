import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  ORG_PROGRAM_STATUS_META,
  CATEGORY_META,
  type OrgProgramRow,
  type OrgProgramStatus,
} from "@/lib/org-programs/types";

const STATUS_TABS: Array<{ key: "ALL" | OrgProgramStatus; label: string }> = [
  { key: "ALL", label: "전체" },
  { key: "ACTIVATED", label: "✨ 활성화" },
  { key: "CUSTOMIZED", label: "✏️ 수정중" },
  { key: "PUBLISHED", label: "📢 공개중" },
  { key: "PAUSED", label: "⏸️ 일시정지" },
];

function formatWon(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return `${Number(n).toLocaleString("ko-KR")}원`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
}

export default async function MyProgramsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { orgId } = await params;
  const { status } = await searchParams;
  const org = await requireOrg();

  const supabase = await createClient();

  let q = (supabase.from("org_programs" as never) as any)
    .select("*")
    .eq("org_id", orgId)
    .order("activated_at", { ascending: false });

  const validStatus = status && Object.keys(ORG_PROGRAM_STATUS_META).includes(status)
    ? (status as OrgProgramStatus)
    : null;

  if (validStatus) q = q.eq("status", validStatus);

  const { data } = await q;
  const programs = ((data as OrgProgramRow[] | null) ?? []) as OrgProgramRow[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2D5A3D] sm:text-3xl">
            🗂️ 내 프로그램
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            활성화한 프로그램을 편집하고 공개할 수 있어요
          </p>
        </div>
        <Link
          href={`/org/${orgId}/templates`}
          className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm font-semibold text-[#2D5A3D] hover:bg-[#F5F1E8]"
        >
          📋 템플릿 둘러보기
        </Link>
      </header>

      {/* Status Tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const active =
            tab.key === "ALL" ? !validStatus : validStatus === tab.key;
          const href =
            tab.key === "ALL"
              ? `/org/${orgId}/programs`
              : `/org/${orgId}/programs?status=${tab.key}`;
          return (
            <Link
              key={tab.key}
              href={href}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                  : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Cards */}
      {programs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="mb-3 text-5xl" aria-hidden>
            🌱
          </div>
          <p className="text-sm font-semibold text-[#2D5A3D]">
            아직 활성화한 프로그램이 없어요.
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            템플릿 카탈로그에서 원하는 프로그램을 활성화하세요.
          </p>
          <Link
            href={`/org/${orgId}/templates`}
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#4A7C59] px-4 py-2.5 text-sm font-bold text-white"
          >
            📋 템플릿 보기
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {programs.map((p) => {
            const statusMeta =
              ORG_PROGRAM_STATUS_META[p.status as OrgProgramStatus] ??
              ORG_PROGRAM_STATUS_META.ACTIVATED;
            const catKey = (Object.keys(CATEGORY_META) as Array<
              keyof typeof CATEGORY_META
            >).includes(p.category as keyof typeof CATEGORY_META)
              ? (p.category as keyof typeof CATEGORY_META)
              : "FOREST";
            const catMeta = CATEGORY_META[catKey];

            return (
              <li
                key={p.id}
                className="flex flex-col gap-4 rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm sm:flex-row"
              >
                {/* Image */}
                <div className="h-32 w-full shrink-0 overflow-hidden rounded-xl bg-[#E8F0E4] sm:h-28 sm:w-32">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl">
                      🌲
                    </div>
                  )}
                </div>

                {/* Main */}
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.color}`}
                    >
                      {statusMeta.icon} {statusMeta.label}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                      {catMeta.icon} {catMeta.label}
                    </span>
                    {p.is_published && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        공개됨
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-[#2C2C2C]">
                    {p.title}
                  </h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B6560]">
                    <span>💰 {formatWon(p.price_per_person)}</span>
                    <span>
                      👥 {p.capacity_min ?? "-"} ~ {p.capacity_max ?? "-"}명
                    </span>
                    <span>📅 예약 {p.booking_count ?? 0}건</span>
                    <span>활성화일 {formatDate(p.activated_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-wrap items-start gap-2 sm:flex-col">
                  <Link
                    href={`/org/${orgId}/programs/${p.id}/edit`}
                    className="rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#4A7C59] px-3 py-2 text-xs font-bold text-white hover:opacity-90"
                  >
                    ✏️ 편집
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
