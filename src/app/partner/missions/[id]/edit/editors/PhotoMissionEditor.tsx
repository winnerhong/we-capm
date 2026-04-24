"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MISSION_KIND_META,
  type PartnerMissionRow,
  type PhotoMissionConfig,
  type MissionVisibility,
} from "@/lib/missions/types";
import {
  updatePartnerMissionAction,
  publishMissionAction,
  archiveMissionAction,
  deleteMissionAction,
} from "../../../actions";
import { AcornIcon } from "@/components/acorn-icon";

type Props = {
  mission: PartnerMissionRow;
};

const VISIBILITY_OPTIONS: Array<{
  value: MissionVisibility;
  label: string;
  hint: string;
}> = [
  {
    value: "DRAFT",
    label: "🔒 비공개 (초안)",
    hint: "지사 내부에서만 보입니다.",
  },
  {
    value: "ALL",
    label: "🌍 전체 공개",
    hint: "모든 기관이 미션 풀에서 볼 수 있어요.",
  },
  {
    value: "SELECTED",
    label: "🎯 선택 공개",
    hint: "지정한 기관에게만 노출됩니다.",
  },
  { value: "ARCHIVED", label: "📦 보관", hint: "목록에서 숨김 처리됩니다." },
];

function parsePhotoConfig(raw: Record<string, unknown>): PhotoMissionConfig {
  const min_photos =
    typeof raw.min_photos === "number" && raw.min_photos > 0
      ? Math.min(5, Math.max(1, Math.floor(raw.min_photos)))
      : 1;
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  const require_caption = Boolean(raw.require_caption);
  let geofence: PhotoMissionConfig["geofence"];
  const geo = raw.geofence as Record<string, unknown> | null | undefined;
  if (
    geo &&
    typeof geo === "object" &&
    typeof geo.lat === "number" &&
    typeof geo.lng === "number" &&
    typeof geo.radius_m === "number"
  ) {
    geofence = { lat: geo.lat, lng: geo.lng, radius_m: geo.radius_m };
  }
  return { min_photos, prompt, require_caption, geofence };
}

export function PhotoMissionEditor({ mission }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const kindMeta = MISSION_KIND_META[mission.kind];

  const initialConfig = useMemo(
    () => parsePhotoConfig((mission.config_json ?? {}) as Record<string, unknown>),
    [mission.config_json]
  );

  // 기본 정보
  const [title, setTitle] = useState(mission.title);
  const [description, setDescription] = useState(mission.description ?? "");
  const [icon, setIcon] = useState(mission.icon ?? kindMeta.icon);
  const [defaultAcorns, setDefaultAcorns] = useState(
    String(mission.default_acorns ?? 0)
  );
  const [visibility, setVisibility] = useState<MissionVisibility>(
    mission.visibility
  );

  // Photo config
  const [prompt, setPrompt] = useState(initialConfig.prompt);
  const [minPhotos, setMinPhotos] = useState(String(initialConfig.min_photos));
  const [requireCaption, setRequireCaption] = useState(
    Boolean(initialConfig.require_caption)
  );
  const [geoOn, setGeoOn] = useState(Boolean(initialConfig.geofence));
  const [geoLat, setGeoLat] = useState(
    initialConfig.geofence ? String(initialConfig.geofence.lat) : ""
  );
  const [geoLng, setGeoLng] = useState(
    initialConfig.geofence ? String(initialConfig.geofence.lng) : ""
  );
  const [geoRadius, setGeoRadius] = useState(
    initialConfig.geofence ? String(initialConfig.geofence.radius_m) : "30"
  );

  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  function markDirty() {
    setDirty(true);
    setMsg(null);
  }

  function buildConfig(): Record<string, unknown> {
    const cfg: Record<string, unknown> = {
      min_photos: Math.min(5, Math.max(1, parseInt(minPhotos, 10) || 1)),
      prompt: prompt.trim(),
      require_caption: requireCaption,
    };
    if (geoOn) {
      const lat = parseFloat(geoLat);
      const lng = parseFloat(geoLng);
      const radius = parseFloat(geoRadius);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radius)) {
        cfg.geofence = { lat, lng, radius_m: radius };
      }
    }
    return cfg;
  }

  function validate(): string | null {
    if (!title.trim()) return "제목을 입력해 주세요";
    const acornsNum = parseInt(defaultAcorns, 10);
    if (Number.isNaN(acornsNum) || acornsNum < 0 || acornsNum > 20) {
      return "기본 도토리는 0~20 사이 숫자여야 해요";
    }
    if (!prompt.trim()) return "미션 안내 문구를 입력해 주세요";
    return null;
  }

  function onSave(publish = false) {
    const err = validate();
    if (err) {
      setMsg({ kind: "error", text: err });
      return;
    }
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("description", description.trim());
    fd.set("icon", icon.trim());
    fd.set("default_acorns", defaultAcorns);
    fd.set("visibility", visibility);
    fd.set("config_json", JSON.stringify(buildConfig()));

    startTransition(async () => {
      try {
        await updatePartnerMissionAction(mission.id, fd);
        if (publish) {
          await publishMissionAction(mission.id);
          setMsg({ kind: "ok", text: "게시했어요! 기관에서 바로 볼 수 있어요." });
        } else {
          setMsg({ kind: "ok", text: "저장했어요." });
        }
        setDirty(false);
        router.refresh();
      } catch (e) {
        const text = e instanceof Error ? e.message : "저장 실패";
        setMsg({ kind: "error", text });
      }
    });
  }

  function onArchive() {
    if (!window.confirm("이 미션을 보관할까요? 목록에서 숨김 처리됩니다.")) return;
    startTransition(async () => {
      try {
        await archiveMissionAction(mission.id);
        setMsg({ kind: "ok", text: "보관했어요." });
        router.refresh();
      } catch (e) {
        setMsg({
          kind: "error",
          text: e instanceof Error ? e.message : "보관 실패",
        });
      }
    });
  }

  function onDelete() {
    if (
      !window.confirm(
        "정말 삭제할까요? 사용 중인 미션은 삭제할 수 없고, 대신 보관됩니다."
      )
    )
      return;
    startTransition(async () => {
      try {
        await deleteMissionAction(mission.id);
      } catch (e) {
        setMsg({
          kind: "error",
          text: e instanceof Error ? e.message : "삭제 실패",
        });
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
      {/* Left: form */}
      <div className="space-y-6">
        {/* Dirty/msg banner */}
        {(dirty || msg) && (
          <div
            className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
              msg?.kind === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : msg?.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
            role="status"
          >
            {msg
              ? msg.text
              : "* 변경사항이 있어요. 저장을 눌러주세요."}
          </div>
        )}

        {/* 기본정보 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>📝</span>
            <span>기본 정보</span>
          </h2>
          <div className="space-y-4">
            <Field label="제목" htmlFor="title" required>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  markDirty();
                }}
                placeholder="예) 가족 사진 찍기"
                className={inputCls}
                autoComplete="off"
                required
              />
            </Field>

            <Field label="설명 (선택)" htmlFor="description">
              <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  markDirty();
                }}
                placeholder="어떤 미션인지 기관 담당자에게 알려주세요"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="아이콘 (이모지)" htmlFor="icon">
                <input
                  id="icon"
                  type="text"
                  value={icon}
                  onChange={(e) => {
                    setIcon(e.target.value);
                    markDirty();
                  }}
                  placeholder="📸"
                  maxLength={4}
                  className={inputCls}
                />
              </Field>
              <Field label="기본 도토리 (0~20)" htmlFor="default_acorns">
                <input
                  id="default_acorns"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20}
                  value={defaultAcorns}
                  onChange={(e) => {
                    setDefaultAcorns(e.target.value);
                    markDirty();
                  }}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="공개 범위" htmlFor="visibility">
              <select
                id="visibility"
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.target.value as MissionVisibility);
                  markDirty();
                }}
                className={inputCls}
              >
                {VISIBILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                {
                  VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.hint
                }
              </p>
            </Field>
          </div>
        </section>

        {/* Photo config */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>📸</span>
            <span>사진 미션 설정</span>
          </h2>
          <div className="space-y-4">
            <Field label="안내 문구" htmlFor="prompt" required>
              <textarea
                id="prompt"
                rows={3}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  markDirty();
                }}
                placeholder="예) 가족 사진을 찍어주세요 📸"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="최소 사진 장수 (1~5)" htmlFor="min_photos">
                <input
                  id="min_photos"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={5}
                  value={minPhotos}
                  onChange={(e) => {
                    setMinPhotos(e.target.value);
                    markDirty();
                  }}
                  className={inputCls}
                />
              </Field>
              <Field label="캡션 필수" htmlFor="require_caption">
                <label className="mt-2 inline-flex items-center gap-2 text-sm text-[#2C2C2C]">
                  <input
                    id="require_caption"
                    type="checkbox"
                    checked={requireCaption}
                    onChange={(e) => {
                      setRequireCaption(e.target.checked);
                      markDirty();
                    }}
                    className="h-4 w-4 rounded border-[#D4E4BC] text-[#2D5A3D] focus:ring-[#2D5A3D]"
                  />
                  <span>캡션(설명)을 반드시 받기</span>
                </label>
              </Field>
            </div>

            <div>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#2D5A3D]">
                <input
                  type="checkbox"
                  checked={geoOn}
                  onChange={(e) => {
                    setGeoOn(e.target.checked);
                    markDirty();
                  }}
                  className="h-4 w-4 rounded border-[#D4E4BC] text-[#2D5A3D] focus:ring-[#2D5A3D]"
                />
                <span>📍 지오펜스 사용</span>
              </label>
              {geoOn && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Field label="위도" htmlFor="geo_lat">
                    <input
                      id="geo_lat"
                      type="number"
                      step="0.000001"
                      value={geoLat}
                      onChange={(e) => {
                        setGeoLat(e.target.value);
                        markDirty();
                      }}
                      placeholder="37.5665"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="경도" htmlFor="geo_lng">
                    <input
                      id="geo_lng"
                      type="number"
                      step="0.000001"
                      value={geoLng}
                      onChange={(e) => {
                        setGeoLng(e.target.value);
                        markDirty();
                      }}
                      placeholder="126.9780"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="반경(m)" htmlFor="geo_radius">
                    <input
                      id="geo_radius"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={geoRadius}
                      onChange={(e) => {
                        setGeoRadius(e.target.value);
                        markDirty();
                      }}
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Right: preview + actions */}
      <aside className="space-y-4">
        <div className="sticky top-4 space-y-4">
          <section className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-[#8B6F47]">
              👀 기관이 복사해 쓸 때 이렇게 보여요
            </p>
            <div className="mt-3 rounded-xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden>
                  {icon || kindMeta.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#2C2C2C]">
                    {title || "(제목 없음)"}
                  </p>
                  <p className="text-[10px] text-[#6B6560]">
                    📸 사진 미션 · <AcornIcon size={12} /> +{defaultAcorns || 0}
                  </p>
                </div>
              </div>
              {prompt && (
                <p className="mt-3 rounded-lg bg-[#F5F1E8] p-2 text-xs text-[#2C2C2C]">
                  {prompt}
                </p>
              )}
              <ul className="mt-2 space-y-0.5 text-[11px] text-[#6B6560]">
                <li>· 사진 최소 {minPhotos || 1}장</li>
                {requireCaption && <li>· 캡션 입력 필수</li>}
                {geoOn && <li>· 현장 위치 확인 필요</li>}
              </ul>
            </div>
          </section>

          {/* Actions */}
          <section className="sticky top-4 rounded-2xl border border-[#D4E4BC] bg-white/95 p-4 shadow-sm backdrop-blur">
            {msg && (
              <div
                role="status"
                className={`mb-3 rounded-xl border-2 px-3 py-2.5 text-center text-sm font-bold ${
                  msg.kind === "error"
                    ? "border-rose-400 bg-rose-50 text-rose-800"
                    : "border-emerald-400 bg-emerald-50 text-emerald-800"
                }`}
              >
                {msg.kind === "ok" ? "✅ " : "⚠️ "}
                {msg.text}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSave(false)}
                disabled={isPending}
                className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-50"
              >
                {isPending ? "💾 저장 중..." : "💾 저장(초안)"}
              </button>
              <button
                type="button"
                onClick={() => onSave(true)}
                disabled={isPending}
                className="rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-[#234a30] hover:to-[#2D5A3D] disabled:opacity-50"
              >
                {isPending ? "🚀 게시 중..." : "🚀 저장 & 게시"}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onArchive}
                disabled={isPending}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                📦 보관
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={isPending}
                className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
              >
                🗑 삭제
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
      >
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      {children}
    </div>
  );
}
