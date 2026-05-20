// 행사장 신규 등록 / 편집 — ?edit=<id> 가 있으면 편집 모드.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { loadPartnerVenueById } from "@/lib/partner-venues/queries";
import { VenueForm } from "./venue-form";

export const dynamic = "force-dynamic";

export default async function NewVenuePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requirePartner();
  const sp = await searchParams;
  const editId = sp?.edit;
  const existing = editId ? await loadPartnerVenueById(editId) : null;
  if (editId && !existing) notFound();
  const isEdit = Boolean(existing);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/venues" className="hover:text-[#2D5A3D]">
          내 행사장소
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">
          {isEdit ? "행사장 편집" : "새 행사장"}
        </span>
      </nav>

      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            📍
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#2D5A3D]">
              {isEdit ? "행사장 편집" : "새 행사장 등록"}
            </h1>
            <p className="mt-1 text-xs text-[#6B6560]">
              행사장 이름·주소·이미지·주차장 정보를 입력하세요. 기관이 행사 편집
              폼에서 셀렉터로 이 행사장을 선택하면 한 번에 채워져요.
            </p>
          </div>
        </div>
      </header>

      <VenueForm
        initial={
          existing
            ? {
                id: existing.id,
                name: existing.name,
                address: existing.address ?? "",
                imageUrl: existing.image_url ?? "",
                description: existing.description ?? "",
                parkingLots: existing.parking_lots ?? [],
              }
            : null
        }
      />
    </div>
  );
}
