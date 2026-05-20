// 지사 행사장 카탈로그 — 목록 + 새 행사장 진입점.

import Link from "next/link";
import { requirePartner } from "@/lib/auth-guard";
import { loadPartnerVenues } from "@/lib/partner-venues/queries";
import { VenueRowActions } from "./venue-row-actions";

export const dynamic = "force-dynamic";

export default async function PartnerVenuesPage() {
  const partner = await requirePartner();
  const venues = await loadPartnerVenues(partner.id, {
    includeArchived: true,
  });

  const active = venues.filter((v) => !v.is_archived);
  const archived = venues.filter((v) => v.is_archived);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">내 행사장소</span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-3xl" aria-hidden>
              📍
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D]">내 행사장소</h1>
              <p className="mt-1 text-xs text-[#6B6560]">
                지사가 운영하는 행사장을 미리 등록해 두면, 기관이 행사 편집 폼
                에서 한 번 클릭으로 장소 정보·주차장 정보를 채울 수 있어요.
              </p>
            </div>
          </div>
          <Link
            href="/partner/venues/new"
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2 text-xs font-bold text-white shadow-md hover:from-[#234a30]"
          >
            🌱 새 행사장
          </Link>
        </div>
      </header>

      {/* 활성 */}
      {active.length === 0 ? (
        <section className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/70 px-6 py-10 text-center">
          <p className="text-3xl" aria-hidden>
            📍
          </p>
          <p className="mt-2 text-sm font-bold text-[#2D5A3D]">
            아직 등록된 행사장이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            자주 사용하는 행사장을 미리 등록해 두세요
          </p>
        </section>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {active.map((v) => (
            <li
              key={v.id}
              className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm"
            >
              {v.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.image_url}
                  alt={v.name}
                  className="h-32 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-[#F5F1E8] to-[#FAE7D0] text-4xl">
                  📍
                </div>
              )}
              <div className="p-3">
                <h3 className="truncate text-sm font-bold text-[#2D5A3D]">
                  {v.name}
                </h3>
                {v.address && (
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-[#6B6560]">
                    {v.address}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[#8B7F75]">
                  <span>🅿 주차장 {v.parking_lots.length}개</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Link
                    href={`/partner/venues/new?edit=${v.id}`}
                    className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-[10px] font-bold text-[#2D5A3D] hover:bg-[#F5F1E8]"
                  >
                    ✏ 수정
                  </Link>
                  <VenueRowActions id={v.id} label={v.name} archived={false} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 보관함 */}
      {archived.length > 0 && (
        <details className="rounded-2xl border border-[#E5D3B8] bg-[#FFF8F0] p-3">
          <summary className="cursor-pointer text-xs font-bold text-[#8B6F47]">
            📦 보관함 ({archived.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {archived.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12px]"
              >
                <span className="flex-1 truncate text-[#6B6560]">
                  {v.name}
                  {v.address && (
                    <span className="ml-1 text-[10px] text-[#8B7F75]">
                      · {v.address}
                    </span>
                  )}
                </span>
                <VenueRowActions id={v.id} label={v.name} archived={true} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
