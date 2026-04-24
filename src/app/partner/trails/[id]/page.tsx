import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  DIFFICULTY_META,
  STATUS_META,
  MISSION_TYPE_META,
  type TrailRow,
  type TrailStopRow,
  type TrailDifficulty,
  type TrailStatus,
  type MissionType,
} from "@/lib/trails/types";
import { updateTrailAction } from "../actions";
import { TrailActionButtons } from "./action-buttons";
import { AddStopForm } from "./add-stop-form";
import { StopRowActions } from "./stop-row-actions";
import { ImageUploader } from "@/components/image-uploader";
import { MultiImageUploader } from "@/components/multi-image-uploader";
import { TrailVisibilitySection } from "./trail-visibility-section";
import type { TrailOrgOption } from "./trail-assignments-picker";
import { DifficultyPicker, type CustomDifficulty } from "../difficulty-picker";

export const dynamic = "force-dynamic";

const DIFFICULTY_STYLE: Record<TrailDifficulty, string> = {
  EASY: "bg-[#F5F1E8] text-[#2D5A3D] border-[#D4E4BC]",
  MEDIUM: "bg-amber-50 text-amber-800 border-amber-200",
  HARD: "bg-rose-50 text-rose-800 border-rose-200",
};

const DIFFICULTY_DESC: Record<TrailDifficulty, string> = {
  EASY: "30분 내외 · 남녀노소 누구나",
  MEDIUM: "1시간 내외 · 가벼운 도전",
  HARD: "2시간 이상 · 체력 필요",
};

const STATUS_ICON: Record<TrailStatus, string> = {
  DRAFT: "📝",
  PUBLISHED: "🌳",
  ARCHIVED: "📦",
};

const MISSION_STYLE: Record<MissionType, string> = {
  PHOTO: "bg-sky-50 text-sky-800 border-sky-200",
  QUIZ: "bg-violet-50 text-violet-800 border-violet-200",
  LOCATION: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CHECKIN: "bg-[#F5F1E8] text-[#2D5A3D] border-[#D4E4BC]",
};

async function loadTrail(id: string): Promise<TrailRow | null> {
  const supabase = await createClient();
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: unknown | null }>;
        };
      };
    };
  };
  const { data } = await client
    .from("partner_trails")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as TrailRow | null) ?? null;
}

async function loadStops(trailId: string): Promise<TrailStopRow[]> {
  const supabase = await createClient();
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: unknown[] | null }>;
        };
      };
    };
  };
  const { data } = await client
    .from("partner_trail_stops")
    .select("*")
    .eq("trail_id", trailId)
    .order("order", { ascending: true });
  return (data ?? []) as TrailStopRow[];
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

const DIFFICULTY_KEYS: Array<"EASY" | "MEDIUM" | "HARD"> = [
  "EASY",
  "MEDIUM",
  "HARD",
];

async function loadPartnerOrgs(partnerId: string): Promise<TrailOrgOption[]> {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: TrailOrgOption[] | null; error: unknown }>;
        };
      };
    };
  };
  const { data, error } = await sb
    .from("partner_orgs")
    .select("id,org_name,org_type,org_phone,representative_phone")
    .eq("partner_id", partnerId)
    .order("org_name", { ascending: true });
  if (error) {
    console.error("[partner/trails/[id]] orgs load error", error);
    return [];
  }
  return data ?? [];
}

async function loadAssignedOrgIds(trailId: string): Promise<string[]> {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{
          data: Array<{ org_id: string }> | null;
          error: unknown;
        }>;
      };
    };
  };
  const { data, error } = await sb
    .from("partner_trail_assignments")
    .select("org_id")
    .eq("trail_id", trailId);
  if (error) {
    console.error("[partner/trails/[id]] assignments load error", error);
    return [];
  }
  return (data ?? []).map((r) => r.org_id).filter(Boolean);
}

async function loadCustomDifficulties(
  partnerId: string
): Promise<CustomDifficulty[]> {
  const supabase = await createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{ data: CustomDifficulty[] | null }>;
        };
      };
    };
  };
  const { data } = await sb
    .from("partner_trail_difficulties")
    .select("id,key,label,icon,description")
    .eq("partner_id", partnerId)
    .order("display_order", { ascending: true });
  return data ?? [];
}

export default async function TrailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const partner = await requirePartner();
  const { id } = await params;

  const trail = await loadTrail(id);
  if (!trail || trail.partner_id !== partner.id) notFound();

  const [stops, orgs, assignedOrgIds, customDifficulties] = await Promise.all([
    loadStops(id),
    loadPartnerOrgs(partner.id),
    loadAssignedOrgIds(id),
    loadCustomDifficulties(partner.id),
  ]);
  const updateBound = updateTrailAction.bind(null, id);
  const diffMeta =
    DIFFICULTY_META[trail.difficulty] ??
    (() => {
      const cd = customDifficulties.find((c) => c.key === trail.difficulty);
      return cd
        ? { label: cd.label, icon: cd.icon ?? "🌿", color: "#4A7C59" }
        : { label: trail.difficulty, icon: "🌿", color: "#4A7C59" };
    })();
  const stMeta = STATUS_META[trail.status];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <nav className="text-xs text-[#6B6560]">
        <Link href="/partner/dashboard" className="hover:underline">
          대시보드
        </Link>
        <span className="mx-1">›</span>
        <Link href="/partner/trails" className="hover:underline">
          나만의 숲길
        </Link>
        <span className="mx-1">›</span>
        <span className="font-semibold text-[#2D5A3D]">{trail.name}</span>
      </nav>

      {/* Header */}
      <section className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${DIFFICULTY_STYLE[trail.difficulty]}`}
              >
                {diffMeta.icon} {diffMeta.label}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stMeta.color}`}
              >
                {STATUS_ICON[trail.status]} {stMeta.label}
              </span>
              {trail.estimated_minutes !== null &&
                trail.estimated_minutes !== undefined && (
                  <span className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                    ⏱ {trail.estimated_minutes}분
                  </span>
                )}
              {trail.distance_km !== null &&
                trail.distance_km !== undefined && (
                  <span className="inline-flex items-center rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                    📏 {Number(trail.distance_km).toFixed(1)}km
                  </span>
                )}
            </div>
            <h1 className="mt-2 text-xl font-bold text-[#2C2C2C] md:text-2xl">
              🗺️ {trail.name}
            </h1>
            <p className="mt-1 text-xs text-[#6B6560]">
              생성 {fmtDate(trail.created_at)}
              {trail.updated_at && ` · 수정 ${fmtDate(trail.updated_at)}`}
            </p>
          </div>

          <TrailActionButtons
            trailId={trail.id}
            currentStatus={trail.status}
          />
        </div>
      </section>

      {/* Tabs / sub-links */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/partner/trails/${id}/qr`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
        >
          🎫 QR 인쇄
        </Link>
        <Link
          href={`/partner/trails/${id}/completions`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
        >
          📜 완주 기록
        </Link>
      </div>

      {/* Stats */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>📊</span>
          <span>통계</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon="📍" label="지점 수" value={trail.total_slots} />
          <StatCard icon="👀" label="조회" value={trail.view_count ?? 0} />
          <StatCard
            icon="🏆"
            label="완주"
            value={trail.completion_count ?? 0}
            highlight
          />
          <StatCard
            icon={diffMeta.icon}
            label="난이도"
            value={diffMeta.label}
          />
        </div>
      </section>

      {/* 기본 정보 수정 */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>✏️</span>
          <span>기본 정보</span>
        </h2>

        <form
          action={updateBound}
          className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm"
        >
          <div>
            <label
              htmlFor="name"
              className="text-xs font-semibold text-[#2D5A3D]"
            >
              숲길 이름 *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={trail.name}
              maxLength={60}
              className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="text-xs font-semibold text-[#2D5A3D]"
            >
              설명
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={trail.description ?? ""}
              className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
            />
          </div>

          <DifficultyPicker
            name="difficulty"
            defaultValue={trail.difficulty}
            customDifficulties={customDifficulties}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="estimated_minutes"
                className="text-xs font-semibold text-[#2D5A3D]"
              >
                예상 소요 시간 (분)
              </label>
              <input
                id="estimated_minutes"
                name="estimated_minutes"
                type="number"
                min={0}
                step={5}
                inputMode="numeric"
                defaultValue={trail.estimated_minutes ?? ""}
                className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
              />
            </div>
            <div>
              <label
                htmlFor="distance_km"
                className="text-xs font-semibold text-[#2D5A3D]"
              >
                총 거리 (km)
              </label>
              <input
                id="distance_km"
                name="distance_km"
                type="number"
                min={0}
                step={0.1}
                inputMode="decimal"
                defaultValue={
                  trail.distance_km !== null && trail.distance_km !== undefined
                    ? String(trail.distance_km)
                    : ""
                }
                className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
              />
            </div>
          </div>

          {/* 커버 + 추가 이미지 (반반 배치) */}
          <div className="grid gap-4 md:grid-cols-2">
            <ImageUploader
              name="cover_image_url"
              label="커버 이미지"
              defaultValue={trail.cover_image_url ?? ""}
              folder="trails"
              maxKb={500}
            />
            <MultiImageUploader
              name="images"
              label="추가 이미지"
              defaultValues={trail.images ?? []}
              folder="trails/gallery"
              maxKb={500}
              maxImages={10}
              hint="폴더에서 여러 장 한번에 선택 가능"
            />
          </div>

          {/* 장소 & 추가 정보 */}
          <div className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0]/50 p-3 space-y-3">
            <p className="text-xs font-semibold text-[#2D5A3D]">📍 장소 & 추가 정보</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="venue_name" className="text-xs font-semibold text-[#2D5A3D]">
                  장소명
                </label>
                <input
                  id="venue_name"
                  name="venue_name"
                  type="text"
                  maxLength={80}
                  defaultValue={trail.venue_name ?? ""}
                  placeholder="예) 가평 자라섬 숲길"
                  className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="venue_address" className="text-xs font-semibold text-[#2D5A3D]">
                  주소
                </label>
                <input
                  id="venue_address"
                  name="venue_address"
                  type="text"
                  maxLength={120}
                  defaultValue={trail.venue_address ?? ""}
                  placeholder="예) 경기도 가평군 자라섬"
                  className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="external_link" className="text-xs font-semibold text-[#2D5A3D]">
                링크
              </label>
              <input
                id="external_link"
                name="external_link"
                type="url"
                inputMode="url"
                maxLength={300}
                defaultValue={trail.external_link ?? ""}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="notes" className="text-xs font-semibold text-[#2D5A3D]">
                비고
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                maxLength={500}
                defaultValue={trail.notes ?? ""}
                placeholder="운영 시 참고사항 (내부 메모)"
                className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#4A7C59]"
            >
              💾 저장
            </button>
          </div>
        </form>
      </section>

      {/* 배포 대상 */}
      <TrailVisibilitySection
        trailId={trail.id}
        defaultVisibility={trail.visibility ?? "DRAFT"}
        orgs={orgs}
        defaultAssignedOrgIds={assignedOrgIds}
      />

      {/* 지점 관리 */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>📍</span>
            <span>지점 관리</span>
            <span className="rounded-full bg-[#F5F1E8] px-2 py-0.5 text-[10px] font-normal text-[#2D5A3D]">
              {stops.length}개
            </span>
          </h2>
        </div>

        {stops.length === 0 ? (
          <div className="mb-3 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-6 text-center">
            <div className="text-3xl">📍</div>
            <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
              아직 지점이 없어요
            </p>
            <p className="mt-0.5 text-xs text-[#6B6560]">
              아래 버튼으로 첫 지점을 추가해 보세요.
            </p>
          </div>
        ) : (
          <div className="mb-3 overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
            <div className="hidden grid-cols-[48px_1fr_120px_80px_110px_110px] items-center gap-2 border-b border-[#D4E4BC] bg-[#F5F1E8] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#6B6560] md:grid">
              <div>#</div>
              <div>이름</div>
              <div>미션</div>
              <div className="text-right">점수</div>
              <div>QR</div>
              <div className="text-right">작업</div>
            </div>
            <ul className="divide-y divide-[#E8F0E4]">
              {stops.map((s) => {
                const m = MISSION_TYPE_META[s.mission_type];
                return (
                  <li
                    key={s.id}
                    className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[48px_1fr_120px_80px_110px_110px] md:items-center"
                  >
                    <div className="text-sm font-bold text-[#2D5A3D]">
                      #{s.order}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/partner/trails/${id}/stops/${s.id}/edit`}
                        className="text-sm font-semibold text-[#2C2C2C] hover:text-[#2D5A3D] hover:underline"
                      >
                        {s.name}
                      </Link>
                      {s.location_hint && (
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-[#6B6560]">
                          📌 {s.location_hint}
                        </div>
                      )}
                    </div>
                    <div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${MISSION_STYLE[s.mission_type]}`}
                      >
                        {m.icon} {m.label}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-[#2D5A3D] md:text-right">
                      {s.reward_points}점
                    </div>
                    <div>
                      <code className="inline-flex items-center rounded-md border border-[#D4E4BC] bg-[#F5F1E8] px-1.5 py-0.5 font-mono text-[10px] text-[#6B6560]">
                        {String(s.qr_code).slice(0, 10)}…
                      </code>
                    </div>
                    <StopRowActions stopId={s.id} trailId={id} />
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <AddStopForm trailId={id} nextOrder={stops.length + 1} />
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-[#2D5A3D] bg-gradient-to-br from-[#F5F1E8] to-[#D4E4BC]"
          : "border-[#D4E4BC] bg-white"
      }`}
    >
      <div className="text-xl">{icon}</div>
      <div className="mt-1 text-[10px] font-semibold text-[#6B6560]">
        {label}
      </div>
      <div
        className={`mt-0.5 text-xl font-extrabold ${
          highlight ? "text-[#2D5A3D]" : "text-[#2C2C2C]"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
      </div>
    </div>
  );
}
