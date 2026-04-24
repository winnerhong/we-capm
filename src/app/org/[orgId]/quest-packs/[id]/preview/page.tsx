import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { AcornIcon } from "@/components/acorn-icon";
import {
  loadOrgQuestPackById,
  loadOrgMissionsByQuestPack,
} from "@/lib/missions/queries";
import {
  MISSION_KIND_META,
  QUEST_PACK_STATUS_META,
  type OrgMissionRow,
} from "@/lib/missions/types";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function OrgQuestPackPreviewPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>;
}) {
  const { orgId, id } = await params;
  const session = await requireOrg();

  const pack = await loadOrgQuestPackById(id);
  if (!pack || pack.org_id !== orgId) notFound();

  const missions = await loadOrgMissionsByQuestPack(id);
  const statusMeta = QUEST_PACK_STATUS_META[pack.status];
  const isLive = pack.status === "LIVE";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
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
        <span className="font-semibold text-[#2D5A3D]">미리보기</span>
      </nav>

      {/* 미리보기 안내 배너 */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900">
        👀 참가자 시점으로 보는 스탬프북 미리보기에요. 실제 참가자 화면과
        동일한 레이아웃이 보여요.
      </div>

      {/* 스탬프북 커버 */}
      <section className="overflow-hidden rounded-3xl border-2 border-[#D4E4BC] bg-white shadow-md">
        {pack.cover_image_url ? (
          <div
            className="h-40 w-full bg-cover bg-center md:h-56"
            style={{ backgroundImage: `url(${pack.cover_image_url})` }}
            role="img"
            aria-label={`${pack.name} 커버 이미지`}
          />
        ) : (
          <div
            className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-[#E8F0E4] to-[#D4E4BC] text-7xl md:h-56 md:text-8xl"
            aria-hidden
          >
            🌲
          </div>
        )}

        <div className="space-y-3 p-5 md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                isLive
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : statusMeta.color
              }`}
            >
              {isLive ? "🟢 진행중" : statusMeta.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-3 py-1 text-xs font-semibold text-[#2D5A3D]">
              <span aria-hidden>🎯</span>
              <span>{missions.length}개 미션</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#2C2C2C] md:text-3xl">
            {pack.name || "(이름 없음)"}
          </h1>
          <p className="text-sm text-[#6B6560]">
            📅 {fmtDate(pack.starts_at)} ~ {fmtDate(pack.ends_at)}
          </p>
          {pack.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#4A4640]">
              {pack.description}
            </p>
          )}
        </div>
      </section>

      {/* 스탬프 그리드 */}
      <section className="space-y-3 rounded-3xl border border-[#D4E4BC] bg-[#FFF8F0] p-5 shadow-sm md:p-6">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#2D5A3D]">
            🌲 스탬프북 격자
          </h2>
          <span className="text-[11px] text-[#8B7F75]">
            총 {missions.length}칸
          </span>
        </header>
        <StampGrid missions={missions} />
      </section>

      {/* 미션 상세 리스트 */}
      {missions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-[#2D5A3D]">📋 미션 목록</h2>
          <ol className="space-y-2">
            {missions.map((m, idx) => {
              const kindMeta = MISSION_KIND_META[m.kind];
              return (
                <li
                  key={m.id}
                  className="flex items-start gap-3 rounded-xl border border-[#D4E4BC] bg-white p-3 shadow-sm"
                >
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#E8F0E4] text-sm font-bold text-[#2D5A3D]"
                    aria-hidden
                  >
                    {idx + 1}
                  </span>
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#FFF8F0] text-xl"
                    aria-hidden
                  >
                    {m.icon || kindMeta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#2C2C2C]">
                      {m.title || "(제목 없음)"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                        {kindMeta.icon} {kindMeta.label}
                      </span>
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        <AcornIcon size={12} /> +{m.acorns}
                      </span>
                      {!m.is_active && (
                        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                          비활성
                        </span>
                      )}
                    </div>
                    {m.description && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-[#6B6560]">
                        {m.description}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* 하단 CTA */}
      <div className="flex flex-col gap-2 rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm sm:flex-row">
        <Link
          href={`/org/${orgId}/quest-packs/${id}/edit`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#234a30]"
        >
          <span aria-hidden>✏️</span>
          <span>편집으로 이동</span>
        </Link>
        <Link
          href={`/org/${orgId}/quest-packs`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
        >
          <span aria-hidden>←</span>
          <span>목록으로</span>
        </Link>
      </div>
    </div>
  );
}

function StampGrid({ missions }: { missions: OrgMissionRow[] }) {
  if (missions.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl bg-[#F5F1E8] text-xs text-[#8B7F75]">
        아직 미션이 없어요. 편집에서 미션을 담아주세요.
      </div>
    );
  }

  const cols = 5;
  return (
    <div
      className="grid gap-2 md:gap-3"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-label={`${cols}열 스탬프북 격자`}
    >
      {missions.map((m, idx) => {
        const meta = MISSION_KIND_META[m.kind];
        return (
          <div
            key={m.id}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-[#D4E4BC] bg-white p-1.5 text-center shadow-sm"
            aria-label={`${idx + 1}번 ${meta.label}: ${m.title}`}
          >
            <span className="text-2xl md:text-3xl" aria-hidden>
              {m.icon || meta.icon}
            </span>
            <span className="text-[10px] font-bold text-[#2D5A3D]">
              {idx + 1}
            </span>
            <span className="line-clamp-1 text-[9px] text-[#6B6560]">
              {m.title || meta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
