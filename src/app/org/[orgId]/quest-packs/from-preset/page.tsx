import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  loadAccessiblePresetsForOrg,
  loadAvailableMissionsForOrg,
} from "@/lib/missions/queries";
import { createPackFromPresetAction } from "../../missions/actions";
import type { PartnerStampbookPresetRow } from "@/lib/missions/types";

export const dynamic = "force-dynamic";

export default async function QuestPackFromPresetPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrg();

  // 이 기관이 접근 가능한 프리셋 = 내 지사의 published & visibility 공개 & grants 체크
  const [presets, availableMissions] = await Promise.all([
    loadAccessiblePresetsForOrg(orgId),
    loadAvailableMissionsForOrg(orgId),
  ]);

  // 각 프리셋에 대해: mission_ids 중 몇 개가 우리 기관에서 사용 가능한지 파악
  const availableIdSet = new Set(availableMissions.map((m) => m.id));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/quest-packs`}
          className="hover:text-[#2D5A3D]"
        >
          스탬프북 관리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">
          프리셋으로 빠르게 시작
        </span>
      </nav>

      {/* Header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#FAE7D0] via-white to-[#E8F0E4] p-6 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            ✨
          </span>
          <div>
            <h1 className="text-2xl font-bold text-[#2D5A3D] md:text-3xl">
              프리셋으로 빠르게 시작하기
            </h1>
            <p className="mt-1 text-sm text-[#6B6560]">
              지사가 만들어 둔 스탬프북 템플릿을 골라, 한 번의 클릭으로 우리
              기관의 스탬프북을 만들어요. 생성 후 자유롭게 편집할 수 있어요.
            </p>
          </div>
        </div>
      </section>

      {presets.length === 0 ? (
        <EmptyState orgId={orgId} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {presets.map((p) => {
            const inCatalog =
              (p.mission_ids ?? []).filter((id) => availableIdSet.has(id))
                .length;
            const total = p.mission_ids?.length ?? 0;
            const fullyAvailable = inCatalog === total && total > 0;
            return (
              <PresetCard
                key={p.id}
                orgId={orgId}
                preset={p}
                inCatalogCount={inCatalog}
                totalCount={total}
                fullyAvailable={fullyAvailable}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PresetCard({
  orgId,
  preset,
  inCatalogCount,
  totalCount,
  fullyAvailable,
}: {
  orgId: string;
  preset: PartnerStampbookPresetRow;
  inCatalogCount: number;
  totalCount: number;
  fullyAvailable: boolean;
}) {
  const createBound = createPackFromPresetAction.bind(
    null,
    orgId,
    preset.id
  );
  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition hover:border-[#2D5A3D] hover:shadow-md">
      {preset.cover_image_url ? (
        <div
          className="h-28 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${preset.cover_image_url})` }}
          role="img"
          aria-label={`${preset.name} 커버`}
        />
      ) : (
        <div
          className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-[#E8F0E4] to-[#D4E4BC] text-5xl"
          aria-hidden
        >
          📚
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
            🎯 {totalCount}/{preset.slot_count}칸
          </span>
          {preset.recommended_for_age && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
              👶 {preset.recommended_for_age}
            </span>
          )}
          {fullyAvailable ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              ✅ 전부 사용 가능
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              ⚠️ {inCatalogCount}/{totalCount}개 배포됨
            </span>
          )}
        </div>
        <h3 className="truncate text-base font-bold text-[#2C2C2C]">
          {preset.name}
        </h3>
        {preset.description && (
          <p className="line-clamp-2 text-xs text-[#6B6560]">
            {preset.description}
          </p>
        )}

        <div className="mt-auto pt-3">
          <form action={createBound}>
            <button
              type="submit"
              disabled={!fullyAvailable}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              title={
                fullyAvailable
                  ? undefined
                  : "이 프리셋의 일부 미션이 아직 우리 기관에 배포되지 않았어요"
              }
            >
              <span aria-hidden>✨</span>
              <span>이 프리셋으로 스탬프북 만들기</span>
            </button>
          </form>
          {!fullyAvailable && (
            <p className="mt-1 text-[10px] text-amber-700">
              일부 미션이 배포되지 않아 생성이 제한돼요.
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function EmptyState({ orgId }: { orgId: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
      <div className="text-5xl" aria-hidden>
        🌱
      </div>
      <p className="mt-3 text-base font-bold text-[#2D5A3D]">
        아직 사용할 수 있는 프리셋이 없어요
      </p>
      <p className="mt-1 max-w-md text-xs text-[#6B6560]">
        지사가 스탬프북 프리셋을 만들고 공개하면 여기서 한 번에 선택할 수
        있어요. 그동안에는 새 스탬프북을 직접 만들어 시작해 보세요.
      </p>
      <Link
        href={`/org/${orgId}/quest-packs/new`}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#234a30]"
      >
        <span aria-hidden>➕</span>
        <span>직접 만들기</span>
      </Link>
    </div>
  );
}
