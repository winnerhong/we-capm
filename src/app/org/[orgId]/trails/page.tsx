import Link from "next/link";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadTrailsAssignedToOrg } from "@/lib/trails/queries";
import { DIFFICULTY_META, type TrailDifficulty } from "@/lib/trails/types";
import { loadPartnerDisplayNameForOrg } from "@/lib/org-partner";

export const dynamic = "force-dynamic";

const DIFF_STYLE: Record<TrailDifficulty, string> = {
  EASY: "bg-[#F5F1E8] text-[#2D5A3D] border-[#D4E4BC]",
  MEDIUM: "bg-amber-50 text-amber-800 border-amber-200",
  HARD: "bg-rose-50 text-rose-800 border-rose-200",
};

export default async function OrgTrailsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const org = await requireOrg();

  const [trails, partnerName] = await Promise.all([
    loadTrailsAssignedToOrg(orgId),
    loadPartnerDisplayNameForOrg(orgId),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#2D5A3D] sm:text-3xl">
          <span aria-hidden>🗺️</span>
          <span>My 코스관리</span>
        </h1>
        <p className="mt-2 text-sm text-[#6B6560]">
          {partnerName}에서 개발한 코스를 확인하세요
        </p>
      </header>

      {trails.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
          <div className="mb-3 text-5xl" aria-hidden>
            🌲
          </div>
          <p className="text-sm font-semibold text-[#2D5A3D]">
            아직 배포받은 숲길이 없어요.
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            지사에 문의해주세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {trails.map((t) => {
            const diff = DIFFICULTY_META[t.difficulty];
            return (
              <article
                key={t.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Cover */}
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#E8F0E4]">
                  {t.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.cover_image_url}
                      alt={t.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl">
                      🌲
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${DIFF_STYLE[t.difficulty]}`}
                    >
                      {diff.icon} {diff.label}
                    </span>
                    {t.estimated_minutes !== null &&
                      t.estimated_minutes !== undefined && (
                        <span className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                          ⏱ {t.estimated_minutes}분
                        </span>
                      )}
                    <span className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                      📍 {t.total_slots}지점
                    </span>
                  </div>

                  <h3 className="line-clamp-2 text-sm font-bold text-[#2C2C2C]">
                    {t.name}
                  </h3>
                  {t.description && (
                    <p className="line-clamp-2 text-xs text-[#6B6560]">
                      {t.description}
                    </p>
                  )}

                  <div className="mt-auto flex items-center gap-2 pt-3">
                    <Link
                      href={`/org/${orgId}/trails/${t.id}/qr`}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#4A7C59]"
                    >
                      🎫 QR 보기
                    </Link>
                    {t.slug && (
                      <Link
                        href={`/trail/${t.slug}`}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
                      >
                        🔗 공유
                      </Link>
                    )}
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
