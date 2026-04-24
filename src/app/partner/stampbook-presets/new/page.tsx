import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { loadPartnerMissions } from "@/lib/missions/queries";
import { createClient } from "@/lib/supabase/server";
import { PresetForm } from "../preset-form";
import { createStampbookPresetAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewStampbookPresetPage() {
  const partner = await requirePartner();
  const [missions, orgs] = await Promise.all([
    loadPartnerMissions(partner.id),
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

  const publishedCount = simpleMissions.filter(
    (m) => m.status === "PUBLISHED"
  ).length;

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
        <span className="font-semibold text-[#2D5A3D]">새 프리셋</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            📚
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              새 스탬프북 프리셋
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              미션 여러 개를 묶어 기관이 한 번에 배치할 수 있도록 템플릿을
              만들어요. 공개된 미션만 담을 수 있어요 · 현재{" "}
              <strong className="text-[#2D5A3D]">
                게시된 미션 {publishedCount}개
              </strong>
              .
            </p>
          </div>
        </div>
      </header>

      {publishedCount === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm font-semibold text-amber-900">
            아직 게시된 미션이 없어요
          </p>
          <p className="mt-1 text-xs text-amber-800">
            미션 라이브러리에서 미션을 먼저 만들고 게시해 주세요.
          </p>
          <Link
            href="/partner/missions"
            className="mt-3 inline-flex items-center gap-1 rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#234a30]"
          >
            <span aria-hidden>🎯</span>
            <span>미션 라이브러리 열기</span>
          </Link>
        </div>
      ) : (
        <PresetForm
          mode="create"
          missions={simpleMissions}
          orgs={orgs.map((o) => ({ id: o.id, name: o.org_name }))}
          onSubmit={createStampbookPresetAction}
        />
      )}
    </div>
  );
}
