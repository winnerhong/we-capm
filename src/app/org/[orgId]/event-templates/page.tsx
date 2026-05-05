import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { listAvailableTemplatesForOrg } from "@/lib/event-templates/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgId: string }>;
};

type PartnerInfo = {
  id: string;
  name: string;
  business_name: string | null;
};

async function loadPartners(partnerIds: string[]): Promise<Map<string, PartnerInfo>> {
  const map = new Map<string, PartnerInfo>();
  if (partnerIds.length === 0) return map;
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partners" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{
          data: PartnerInfo[] | null;
          error: unknown;
        }>;
      };
    }
  )
    .select("id,name,business_name")
    .in("id", partnerIds);
  for (const p of data ?? []) map.set(p.id, p);
  return map;
}

async function countItems(templateIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const id of templateIds) map.set(id, 0);
  if (templateIds.length === 0) return map;
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partner_event_template_items" as never) as unknown as {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{
          data: { template_id: string }[] | null;
          error: unknown;
        }>;
      };
    }
  )
    .select("template_id")
    .in("template_id", templateIds);
  for (const r of data ?? [])
    map.set(r.template_id, (map.get(r.template_id) ?? 0) + 1);
  return map;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function OrgEventTemplatesCatalog({
  params,
}: PageProps) {
  const { orgId } = await params;
  await requireOrg();

  const templates = await listAvailableTemplatesForOrg(orgId);
  const [partners, itemCounts] = await Promise.all([
    loadPartners(Array.from(new Set(templates.map((t) => t.partner_id)))),
    countItems(templates.map((t) => t.id)),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">행사 템플릿</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden>
            📦
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              행사 템플릿 카탈로그
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              지사가 만든 행사 패키지를 골라 우리 행사로 가져올 수 있어요. 시작
              일자만 정하면 프로그램·구성품이 자동으로 복사됩니다.
            </p>
          </div>
        </div>
      </header>

      {templates.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#D4E4BC] bg-white px-4 py-16 text-center">
          <div className="text-4xl">🌱</div>
          <p className="mt-3 text-base font-semibold text-[#2D5A3D]">
            아직 공개된 템플릿이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            지사가 새 템플릿을 공개하면 여기서 확인할 수 있어요.
          </p>
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const partner = partners.get(t.partner_id);
            const itemCount = itemCounts.get(t.id) ?? 0;
            const partnerLabel =
              partner?.business_name?.trim() ?? partner?.name ?? "지사";
            return (
              <Link
                key={t.id}
                href={`/org/${orgId}/event-templates/${t.id}`}
                className="group overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="aspect-[16/9] w-full bg-[#FFF8F0]">
                  {t.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.cover_image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl opacity-40">
                      📦
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <h3 className="line-clamp-2 text-sm font-bold text-[#2D5A3D] group-hover:text-[#3A7A52]">
                    {t.name}
                  </h3>
                  {t.subtitle && (
                    <p className="line-clamp-2 text-xs text-[#6B6560]">
                      {t.subtitle}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[#8B7F75]">
                    <span className="rounded-full border border-[#E5DDD0] px-2 py-0.5 font-semibold text-[#2D5A3D]">
                      🏡 {partnerLabel}
                    </span>
                    <span>구성 {itemCount}개</span>
                    {t.recommended_duration_hours && (
                      <span>약 {t.recommended_duration_hours}h</span>
                    )}
                    <span>{fmtDate(t.updated_at)}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
