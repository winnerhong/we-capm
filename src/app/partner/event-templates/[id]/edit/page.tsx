import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { hasFeature, getFeatureMap } from "@/lib/features/guard";
import { createClient } from "@/lib/supabase/server";
import { FeatureGate } from "@/components/features/feature-gate";
import { CoverImageField } from "@/components/cover-image-field";
import {
  getTemplateById,
  listTemplateItems,
  listTemplateTimetable,
} from "@/lib/event-templates/queries";
import {
  ITEM_TYPE_META,
  TEMPLATE_STATUS_META,
  VISIBILITY_META,
  TEMPLATE_VISIBILITIES,
  TEMPLATE_STATUSES,
  TIMETABLE_SLOT_KINDS,
  SLOT_KIND_META,
} from "@/lib/event-templates/types";
import {
  updateTemplateAction,
  setTemplateStatusAction,
  setTemplateVisibilityAction,
  softDeleteTemplateAction,
} from "../../actions";
import {
  addTemplateItemAction,
  addFmSessionPresetItemAction,
  removeTemplateItemAction,
} from "../../item-actions";
import {
  addTimetableSlotAction,
  removeTimetableSlotAction,
} from "../../timetable-actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

type ProgramRow = { id: string; title: string };
type TrailRow = { id: string; name: string };
type StampbookPresetRow = { id: string; name: string };

async function loadPartnerPrograms(partnerId: string): Promise<ProgramRow[]> {
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partner_programs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: ProgramRow[] | null; error: unknown }>;
        };
      };
    }
  )
    .select("id,title")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function loadPartnerStampbookPresets(
  partnerId: string
): Promise<StampbookPresetRow[]> {
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partner_stampbook_presets" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: boolean) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<{
              data: StampbookPresetRow[] | null;
              error: unknown;
            }>;
          };
        };
      };
    }
  )
    .select("id,name")
    .eq("partner_id", partnerId)
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function loadPartnerTrails(partnerId: string): Promise<TrailRow[]> {
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partner_trails" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          neq: (k: string, v: string) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<{ data: TrailRow[] | null; error: unknown }>;
          };
        };
      };
    }
  )
    .select("id,name")
    .eq("partner_id", partnerId)
    .neq("status", "ARCHIVED")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export default async function EditTemplatePage({ params }: PageProps) {
  const partner = await requirePartner();
  const { id: templateId } = await params;

  const enabled = await hasFeature(partner.id, "EVENT_TEMPLATE");
  if (!enabled) {
    return (
      <FeatureGate featureCode="EVENT_TEMPLATE" featureName="행사 템플릿" />
    );
  }

  const template = await getTemplateById(templateId);
  if (!template || template.partner_id !== partner.id || template.is_deleted)
    notFound();

  const [items, programs, trails, presets, featureMap, slots] = await Promise.all([
    listTemplateItems(templateId),
    loadPartnerPrograms(partner.id),
    loadPartnerTrails(partner.id),
    loadPartnerStampbookPresets(partner.id),
    getFeatureMap(partner.id, ["TRAIL", "STAMPBOOK", "MISSION_LIB", "TORI_FM"]),
    listTemplateTimetable(templateId),
  ]);

  const usedProgramIds = new Set(
    items.filter((i) => i.item_type === "PROGRAM").map((i) => i.item_id)
  );
  const usedTrailIds = new Set(
    items.filter((i) => i.item_type === "TRAIL").map((i) => i.item_id)
  );
  const usedPresetIds = new Set(
    items
      .filter((i) => i.item_type === "STAMPBOOK_PRESET")
      .map((i) => i.item_id)
  );

  // ---------- server actions (form binding) ----------
  async function saveMeta(formData: FormData) {
    "use server";
    const res = await updateTemplateAction(templateId, formData);
    if (!res.ok) throw new Error(res.message);
    redirect(`/partner/event-templates/${templateId}/edit?ok=meta`);
  }

  async function changeStatus(formData: FormData) {
    "use server";
    const next = String(formData.get("status") ?? "");
    const res = await setTemplateStatusAction(templateId, next);
    if (!res.ok) throw new Error(res.message);
    redirect(`/partner/event-templates/${templateId}/edit?ok=status`);
  }

  async function changeVisibility(formData: FormData) {
    "use server";
    const next = String(formData.get("visibility") ?? "");
    const res = await setTemplateVisibilityAction(templateId, next);
    if (!res.ok) throw new Error(res.message);
    redirect(`/partner/event-templates/${templateId}/edit?ok=visibility`);
  }

  async function addItem(formData: FormData) {
    "use server";
    const itemType = String(formData.get("item_type") ?? "");
    const itemId = String(formData.get("item_id") ?? "");
    const res = await addTemplateItemAction(templateId, itemType, itemId);
    if (!res.ok) throw new Error(res.message);
    redirect(`/partner/event-templates/${templateId}/edit?ok=item-added`);
  }

  async function addFmItem(formData: FormData) {
    "use server";
    const name = String(formData.get("fm_name") ?? "");
    const note = String(formData.get("fm_note") ?? "");
    const res = await addFmSessionPresetItemAction(templateId, name, note);
    if (!res.ok) throw new Error(res.message);
    redirect(`/partner/event-templates/${templateId}/edit?ok=fm-added`);
  }

  async function removeItem(formData: FormData) {
    "use server";
    const itemId = String(formData.get("item_id") ?? "");
    const res = await removeTemplateItemAction(itemId);
    if (!res.ok) throw new Error(res.message);
    redirect(`/partner/event-templates/${templateId}/edit?ok=item-removed`);
  }

  async function deleteTemplate() {
    "use server";
    const res = await softDeleteTemplateAction(templateId);
    if (!res.ok) throw new Error(res.message);
    redirect("/partner/event-templates");
  }

  async function addSlot(formData: FormData) {
    "use server";
    const res = await addTimetableSlotAction(templateId, formData);
    if (!res.ok) throw new Error(res.message);
    redirect(`/partner/event-templates/${templateId}/edit?ok=slot-added`);
  }

  async function removeSlot(formData: FormData) {
    "use server";
    const slotId = String(formData.get("slot_id") ?? "");
    const res = await removeTimetableSlotAction(slotId);
    if (!res.ok) throw new Error(res.message);
    redirect(`/partner/event-templates/${templateId}/edit?ok=slot-removed`);
  }

  const sm = TEMPLATE_STATUS_META[template.status];
  const vm = VISIBILITY_META[template.visibility];

  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/event-templates" className="hover:text-[#2D5A3D]">
          행사 템플릿
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">
          {template.name} 편집
        </span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              📦
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
                {template.name}
              </h1>
              {template.subtitle && (
                <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
                  {template.subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sm.bg} ${sm.text}`}
          >
            {sm.label}
          </span>
          <span className="rounded-full border border-[#E5DDD0] bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#6B6560]">
            {vm.emoji} {vm.label}
          </span>
          <span className="text-[11px] text-[#8B7F75]">
            항목 {items.length}개
          </span>
        </div>
      </header>

      {/* 상태/공개여부 빠른 변경 */}
      <section className="grid gap-3 md:grid-cols-2">
        <form
          action={changeStatus}
          className="rounded-2xl border border-[#D4E4BC] bg-white p-4"
        >
          <label className="block text-xs font-semibold text-[#2D5A3D]">
            상태
          </label>
          <div className="mt-2 flex gap-2">
            <select
              name="status"
              defaultValue={template.status}
              className="flex-1 rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
            >
              {TEMPLATE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TEMPLATE_STATUS_META[s].label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl bg-[#2D5A3D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3A7A52]"
            >
              변경
            </button>
          </div>
          <p className="mt-1 text-[10px] text-[#8B7F75]">
            기관에 보이려면 PUBLISHED 로 변경
          </p>
        </form>

        <form
          action={changeVisibility}
          className="rounded-2xl border border-[#D4E4BC] bg-white p-4"
        >
          <label className="block text-xs font-semibold text-[#2D5A3D]">
            공개여부
          </label>
          <div className="mt-2 flex gap-2">
            <select
              name="visibility"
              defaultValue={template.visibility}
              className="flex-1 rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
            >
              {TEMPLATE_VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {VISIBILITY_META[v].emoji} {VISIBILITY_META[v].label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl bg-[#2D5A3D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3A7A52]"
            >
              변경
            </button>
          </div>
          <p className="mt-1 text-[10px] text-[#8B7F75]">{vm.desc}</p>
        </form>
      </section>

      {/* 기본 정보 */}
      <form
        action={saveMeta}
        className="space-y-5 rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-7"
      >
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>✏️</span>
          <span>기본 정보</span>
        </h2>

        <Field label="이름">
          <input
            name="name"
            required
            maxLength={80}
            defaultValue={template.name}
            className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </Field>

        <Field label="부제">
          <input
            name="subtitle"
            maxLength={200}
            defaultValue={template.subtitle ?? ""}
            className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </Field>

        <Field label="대표 이미지">
          <CoverImageField
            name="cover_image_url"
            defaultValue={template.cover_image_url ?? ""}
            pathPrefix="event-templates"
            hint="클릭·드래그·붙여넣기(Ctrl+V) 모두 가능 · 500KB 자동 압축"
            compact
          />
        </Field>

        <Field label="설명">
          <textarea
            name="description"
            rows={4}
            maxLength={4000}
            defaultValue={template.description ?? ""}
            className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="권장 진행 시간(분)">
            <input
              name="recommended_duration_minutes"
              type="number"
              step={5}
              min={0}
              max={6000}
              defaultValue={
                template.recommended_duration_hours != null
                  ? Math.round(template.recommended_duration_hours * 60)
                  : ""
              }
              placeholder="예: 180"
              className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
            />
          </Field>
          <Field label="권장 최소 인원">
            <input
              name="recommended_capacity_min"
              type="number"
              min={0}
              max={100000}
              defaultValue={template.recommended_capacity_min ?? ""}
              className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
            />
          </Field>
          <Field label="권장 최대 인원">
            <input
              name="recommended_capacity_max"
              type="number"
              min={0}
              max={100000}
              defaultValue={template.recommended_capacity_max ?? ""}
              className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
            />
          </Field>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="rounded-xl bg-[#2D5A3D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#3A7A52]"
          >
            저장
          </button>
        </div>
      </form>

      {/* 항목 목록 */}
      <section className="space-y-4 rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-7">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>🧩</span>
          <span>구성 항목 ({items.length})</span>
        </h2>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-8 text-center text-xs text-[#6B6560]">
            아직 추가된 항목이 없어요. 아래에서 프로그램이나 숲길을 추가하세요.
          </p>
        ) : (
          <ul className="divide-y divide-[#F0EBE3]">
            {items.map((it) => {
              const meta = ITEM_TYPE_META[it.item_type];
              return (
                <li
                  key={it.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl shrink-0" aria-hidden>
                        {meta.emoji}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#2D5A3D]">
                          {it.item_name_snapshot ?? "(이름 없음)"}
                        </div>
                        <div className="font-mono text-[10px] text-[#8B7F75]">
                          {meta.label} · {it.item_id.slice(0, 8)}…
                        </div>
                        {it.required_feature_code && (
                          <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            🔑 {it.required_feature_code}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <form action={removeItem}>
                    <input type="hidden" name="item_id" value={it.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      제거
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        {/* PROGRAM 추가 */}
        <ItemPicker
          title="🗺️ 프로그램 추가"
          itemType="PROGRAM"
          options={programs
            .filter((p) => !usedProgramIds.has(p.id))
            .map((p) => ({ id: p.id, label: p.title }))}
          action={addItem}
          requiredFeature={null}
          featureMap={featureMap}
        />

        {/* TRAIL 추가 */}
        <ItemPicker
          title="🥾 숲길 추가"
          itemType="TRAIL"
          options={trails
            .filter((t) => !usedTrailIds.has(t.id))
            .map((t) => ({ id: t.id, label: t.name }))}
          action={addItem}
          requiredFeature="TRAIL"
          featureMap={featureMap}
        />

        {/* STAMPBOOK_PRESET 추가 */}
        <ItemPicker
          title="📚 스탬프북 프리셋 추가"
          itemType="STAMPBOOK_PRESET"
          options={presets
            .filter((p) => !usedPresetIds.has(p.id))
            .map((p) => ({ id: p.id, label: p.name }))}
          action={addItem}
          requiredFeature="STAMPBOOK"
          featureMap={featureMap}
        />

        {/* FM_SESSION_PRESET 추가 (이름·노트만) */}
        <FmSessionPicker
          action={addFmItem}
          hasFm={featureMap["TORI_FM"] === true}
        />
      </section>

      {/* 권장 타임테이블 */}
      <section className="space-y-4 rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-7">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🕒</span>
            <span>권장 타임테이블 ({slots.length})</span>
          </h2>
          <p className="hidden text-[10px] text-[#8B7F75] md:block">
            기관이 가져갈 때 행사 시작시각 기준으로 자동 환산
          </p>
        </div>

        {slots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-8 text-center text-xs text-[#6B6560]">
            아직 등록된 슬롯이 없어요. 아래에서 첫 슬롯을 추가해보세요.
          </p>
        ) : (
          <ul className="divide-y divide-[#F0EBE3]">
            {slots.map((s) => {
              const km = SLOT_KIND_META[s.slot_kind];
              const startTxt = formatOffset(s.offset_min);
              const endTxt =
                s.duration_min != null
                  ? `~ ${formatOffset(s.offset_min + s.duration_min)}`
                  : null;
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl shrink-0" aria-hidden>
                        {s.icon_emoji ?? km.emoji}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#2D5A3D]">
                          {s.title}
                        </div>
                        <div className="font-mono text-[10px] text-[#8B7F75]">
                          ⏱️ {startTxt}
                          {endTxt ? ` ${endTxt}` : ""} · {km.label}
                          {s.location ? ` · 📍 ${s.location}` : ""}
                        </div>
                        {s.description && (
                          <div className="mt-0.5 text-[11px] text-[#6B6560] line-clamp-2">
                            {s.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <form action={removeSlot}>
                    <input type="hidden" name="slot_id" value={s.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      제거
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        {/* 슬롯 추가 폼 */}
        <form
          action={addSlot}
          className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-3"
        >
          <h3 className="mb-2 text-xs font-semibold text-[#2D5A3D]">
            ➕ 새 슬롯 추가
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold text-[#2D5A3D]">
                슬롯 제목
              </span>
              <input
                name="title"
                required
                maxLength={100}
                placeholder="예: 입소식 / 미션 출발 / 점심"
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold text-[#2D5A3D]">
                종류
              </span>
              <select
                name="slot_kind"
                defaultValue="CUSTOM"
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
              >
                {TIMETABLE_SLOT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {SLOT_KIND_META[k].emoji} {SLOT_KIND_META[k].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold text-[#2D5A3D]">
                시작 오프셋 (분, 행사 시작 0분 기준)
              </span>
              <input
                name="offset_min"
                type="number"
                required
                min={0}
                max={6000}
                step={5}
                defaultValue={0}
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold text-[#2D5A3D]">
                길이 (분, 선택)
              </span>
              <input
                name="duration_min"
                type="number"
                min={1}
                max={6000}
                step={5}
                placeholder="비워두면 점 시각"
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 font-mono text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="block text-[10px] font-semibold text-[#2D5A3D]">
                설명 (선택)
              </span>
              <input
                name="description"
                maxLength={1000}
                placeholder="진행 노트 / 안내문"
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold text-[#2D5A3D]">
                아이콘 이모지 (선택)
              </span>
              <input
                name="icon_emoji"
                maxLength={4}
                placeholder="🎯"
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold text-[#2D5A3D]">
                장소 (선택)
              </span>
              <input
                name="location"
                maxLength={200}
                placeholder="예: 본관 1층 강당"
                className="w-full rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-[#2D5A3D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3A7A52]"
            >
              ➕ 슬롯 추가
            </button>
          </div>
        </form>
      </section>

      {/* 위험 영역 */}
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
        <h2 className="text-sm font-bold text-rose-800">위험 영역</h2>
        <p className="mt-1 text-[11px] text-rose-700">
          템플릿을 삭제하면 기관 카탈로그에서 사라집니다. 이미 가져간 행사는
          영향을 받지 않아요.
        </p>
        <form action={deleteTemplate} className="mt-3">
          <button
            type="submit"
            className="rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            🗑️ 이 템플릿 삭제
          </button>
        </form>
      </section>
    </div>
  );
}

function formatOffset(min: number): string {
  const sign = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}분`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}분`;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-[#2D5A3D]">
        {label}
      </label>
      {children}
    </div>
  );
}

function ItemPicker({
  title,
  itemType,
  options,
  action,
  requiredFeature,
  featureMap,
}: {
  title: string;
  itemType: string;
  options: { id: string; label: string }[];
  action: (fd: FormData) => void;
  requiredFeature: string | null;
  featureMap: Record<string, boolean>;
}) {
  const blocked = !!requiredFeature && !featureMap[requiredFeature];
  return (
    <form
      action={action}
      className={`rounded-2xl border p-3 ${
        blocked
          ? "border-dashed border-[#E5DDD0] bg-[#FFF8F0]"
          : "border-[#D4E4BC] bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-[#2D5A3D]">{title}</h3>
        {blocked && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            🔒 {requiredFeature} 미보유
          </span>
        )}
      </div>
      <input type="hidden" name="item_type" value={itemType} />
      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
        <select
          name="item_id"
          disabled={blocked || options.length === 0}
          className="rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none disabled:bg-slate-100"
        >
          <option value="">
            {options.length === 0
              ? "(추가 가능한 항목 없음)"
              : "— 선택 —"}
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={blocked || options.length === 0}
          className="rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-semibold text-white hover:bg-[#3A7A52] disabled:bg-slate-400"
        >
          추가
        </button>
      </div>
    </form>
  );
}

function FmSessionPicker({
  action,
  hasFm,
}: {
  action: (fd: FormData) => void;
  hasFm: boolean;
}) {
  return (
    <form
      action={action}
      className={`rounded-2xl border p-3 ${
        hasFm
          ? "border-[#D4E4BC] bg-white"
          : "border-dashed border-[#E5DDD0] bg-[#FFF8F0]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-[#2D5A3D]">
          📻 토리FM 세션 추가
        </h3>
        {!hasFm && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            🔒 TORI_FM 미보유
          </span>
        )}
      </div>
      <p className="mt-1 text-[10px] text-[#8B7F75]">
        세션 이름·노트만 입력. 가져오기 시 행사에 빈 세션 1개가 자동 생성돼요.
      </p>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <input
          name="fm_name"
          required
          maxLength={100}
          disabled={!hasFm}
          placeholder="예: 점심 라디오, 미션 출발 방송"
          className="rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none disabled:bg-slate-100"
        />
        <input
          name="fm_note"
          maxLength={1000}
          disabled={!hasFm}
          placeholder="진행 노트 (선택)"
          className="rounded-xl border border-[#E5DDD0] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none disabled:bg-slate-100"
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={!hasFm}
          className="rounded-xl bg-[#2D5A3D] px-3 py-2 text-xs font-semibold text-white hover:bg-[#3A7A52] disabled:bg-slate-400"
        >
          ➕ FM 세션 추가
        </button>
      </div>
    </form>
  );
}
