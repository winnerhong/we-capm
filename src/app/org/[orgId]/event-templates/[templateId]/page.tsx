import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOrg } from "@/lib/org-auth-guard";
import {
  getTemplateById,
  listTemplateItems,
  listAvailableTemplatesForOrg,
} from "@/lib/event-templates/queries";
import { ITEM_TYPE_META } from "@/lib/event-templates/types";
import { hasFeature } from "@/lib/features/guard";
import { createClient } from "@/lib/supabase/server";
import { EventTimeRangePicker } from "@/components/event-time-range-picker";
import { importEventTemplateAction } from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgId: string; templateId: string }>;
};

async function loadPartnerLabel(partnerId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partners" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { name: string; business_name: string | null } | null;
            error: unknown;
          }>;
        };
      };
    }
  )
    .select("name,business_name")
    .eq("id", partnerId)
    .maybeSingle();
  return data?.business_name?.trim() || data?.name || "지사";
}

function fmtDateOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function OrgEventTemplateDetail({ params }: PageProps) {
  const { orgId, templateId } = await params;
  await requireOrg();

  const template = await getTemplateById(templateId);
  if (!template || template.is_deleted || template.status !== "PUBLISHED")
    notFound();

  const accessible = await listAvailableTemplatesForOrg(orgId);
  if (!accessible.some((t) => t.id === templateId)) notFound();

  const [items, partnerLabel] = await Promise.all([
    listTemplateItems(templateId),
    loadPartnerLabel(template.partner_id),
  ]);

  // 각 항목별로 지사 보유 여부 미리 체크 (UI 안내)
  const featureChecks = await Promise.all(
    items.map(async (it) => {
      if (!it.required_feature_code) return { id: it.id, partnerHas: true };
      const ok = await hasFeature(template.partner_id, it.required_feature_code);
      return { id: it.id, partnerHas: ok };
    })
  );
  const checkMap = new Map(featureChecks.map((c) => [c.id, c.partnerHas]));

  // 기본값 — 다음 주 토요일 10:00 시작, 권장 진행 시간(분) 또는 3시간
  const next = new Date();
  next.setDate(next.getDate() + 7);
  const defaultStartDate = fmtDateOnly(next);
  const defaultStartHour = 10;
  const defaultStartMinute = 0;
  const defaultDurationMin =
    template.recommended_duration_hours != null
      ? Math.max(
          5,
          Math.min(600, Math.round(template.recommended_duration_hours * 60))
        )
      : 180;

  async function importAction(formData: FormData) {
    "use server";
    const res = await importEventTemplateAction(templateId, formData);
    if (!res.ok) throw new Error(res.message);
    const params = new URLSearchParams({
      imported: "1",
      programs: String(res.copiedPrograms),
      slots: String(res.copiedSlots),
      trails: String(res.copiedTrails),
      presets: String(res.copiedPresets),
      fm: String(res.copiedFmSessions),
    });
    if (res.skippedItems.length) params.set("skip", String(res.skippedItems.length));
    redirect(`/org/${orgId}/events/${res.eventId}?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href={`/org/${orgId}`} className="hover:text-[#2D5A3D]">
          기관 홈
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/org/${orgId}/event-templates`}
          className="hover:text-[#2D5A3D]"
        >
          행사 템플릿
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">{template.name}</span>
      </nav>

      {/* Header */}
      <header className="overflow-hidden rounded-3xl border border-[#D4E4BC] bg-white shadow-sm">
        <div className="aspect-[21/9] w-full bg-[#FFF8F0]">
          {template.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={template.cover_image_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl opacity-40">
              📦
            </div>
          )}
        </div>
        <div className="p-5 md:p-7">
          <h1 className="text-2xl font-bold text-[#2D5A3D] md:text-3xl">
            {template.name}
          </h1>
          {template.subtitle && (
            <p className="mt-1 text-sm text-[#6B6560]">{template.subtitle}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-[#E5DDD0] bg-white px-2 py-0.5 font-semibold text-[#2D5A3D]">
              🏡 {partnerLabel}
            </span>
            {template.recommended_duration_hours && (
              <span className="rounded-full border border-[#E5DDD0] bg-white px-2 py-0.5">
                ⏱️ 권장 {template.recommended_duration_hours}시간
              </span>
            )}
            {(template.recommended_capacity_min ||
              template.recommended_capacity_max) && (
              <span className="rounded-full border border-[#E5DDD0] bg-white px-2 py-0.5">
                👥 {template.recommended_capacity_min ?? "?"}~
                {template.recommended_capacity_max ?? "?"}명
              </span>
            )}
          </div>
          {template.description && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[#2C2C2C]">
              {template.description}
            </p>
          )}
        </div>
      </header>

      {/* 구성 항목 */}
      <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-7">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>🧩</span>
          <span>구성 항목 ({items.length})</span>
        </h2>
        {items.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-6 text-center text-xs text-[#6B6560]">
            구성 항목이 없는 빈 템플릿이에요.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[#F0EBE3]">
            {items.map((it) => {
              const meta = ITEM_TYPE_META[it.item_type];
              const partnerHas = checkMap.get(it.id) !== false;
              const isProgram = it.item_type === "PROGRAM";
              return (
                <li key={it.id} className="flex items-center gap-3 py-3">
                  <span className="text-xl shrink-0" aria-hidden>
                    {meta.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-[#2D5A3D]">
                      {it.item_name_snapshot ?? meta.label}
                    </div>
                    <div className="text-[11px] text-[#8B7F75]">
                      {meta.label}
                      {!isProgram && " (현재 자동복제 미지원)"}
                    </div>
                  </div>
                  {it.required_feature_code && !partnerHas && (
                    <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                      ⚠️ 지사 {it.required_feature_code} 미보유
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[11px] text-amber-900">
          💡 가져오기 시 <b>프로그램</b>은 자동 복사됩니다. 숲길/스탬프북/미션팩
          등은 추후 지원 예정으로 빈 슬롯으로 남고, 가져온 후 직접 추가하세요.
        </p>
      </section>

      {/* 가져오기 */}
      <form
        action={importAction}
        className="space-y-4 rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-7"
      >
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>📥</span>
          <span>내 행사로 가져오기</span>
        </h2>
        <p className="text-[11px] text-[#6B6560]">
          행사명과 일정을 정해주세요. 가져온 행사는 DRAFT 상태로 만들어지며,
          이후 자유롭게 수정할 수 있어요.
        </p>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-[#2D5A3D]">
            행사명
          </label>
          <input
            name="name"
            defaultValue={template.name}
            maxLength={120}
            className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
          <p className="text-[10px] text-[#8B7F75]">
            템플릿명 그대로 두거나 우리 행사에 맞게 수정하세요.
          </p>
        </div>

        <EventTimeRangePicker
          defaultDate={defaultStartDate}
          defaultHour={defaultStartHour}
          defaultMinute={defaultStartMinute}
          defaultDurationMin={defaultDurationMin}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href={`/org/${orgId}/event-templates`}
            className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="rounded-xl bg-[#2D5A3D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#3A7A52]"
          >
            📥 내 행사로 가져오기
          </button>
        </div>
      </form>
    </div>
  );
}
