import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { loadStampbookPresetsByPartner } from "@/lib/missions/queries";
import { createClient } from "@/lib/supabase/server";
import type { PartnerStampbookPresetRow } from "@/lib/missions/types";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function PartnerStampbookPresetsPage() {
  const partner = await requirePartner();
  const presets = await loadStampbookPresetsByPartner(partner.id);

  const publishedCount = presets.filter((p) => p.is_published).length;
  const draftCount = presets.filter((p) => !p.is_published).length;

  // SELECTED_ORGS 프리셋의 grant 카운트 일괄 조회
  const selectedPresetIds = presets
    .filter((p) => p.visibility === "SELECTED_ORGS")
    .map((p) => p.id);
  const grantCountByPreset = new Map<string, number>();
  if (selectedPresetIds.length > 0) {
    const supabase = await createClient();
    const grantsResp = (await (
      supabase.from(
        "partner_stampbook_preset_org_grants" as never
      ) as unknown as {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<{
            data: Array<{ preset_id: string }> | null;
          }>;
        };
      }
    )
      .select("preset_id")
      .in("preset_id", selectedPresetIds)) as {
      data: Array<{ preset_id: string }> | null;
    };
    for (const row of grantsResp.data ?? []) {
      grantCountByPreset.set(
        row.preset_id,
        (grantCountByPreset.get(row.preset_id) ?? 0) + 1
      );
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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
        <span className="font-semibold text-[#2D5A3D]">스탬프북 프리셋</span>
      </nav>

      {/* Header card */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#4A7C59] to-[#2D5A3D] p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D4E4BC]">
              Partner · Stampbook Presets
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <span aria-hidden>📚</span>
              <span>스탬프북 프리셋</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[#E8F0E4]">
              미션 여러 개를 묶어 기관이 한 번에 스탬프북으로 만들 수 있도록
              준비해 두는 템플릿이에요.
            </p>
            <p className="mt-2 text-xs text-[#D4E4BC]">
              추천 구성: <strong>🌱 5칸 입문형</strong> · <strong>🌿 10칸 정석형</strong> ·{" "}
              <strong>🌲 15칸 풀코스</strong>
            </p>
          </div>
          <Link
            href="/partner/stampbook-presets/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#2D5A3D] shadow-sm transition hover:bg-[#F5F1E8]"
          >
            <span aria-hidden>➕</span>
            <span>새 프리셋</span>
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 text-[#2D5A3D] sm:max-w-md">
          <div className="rounded-xl bg-white/95 p-3 text-center">
            <p className="text-[10px] font-semibold text-[#6B6560]">전체</p>
            <p className="text-xl font-extrabold">{presets.length}</p>
          </div>
          <div className="rounded-xl bg-white/95 p-3 text-center">
            <p className="text-[10px] font-semibold text-emerald-700">공개됨</p>
            <p className="text-xl font-extrabold text-emerald-800">
              {publishedCount}
            </p>
          </div>
          <div className="rounded-xl bg-white/95 p-3 text-center">
            <p className="text-[10px] font-semibold text-zinc-600">비공개</p>
            <p className="text-xl font-extrabold text-zinc-800">{draftCount}</p>
          </div>
        </div>
      </section>

      {/* List */}
      {presets.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {presets.map((p) => (
            <PresetCard
              key={p.id}
              preset={p}
              grantCount={grantCountByPreset.get(p.id) ?? 0}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PresetCard({
  preset,
  grantCount,
}: {
  preset: PartnerStampbookPresetRow;
  grantCount: number;
}) {
  const missionCount = preset.mission_ids?.length ?? 0;
  const published = preset.is_published;
  const visibility = preset.visibility;

  // visibility 뱃지 라벨/스타일
  let visLabel: string;
  let visIcon: string;
  let visClass: string;
  if (!published) {
    visLabel = "초안";
    visIcon = "✏️";
    visClass = "border-zinc-200 bg-zinc-50 text-zinc-700";
  } else if (visibility === "PRIVATE") {
    visLabel = "비공개";
    visIcon = "🔒";
    visClass = "border-zinc-200 bg-zinc-50 text-zinc-700";
  } else if (visibility === "ALL_ORGS") {
    visLabel = "전체 공개";
    visIcon = "🌍";
    visClass = "border-emerald-200 bg-emerald-50 text-emerald-800";
  } else {
    visLabel = `${grantCount}개 기관 공개`;
    visIcon = "👥";
    visClass = "border-violet-200 bg-violet-50 text-violet-800";
  }

  return (
    <li className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition hover:border-[#2D5A3D] hover:shadow-md">
      {preset.cover_image_url ? (
        <div
          className="h-28 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${preset.cover_image_url})` }}
          role="img"
          aria-label={`${preset.name} 커버 이미지`}
        />
      ) : (
        <div
          className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-[#E8F0E4] to-[#D4E4BC] text-5xl"
          aria-hidden
        >
          📚
        </div>
      )}
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${visClass}`}
          >
            <span aria-hidden>{visIcon}</span>
            <span>{visLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
            <span aria-hidden>🎯</span>
            <span>
              {missionCount}/{preset.slot_count}칸
            </span>
          </span>
          {preset.recommended_for_age && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
              <span aria-hidden>👶</span>
              <span>{preset.recommended_for_age}</span>
            </span>
          )}
        </div>
        <h3 className="truncate text-base font-bold text-[#2C2C2C]">
          {preset.name || "(이름 없음)"}
        </h3>
        {preset.description && (
          <p className="line-clamp-2 text-xs text-[#6B6560]">
            {preset.description}
          </p>
        )}
        <p className="text-[10px] text-[#8B7F75]">
          수정: {fmtDate(preset.updated_at)}
        </p>
        <div className="mt-1 pt-2">
          <Link
            href={`/partner/stampbook-presets/${preset.id}/edit`}
            className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#234a30]"
          >
            <span aria-hidden>✏️</span>
            <span>편집</span>
          </Link>
        </div>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
      <div className="text-5xl" aria-hidden>
        🌱
      </div>
      <p className="mt-3 text-base font-bold text-[#2D5A3D]">
        아직 프리셋이 없어요
      </p>
      <p className="mt-1 max-w-md text-xs text-[#6B6560]">
        자주 쓰는 미션 조합을 프리셋으로 만들어 두면, 기관이 한 번의 클릭으로
        스탬프북을 시작할 수 있어요. 추천 구성: 🌱 5칸 입문 · 🌿 10칸 정석 ·
        🌲 15칸 풀코스.
      </p>
      <Link
        href="/partner/stampbook-presets/new"
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#234a30]"
      >
        <span aria-hidden>➕</span>
        <span>첫 프리셋 만들기</span>
      </Link>
    </div>
  );
}
