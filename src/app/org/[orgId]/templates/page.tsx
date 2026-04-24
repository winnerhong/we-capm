import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_META } from "@/lib/org-programs/types";
import { ActivateButton } from "./activate-button";
import { loadPartnerDisplayNameForOrg } from "@/lib/org-partner";

type TemplateRow = {
  id: string;
  partner_id: string | null;
  title: string;
  description: string | null;
  category: string;
  duration_hours: number | null;
  capacity_min: number | null;
  capacity_max: number | null;
  price_per_person: number | null;
  location_detail: string | null;
  image_url: string | null;
  tags: string[] | null;
  visibility: "DRAFT" | "ALL" | "SELECTED" | "ARCHIVED" | null;
  created_at: string;
};

const CATEGORY_ORDER = ["FOREST", "CAMPING", "KIDS", "FAMILY", "TEAM", "ART"] as const;

type Category = (typeof CATEGORY_ORDER)[number];

function formatWon(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return `${Number(n).toLocaleString("ko-KR")}원`;
}

export default async function TemplatesCatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { orgId } = await params;
  const { category } = await searchParams;
  const org = await requireOrg();

  const supabase = await createClient();

  const columns =
    "id, partner_id, title, description, category, duration_hours, capacity_min, capacity_max, price_per_person, location_detail, image_url, tags, visibility, created_at";

  // 1) ALL 공개 프로그램
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allQuery = (supabase.from("partner_programs" as never) as any)
    .select(columns)
    .eq("visibility", "ALL")
    .order("created_at", { ascending: false });

  if (category && (CATEGORY_ORDER as readonly string[]).includes(category)) {
    allQuery = allQuery.eq("category", category);
  }

  // 2) 이 기관에 할당된 program_ids
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignmentsRes = await (supabase.from("partner_program_assignments" as never) as any)
    .select("program_id")
    .eq("org_id", orgId);

  const assignedIds = Array.from(
    new Set(
      ((assignmentsRes?.data as Array<{ program_id: string }> | null) ?? [])
        .map((r) => r.program_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    )
  );

  // 3) SELECTED 중 이 기관에 할당된 프로그램
  const selectedPromise: Promise<{ data: TemplateRow[] | null }> =
    assignedIds.length > 0
      ? (async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let q = (supabase.from("partner_programs" as never) as any)
            .select(columns)
            .eq("visibility", "SELECTED")
            .in("id", assignedIds)
            .order("created_at", { ascending: false });
          if (category && (CATEGORY_ORDER as readonly string[]).includes(category)) {
            q = q.eq("category", category);
          }
          return (await q) as { data: TemplateRow[] | null };
        })()
      : Promise.resolve({ data: [] as TemplateRow[] });

  const [allRes, selectedRes] = await Promise.all([allQuery, selectedPromise]);

  // 4) 머지 + dedupe (id 기준)
  const byId = new Map<string, TemplateRow>();
  for (const row of ((allRes?.data as TemplateRow[] | null) ?? [])) {
    byId.set(row.id, row);
  }
  for (const row of ((selectedRes?.data as TemplateRow[] | null) ?? [])) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }

  const templates = Array.from(byId.values()).sort((a, b) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
  );

  const partnerName = await loadPartnerDisplayNameForOrg(orgId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#2D5A3D] sm:text-3xl">
          📋 프로그램 템플릿 카탈로그
        </h1>
        <p className="mt-2 text-sm text-[#6B6560]">
          {partnerName}에서 개발한 프로그램을 내 기관에 맞게 활성화해보세요
        </p>
      </header>

      {/* Category Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={`/org/${orgId}/templates`}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            !category
              ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
              : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
          }`}
        >
          전체
        </Link>
        {CATEGORY_ORDER.map((c) => {
          const meta = CATEGORY_META[c as Category];
          const active = category === c;
          return (
            <Link
              key={c}
              href={`/org/${orgId}/templates?category=${c}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                  : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
              }`}
            >
              {meta.icon} {meta.label}
            </Link>
          );
        })}
      </div>

      {/* Grid */}
      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="mb-3 text-5xl" aria-hidden>
            🌲
          </div>
          <p className="text-sm font-semibold text-[#2D5A3D]">
            아직 공개된 템플릿이 없어요.
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            지사가 프로그램을 공개하면 여기 자동으로 나타나요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {templates.map((t) => {
            const catKey = (CATEGORY_ORDER as readonly string[]).includes(t.category)
              ? (t.category as Category)
              : "FOREST";
            const catMeta = CATEGORY_META[catKey];
            return (
              <article
                key={t.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#E8F0E4]">
                  {t.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.image_url}
                      alt={t.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl">
                      🌲
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                      {catMeta.icon} {catMeta.label}
                    </span>
                  </div>
                  <h3 className="line-clamp-2 text-sm font-bold text-[#2C2C2C]">
                    {t.title}
                  </h3>
                  {t.description && (
                    <p className="line-clamp-2 text-xs text-[#6B6560]">
                      {t.description}
                    </p>
                  )}
                  <div className="mt-1 space-y-0.5 text-[11px] text-[#6B6560]">
                    <div>💰 {formatWon(t.price_per_person)}</div>
                    <div>
                      👥 {t.capacity_min ?? "-"} ~ {t.capacity_max ?? "-"}명
                    </div>
                    <div>⏱️ {t.duration_hours ?? "-"}시간</div>
                  </div>

                  <div className="mt-auto pt-3">
                    <ActivateButton sourceProgramId={t.id} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
