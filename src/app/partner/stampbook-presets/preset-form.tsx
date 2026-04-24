"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MISSION_KIND_META,
  PRESET_CATEGORY_OPTIONS,
  type MissionKind,
  type PartnerMissionRow,
  type PresetVisibility,
} from "@/lib/missions/types";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compress";

const COVER_BUCKET = "preset-covers";
const MAX_CATEGORIES = 3;

type Mode = "create" | "edit";

interface PresetFormProps {
  mode: Mode;
  initial?: {
    id: string;
    name: string;
    description: string | null;
    slot_count: number;
    mission_ids: string[];
    cover_image_url: string | null;
    recommended_for_age: string | null;
    is_published: boolean;
    visibility: PresetVisibility;
    selected_org_ids: string[];
    category?: string[];
  };
  missions: Array<
    Pick<PartnerMissionRow, "id" | "title" | "kind" | "icon" | "status">
  >;
  /** 이 지사에 속한 기관 — SELECTED_ORGS 체크리스트용 */
  orgs: Array<{ id: string; name: string }>;
  onSubmit: (formData: FormData) => Promise<void>;
  onPublish?: () => Promise<void>;
  onUnpublish?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

type QuickPreset = {
  key: "TEMPLATE_5" | "TEMPLATE_10" | "TEMPLATE_15";
  label: string;
  icon: string;
  slot_count: number;
  // 구성 우선순위 (가능하면 앞쪽부터 채움)
  recipe: MissionKind[];
};

const QUICK_PRESETS: QuickPreset[] = [
  {
    key: "TEMPLATE_5",
    label: "5칸 입문형",
    icon: "🌱",
    slot_count: 5,
    recipe: ["PHOTO", "QR_QUIZ", "PHOTO_APPROVAL", "PHOTO", "FINAL_REWARD"],
  },
  {
    key: "TEMPLATE_10",
    label: "10칸 정석형",
    icon: "🌿",
    slot_count: 10,
    recipe: [
      "PHOTO",
      "QR_QUIZ",
      "PHOTO_APPROVAL",
      "COOP",
      "RADIO",
      "PHOTO",
      "QR_QUIZ",
      "TREASURE",
      "BROADCAST",
      "FINAL_REWARD",
    ],
  },
  {
    key: "TEMPLATE_15",
    label: "15칸 풀코스",
    icon: "🌲",
    slot_count: 15,
    recipe: [
      "PHOTO",
      "QR_QUIZ",
      "PHOTO_APPROVAL",
      "COOP",
      "RADIO",
      "PHOTO",
      "QR_QUIZ",
      "PHOTO_APPROVAL",
      "TREASURE",
      "PHOTO",
      "QR_QUIZ",
      "COOP",
      "BROADCAST",
      "RADIO",
      "FINAL_REWARD",
    ],
  },
];

export function PresetForm({
  mode,
  initial,
  missions,
  orgs,
  onSubmit,
  onPublish,
  onUnpublish,
  onDelete,
}: PresetFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingAction, startAction] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [slotCount, setSlotCount] = useState<number>(
    initial?.slot_count ?? 10
  );
  const [recommendedAge, setRecommendedAge] = useState(
    initial?.recommended_for_age ?? ""
  );
  const [coverUrl, setCoverUrl] = useState(initial?.cover_image_url ?? "");
  const [missionIds, setMissionIds] = useState<string[]>(
    initial?.mission_ids ?? []
  );
  const [visibility, setVisibility] = useState<PresetVisibility>(
    initial?.visibility ?? "PRIVATE"
  );
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(
    () => new Set(initial?.selected_org_ids ?? [])
  );
  const [orgQuery, setOrgQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pickValue, setPickValue] = useState<string>("");

  // ── 추가된 state ────────────────────────────────────────────────
  const [categories, setCategories] = useState<string[]>(
    initial?.category ?? []
  );
  const [uploading, setUploading] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // 미션 lookup — 게시된 미션만 기본 사용
  const missionMap = useMemo(() => {
    const m = new Map<
      string,
      Pick<PartnerMissionRow, "id" | "title" | "kind" | "icon" | "status">
    >();
    for (const row of missions) m.set(row.id, row);
    return m;
  }, [missions]);

  const publishedMissions = useMemo(
    () => missions.filter((m) => m.status === "PUBLISHED"),
    [missions]
  );

  const availableForPick = useMemo(() => {
    const used = new Set(missionIds);
    return publishedMissions.filter((m) => !used.has(m.id));
  }, [publishedMissions, missionIds]);

  function handleAdd() {
    if (!pickValue) return;
    if (missionIds.includes(pickValue)) return;
    if (missionIds.length >= slotCount) {
      setError(`칸 수(${slotCount}칸)를 넘을 수 없어요`);
      return;
    }
    setMissionIds((prev) => [...prev, pickValue]);
    setPickValue("");
    setError(null);
  }

  function handleRemove(id: string) {
    setMissionIds((prev) => prev.filter((m) => m !== id));
  }

  function handleMove(id: string, direction: "UP" | "DOWN") {
    setMissionIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const next = [...prev];
      const target = direction === "UP" ? idx - 1 : idx + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  // ── 카테고리 multi-select ─────────────────────────────────────
  function toggleCategory(value: string) {
    setCategories((prev) => {
      if (prev.includes(value)) {
        return prev.filter((v) => v !== value);
      }
      if (prev.length >= MAX_CATEGORIES) {
        setError(`카테고리는 최대 ${MAX_CATEGORIES}개까지 선택할 수 있어요`);
        return prev;
      }
      setError(null);
      return [...prev, value];
    });
  }

  // ── 커버 이미지 업로드 ────────────────────────────────────────
  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const compressed = await compressImage(file, { maxKb: 500 });
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `covers/${Date.now()}-${rand}.jpg`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(COVER_BUCKET)
        .upload(path, compressed, {
          contentType: compressed.type,
          upsert: false,
        });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(path);
      setCoverUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function removeCover() {
    setCoverUrl("");
  }

  // ── 드래그 앤 드롭 순서 변경 ──────────────────────────────────
  function onDragStart(e: React.DragEvent, idx: number) {
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragEnter(idx: number) {
    setDragOverIdx(idx);
  }

  function onDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    if (draggingIdx === null || draggingIdx === dropIdx) {
      setDraggingIdx(null);
      setDragOverIdx(null);
      return;
    }
    setMissionIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(draggingIdx, 1);
      next.splice(dropIdx, 0, moved);
      return next;
    });
    setDraggingIdx(null);
    setDragOverIdx(null);
  }

  function onDragEnd() {
    setDraggingIdx(null);
    setDragOverIdx(null);
  }

  function handleApplyQuickPreset(qp: QuickPreset) {
    // 현재 사용 가능한(=PUBLISHED) 미션에서 recipe kind 순서대로 매칭
    const picked: string[] = [];
    const remaining = [...publishedMissions];
    for (const kind of qp.recipe) {
      const idx = remaining.findIndex((m) => m.kind === kind);
      if (idx >= 0) {
        picked.push(remaining[idx].id);
        remaining.splice(idx, 1);
      }
    }
    // 부족하면 남은 아무 미션으로 채움 (단, slot_count 이하)
    while (picked.length < qp.slot_count && remaining.length > 0) {
      const next = remaining.shift();
      if (next) picked.push(next.id);
    }
    setSlotCount(qp.slot_count);
    setMissionIds(picked.slice(0, qp.slot_count));
    setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    // 순서 있는 mission_ids 를 JSON 으로 보냄 (parseMissionIds 가 이 필드를 우선 사용)
    formData.set("mission_ids_json", JSON.stringify(missionIds));
    formData.set("visibility", visibility);
    formData.set(
      "selected_org_ids_json",
      JSON.stringify(Array.from(selectedOrgIds))
    );
    startTransition(async () => {
      try {
        await onSubmit(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "저장 실패");
      }
    });
  }

  function toggleOrg(id: string) {
    setSelectedOrgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllOrgs() {
    setSelectedOrgIds(new Set(orgs.map((o) => o.id)));
  }
  function clearOrgs() {
    setSelectedOrgIds(new Set());
  }

  const filteredOrgs =
    orgQuery.trim() === ""
      ? orgs
      : orgs.filter((o) => o.name.includes(orgQuery.trim()));

  function handlePublishToggle() {
    setError(null);
    startAction(async () => {
      try {
        if (initial?.is_published) {
          if (onUnpublish) await onUnpublish();
        } else {
          if (onPublish) await onPublish();
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "상태 변경 실패");
      }
    });
  }

  function handleDelete() {
    if (!confirm("이 프리셋을 삭제할까요? 되돌릴 수 없어요.")) return;
    setError(null);
    startAction(async () => {
      try {
        if (onDelete) await onDelete();
      } catch (err) {
        setError(err instanceof Error ? err.message : "삭제 실패");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          ⚠️ {error}
        </div>
      )}

      {/* Quick preset chips */}
      <section className="rounded-2xl border border-[#E5D3B8] bg-[#FFF8F0] p-4">
        <p className="text-xs font-bold text-[#8B6F47]">
          ✨ 템플릿에서 자동으로 채우기
        </p>
        <p className="mt-1 text-[11px] text-[#6B6560]">
          게시된 미션 중에서 추천 조합으로 자동 배치해요. 이후 자유롭게 편집할
          수 있어요.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_PRESETS.map((qp) => (
            <button
              key={qp.key}
              type="button"
              onClick={() => handleApplyQuickPreset(qp)}
              className="inline-flex items-center gap-1 rounded-full border border-[#E5D3B8] bg-white px-3 py-1.5 text-xs font-semibold text-[#8B6F47] transition hover:border-[#2D5A3D] hover:bg-[#F5F1E8] hover:text-[#2D5A3D]"
            >
              <span aria-hidden>{qp.icon}</span>
              <span>{qp.label} 채우기</span>
            </button>
          ))}
        </div>
      </section>

      {/* Basic info */}
      <section className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#2D5A3D]">기본 정보</h2>

        <div>
          <label
            htmlFor="preset-name"
            className="mb-1 block text-xs font-semibold text-[#6B6560]"
          >
            프리셋 이름 *
          </label>
          <input
            id="preset-name"
            name="name"
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 🌿 가족 입문 10칸 코스"
            className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>

        <div>
          <label
            htmlFor="preset-description"
            className="mb-1 block text-xs font-semibold text-[#6B6560]"
          >
            설명
          </label>
          <textarea
            id="preset-description"
            name="description"
            maxLength={500}
            rows={3}
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="이 프리셋의 추천 사용 상황, 난이도 등"
            className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="preset-slots"
              className="mb-1 block text-xs font-semibold text-[#6B6560]"
            >
              칸 수 * (1~30)
            </label>
            <input
              id="preset-slots"
              name="slot_count"
              type="number"
              min={1}
              max={30}
              required
              inputMode="numeric"
              value={slotCount}
              onChange={(e) => setSlotCount(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
            />
          </div>

          <div>
            <label
              htmlFor="preset-age"
              className="mb-1 block text-xs font-semibold text-[#6B6560]"
            >
              추천 연령 (선택)
            </label>
            <input
              id="preset-age"
              name="recommended_for_age"
              type="text"
              maxLength={50}
              value={recommendedAge ?? ""}
              onChange={(e) => setRecommendedAge(e.target.value)}
              placeholder="예: 5~9세 · 초등 저학년"
              className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
            />
          </div>
        </div>

        {/* 커버 이미지 업로드 */}
        <div>
          <span className="mb-1 block text-xs font-semibold text-[#6B6560]">
            🖼 커버 이미지 (선택)
          </span>
          {coverUrl ? (
            <div className="relative inline-block w-full max-w-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt="커버 미리보기"
                className="h-32 w-full rounded-xl object-cover shadow-sm"
              />
              <button
                type="button"
                onClick={removeCover}
                className="absolute top-2 right-2 rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-rose-600 shadow hover:bg-white"
                aria-label="커버 이미지 제거"
              >
                ✕ 제거
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-8 text-center transition hover:border-[#2D5A3D] hover:bg-[#F5F1E8]">
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden"
                disabled={uploading}
              />
              <span className="text-3xl" aria-hidden>
                🖼
              </span>
              <span className="mt-2 text-sm font-semibold text-[#2D5A3D]">
                {uploading ? "업로드 중..." : "커버 이미지 선택"}
              </span>
              <span className="mt-1 text-[11px] text-[#6B6560]">
                PNG / JPG · 500KB 이하 자동 압축
              </span>
            </label>
          )}
          <input type="hidden" name="cover_image_url" value={coverUrl} />
        </div>

        {/* 카테고리 태깅 (최대 3개) */}
        <fieldset>
          <legend className="mb-2 block text-xs font-semibold text-[#6B6560]">
            📚 카테고리 (최대 {MAX_CATEGORIES}개)
          </legend>
          <div className="flex flex-wrap gap-2">
            {PRESET_CATEGORY_OPTIONS.map((c) => {
              const selected = categories.includes(c.value);
              const reachedLimit =
                !selected && categories.length >= MAX_CATEGORIES;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggleCategory(c.value)}
                  disabled={reachedLimit}
                  aria-pressed={selected}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    selected
                      ? "border-[#2D5A3D] bg-[#2D5A3D] text-white shadow-sm"
                      : reachedLimit
                        ? "cursor-not-allowed border-[#E5D3B8] bg-white text-[#B8AFA5] opacity-60"
                        : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
                  }`}
                >
                  <span aria-hidden>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
          {/* hidden inputs — formData.getAll("category") 로 수집 */}
          {categories.map((c) => (
            <input key={c} type="hidden" name="category" value={c} />
          ))}
          {categories.length > 0 && (
            <p className="mt-2 text-[11px] text-[#8B6F47]">
              선택됨: <strong>{categories.length}/{MAX_CATEGORIES}</strong>
            </p>
          )}
        </fieldset>
      </section>

      {/* Mission picker */}
      <section className="space-y-4 rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#2D5A3D]">담긴 미션</h2>
            <p className="mt-0.5 text-[11px] text-[#6B6560]">
              위 → 아래 순서대로 스탬프북에 배치돼요. ⋮⋮ 아이콘을 잡고
              끌어서 순서를 바꿀 수 있어요. 현재{" "}
              <strong className="text-[#2D5A3D]">
                {missionIds.length}/{slotCount}칸
              </strong>{" "}
              사용 중.
            </p>
          </div>
        </div>

        {/* Add row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <select
            aria-label="미션 선택"
            value={pickValue}
            onChange={(e) => setPickValue(e.target.value)}
            className="flex-1 rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          >
            <option value="">— 미션을 선택하세요 —</option>
            {availableForPick.length === 0 ? (
              <option disabled>추가할 수 있는 게시 미션이 없어요</option>
            ) : (
              availableForPick.map((m) => {
                const meta = MISSION_KIND_META[m.kind];
                return (
                  <option key={m.id} value={m.id}>
                    {m.icon || meta.icon} [{meta.label}] {m.title}
                  </option>
                );
              })
            )}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!pickValue || missionIds.length >= slotCount}
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#234a30] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden>➕</span>
            <span>담기</span>
          </button>
        </div>

        {/* Mission list */}
        {missionIds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-6 text-center text-xs text-[#6B6560]">
            아직 담긴 미션이 없어요. 위 드롭다운에서 선택하거나, 상단의
            자동채우기 템플릿을 눌러 보세요.
          </div>
        ) : (
          <ol className="space-y-2">
            {missionIds.map((mid, idx) => {
              const m = missionMap.get(mid);
              const meta = m ? MISSION_KIND_META[m.kind] : null;
              const isDragging = draggingIdx === idx;
              const isDragOver = dragOverIdx === idx && draggingIdx !== idx;
              return (
                <li
                  key={mid}
                  draggable
                  onDragStart={(e) => onDragStart(e, idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={() => onDragEnter(idx)}
                  onDrop={(e) => onDrop(e, idx)}
                  onDragEnd={onDragEnd}
                  className={`flex cursor-move items-center gap-3 rounded-xl border bg-[#FFF8F0] p-3 transition ${
                    isDragging
                      ? "border-[#D4E4BC] opacity-40"
                      : isDragOver
                        ? "border-[#2D5A3D] ring-2 ring-[#2D5A3D]/30"
                        : "border-[#D4E4BC]"
                  }`}
                >
                  <span
                    className="flex-shrink-0 select-none text-sm text-[#8B7F75]"
                    aria-hidden
                    title="드래그해서 순서 변경"
                  >
                    ⋮⋮
                  </span>
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#2D5A3D] text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-xl"
                    aria-hidden
                  >
                    {m?.icon || meta?.icon || "🎯"}
                  </span>
                  <div className="min-w-0 flex-1">
                    {meta && (
                      <p className="text-[10px] font-semibold text-[#8B6F47]">
                        {meta.label}
                      </p>
                    )}
                    <p className="truncate text-sm font-semibold text-[#2C2C2C]">
                      {m?.title ?? "(삭제된 미션)"}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMove(mid, "UP")}
                      disabled={idx === 0}
                      aria-label="위로"
                      className="rounded-lg border border-[#D4E4BC] bg-white p-1.5 text-xs transition hover:bg-[#E8F0E4] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(mid, "DOWN")}
                      disabled={idx === missionIds.length - 1}
                      aria-label="아래로"
                      className="rounded-lg border border-[#D4E4BC] bg-white p-1.5 text-xs transition hover:bg-[#E8F0E4] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(mid)}
                      aria-label="제거"
                      className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-xs text-rose-700 transition hover:bg-rose-100"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* 공개 설정 (visibility + grants) */}
      <section className="space-y-3 rounded-2xl border border-[#D4E4BC] bg-white p-5">
        <div>
          <h2 className="text-sm font-bold text-[#2D5A3D]">👥 기관 공유 설정</h2>
          <p className="mt-0.5 text-[11px] text-[#6B6560]">
            이 프리셋을 어느 기관이 가져다 쓸 수 있는지 선택하세요.{" "}
            <strong className="text-[#2D5A3D]">공개</strong>{" "}
            상태일 때만 실제로 기관에 노출됩니다.
          </p>
        </div>

        <div className="space-y-1.5">
          <VisibilityOption
            value="PRIVATE"
            current={visibility}
            onSelect={setVisibility}
            icon="🔒"
            title="비공개"
            desc="나만 관리 (기관에 노출 안 됨)"
          />
          <VisibilityOption
            value="ALL_ORGS"
            current={visibility}
            onSelect={setVisibility}
            icon="🌍"
            title="모든 기관에 공개"
            desc="내 지사 산하 모든 기관이 사용 가능"
          />
          <VisibilityOption
            value="SELECTED_ORGS"
            current={visibility}
            onSelect={setVisibility}
            icon="👥"
            title="선택한 기관만"
            desc={
              visibility === "SELECTED_ORGS"
                ? `${selectedOrgIds.size}/${orgs.length}개 기관 선택됨`
                : "아래 체크리스트에서 기관을 고를 수 있어요"
            }
          />
        </div>

        {visibility === "SELECTED_ORGS" && (
          <div className="space-y-2 rounded-xl border border-[#E5D3B8] bg-[#FFF8F0] p-3">
            {orgs.length === 0 ? (
              <p className="text-xs text-[#8B6F47]">
                이 지사에 등록된 기관이 없어요. 먼저{" "}
                <a
                  href="/partner/customers/org"
                  className="font-semibold underline"
                >
                  기관 고객
                </a>
                을 추가해 주세요.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={orgQuery}
                    onChange={(e) => setOrgQuery(e.target.value)}
                    placeholder="🔍 기관 검색"
                    className="flex-1 rounded-lg border border-[#E5D3B8] bg-white px-3 py-1.5 text-xs focus:border-[#2D5A3D] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={selectAllOrgs}
                    className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4]"
                  >
                    전체 선택
                  </button>
                  <button
                    type="button"
                    onClick={clearOrgs}
                    className="rounded-lg border border-[#D4E4BC] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#8B7F75] hover:bg-zinc-50"
                  >
                    해제
                  </button>
                </div>

                <ul className="max-h-64 space-y-1 overflow-y-auto">
                  {filteredOrgs.length === 0 ? (
                    <li className="py-4 text-center text-[11px] text-[#8B7F75]">
                      검색 결과가 없어요
                    </li>
                  ) : (
                    filteredOrgs.map((o) => {
                      const checked = selectedOrgIds.has(o.id);
                      return (
                        <li key={o.id}>
                          <label
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition ${
                              checked
                                ? "border-[#2D5A3D] bg-[#E8F0E4] text-[#2D5A3D]"
                                : "border-[#E5D3B8] bg-white text-[#6B6560] hover:bg-[#FAE7D0]/40"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleOrg(o.id)}
                              className="h-4 w-4 accent-[#2D5A3D]"
                            />
                            <span className="font-semibold">{o.name}</span>
                          </label>
                        </li>
                      );
                    })
                  )}
                </ul>

                <p className="text-[10px] text-[#8B6F47]">
                  선택한 <strong>{selectedOrgIds.size}개 기관</strong>만 이
                  프리셋을 쓸 수 있어요
                </p>
              </>
            )}
          </div>
        )}
      </section>

      {/* Submit + edit mode extra actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#234a30] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden>💾</span>
            <span>{pending ? "저장 중..." : mode === "create" ? "만들기" : "저장"}</span>
          </button>

          {mode === "edit" && (onPublish || onUnpublish) && (
            <button
              type="button"
              onClick={handlePublishToggle}
              disabled={pendingAction}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                initial?.is_published
                  ? "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  : "bg-violet-600 text-white hover:bg-violet-700"
              }`}
            >
              {initial?.is_published ? (
                <>
                  <span aria-hidden>🔒</span>
                  <span>비공개로 전환</span>
                </>
              ) : (
                <>
                  <span aria-hidden>🌍</span>
                  <span>공개하기</span>
                </>
              )}
            </button>
          )}
        </div>

        {mode === "edit" && onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pendingAction}
            className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden>🗑</span>
            <span>삭제</span>
          </button>
        )}
      </div>
    </form>
  );
}

function VisibilityOption({
  value,
  current,
  onSelect,
  icon,
  title,
  desc,
}: {
  value: PresetVisibility;
  current: PresetVisibility;
  onSelect: (v: PresetVisibility) => void;
  icon: string;
  title: string;
  desc: string;
}) {
  const selected = current === value;
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
        selected
          ? "border-[#2D5A3D] bg-[#E8F0E4]"
          : "border-[#D4E4BC] bg-white hover:bg-[#F5F1E8]"
      }`}
    >
      <input
        type="radio"
        name="visibility_radio"
        value={value}
        checked={selected}
        onChange={() => onSelect(value)}
        className="mt-0.5 h-4 w-4 accent-[#2D5A3D]"
      />
      <span className="mt-0.5 text-lg leading-none" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-bold ${
            selected ? "text-[#2D5A3D]" : "text-[#3D3A36]"
          }`}
        >
          {title}
        </p>
        <p className="mt-0.5 text-[11px] text-[#6B6560]">{desc}</p>
      </div>
    </label>
  );
}
