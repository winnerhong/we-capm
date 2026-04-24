import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import { loadOrgEventById } from "@/lib/org-events/queries";
import { EditEventForm } from "./edit-event-form";

export const dynamic = "force-dynamic";

export default async function EditOrgEventPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  await requireOrg();

  const event = await loadOrgEventById(eventId);
  if (!event || event.org_id !== orgId) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/events`}
          className="hover:text-[#2D5A3D]"
        >
          행사
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/events/${eventId}`}
          className="truncate hover:text-[#2D5A3D]"
        >
          {event.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">편집</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            ✏️
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              행사 편집
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              이름·기간·설명·상태를 수정할 수 있어요.
            </p>
          </div>
        </div>
      </header>

      <EditEventForm
        orgId={orgId}
        eventId={eventId}
        initial={{
          name: event.name ?? "",
          description: event.description ?? "",
          starts_at: event.starts_at,
          ends_at: event.ends_at,
          cover_image_url: event.cover_image_url ?? "",
          status: event.status,
          // allow_self_register 는 backend migration 후 추가된 컬럼 — 타입에는
          // 아직 없을 수 있으므로 안전하게 캐스팅.
          allow_self_register:
            (event as unknown as { allow_self_register?: boolean })
              .allow_self_register ?? false,
        }}
      />
    </div>
  );
}
