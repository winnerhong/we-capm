import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import {
  loadPartnerMissions,
  loadPresetGrantedOrgIds,
  loadStampbookPresetById,
} from "@/lib/missions/queries";
import { createClient } from "@/lib/supabase/server";
import { PresetForm } from "../../preset-form";
import {
  updateStampbookPresetAction,
  publishStampbookPresetAction,
  unpublishStampbookPresetAction,
  deleteStampbookPresetAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditStampbookPresetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await requirePartner();

  const preset = await loadStampbookPresetById(id);
  if (!preset) notFound();
  if (preset.partner_id !== partner.id) redirect("/partner/stampbook-presets");

  const [missions, grantedOrgIds, orgs] = await Promise.all([
    loadPartnerMissions(partner.id),
    loadPresetGrantedOrgIds(id),
    (async () => {
      const supabase = await createClient();
      const resp = (await (
        supabase.from("partner_orgs" as never) as unknown as {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => Promise<{
                data: Array<{ id: string; org_name: string }> | null;
              }>;
            };
          };
        }
      )
        .select("id,org_name")
        .eq("partner_id", partner.id)
        .order("org_name", { ascending: true })) as {
        data: Array<{ id: string; org_name: string }> | null;
      };
      return resp.data ?? [];
    })(),
  ]);
  const simpleMissions = missions.map((m) => ({
    id: m.id,
    title: m.title,
    kind: m.kind,
    icon: m.icon,
    status: m.status,
  }));

  // mission_ids 에 담긴 항목이 unpublished 여도 목록에 보이도록 추가
  const missingIds = (preset.mission_ids ?? []).filter(
    (mid) => !simpleMissions.some((m) => m.id === mid)
  );
  if (missingIds.length > 0) {
    for (const mid of missingIds) {
      const row = missions.find((m) => m.id === mid);
      if (row) {
        simpleMissions.push({
          id: row.id,
          title: row.title,
          kind: row.kind,
          icon: row.icon,
          status: row.status,
        });
      }
    }
  }

  const boundUpdate = updateStampbookPresetAction.bind(null, id);
  const boundPublish = publishStampbookPresetAction.bind(null, id);
  const boundUnpublish = unpublishStampbookPresetAction.bind(null, id);
  const boundDelete = deleteStampbookPresetAction.bind(null, id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/missions" className="hover:text-[#2D5A3D]">
          미션 라이브러리
        </Link>
        <span className="mx-2">/</span>
        <Link
          href="/partner/stampbook-presets"
          className="hover:text-[#2D5A3D]"
        >
          스탬프북 프리셋
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">
          {preset.name || "편집"}
        </span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-3xl" aria-hidden>
              📚
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D]">
                {preset.name || "(이름 없음)"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {(() => {
                  const published = preset.is_published;
                  const vis = preset.visibility;
                  let label: string;
                  let icon: string;
                  let cls: string;
                  if (!published) {
                    label = "초안";
                    icon = "✏️";
                    cls = "border-zinc-200 bg-zinc-50 text-zinc-700";
                  } else if (vis === "PRIVATE") {
                    label = "비공개";
                    icon = "🔒";
                    cls = "border-zinc-200 bg-zinc-50 text-zinc-700";
                  } else if (vis === "ALL_ORGS") {
                    label = "전체 기관 공개";
                    icon = "🌍";
                    cls = "border-emerald-200 bg-emerald-50 text-emerald-800";
                  } else {
                    label = `${grantedOrgIds.length}개 기관 공개`;
                    icon = "👥";
                    cls = "border-violet-200 bg-violet-50 text-violet-800";
                  }
                  return (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}
                    >
                      <span aria-hidden>{icon}</span>
                      <span>{label}</span>
                    </span>
                  );
                })()}
                <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                  🎯 {preset.mission_ids?.length ?? 0}/{preset.slot_count}칸
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <PresetForm
        mode="edit"
        initial={{
          id: preset.id,
          name: preset.name,
          description: preset.description,
          slot_count: preset.slot_count,
          mission_ids: preset.mission_ids ?? [],
          cover_image_url: preset.cover_image_url,
          recommended_for_age: preset.recommended_for_age,
          is_published: preset.is_published,
          visibility: preset.visibility,
          selected_org_ids: grantedOrgIds,
        }}
        missions={simpleMissions}
        orgs={orgs.map((o) => ({ id: o.id, name: o.org_name }))}
        onSubmit={boundUpdate}
        onPublish={boundPublish}
        onUnpublish={boundUnpublish}
        onDelete={boundDelete}
      />
    </div>
  );
}
