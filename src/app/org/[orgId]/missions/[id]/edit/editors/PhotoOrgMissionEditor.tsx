"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MISSION_KIND_META,
  type ApprovalMode,
  type OrgMissionRow,
  type PhotoMissionConfig,
  type UnlockRule,
} from "@/lib/missions/types";
import {
  removeMissionFromPackAction,
  updateOrgMissionAction,
} from "../../../actions";
import { DeployFields, Field, inputCls, toLocalInput } from "./common-fields";
import { AcornIcon } from "@/components/acorn-icon";

type Props = {
  mission: OrgMissionRow;
  siblings: OrgMissionRow[];
};

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

export function PhotoOrgMissionEditor({ mission, siblings }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const kindMeta = MISSION_KIND_META[mission.kind];

  const initialConfig = useMemo(
    () =>
      parsePhotoConfig(
        (mission.config_json ?? {}) as Record<string, unknown>
      ),
    [mission.config_json]
  );

  // 기본정보
  const [title, setTitle] = useState(mission.title);
  const [description, setDescription] = useState(mission.description ?? "");
  const [icon, setIcon] = useState(mission.icon ?? kindMeta.icon);
  const [acorns, setAcorns] = useState(String(mission.acorns ?? 0));

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

  // 공통 배포 필드
  const [unlockRule, setUnlockRule] = useState<UnlockRule>(mission.unlock_rule);
  const [unlockThreshold, setUnlockThreshold] = useState(
    mission.unlock_threshold != null ? String(mission.unlock_threshold) : "10"
  );
  const [unlockPreviousId, setUnlockPreviousId] = useState(
    mission.unlock_previous_id ?? ""
  );
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(
    mission.approval_mode
  );
  const [startsAt, setStartsAt] = useState(toLocalInput(mission.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(mission.ends_at));
  const [isActive, setIsActive] = useState(mission.is_active);

  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null
  );

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
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Number.isFinite(radius)
      ) {
        cfg.geofence = { lat, lng, radius_m: radius };
      }
    }
    return cfg;
  }

  function validate(): string | null {
    if (!title.trim()) return "제목을 입력해 주세요";
    const n = parseInt(acorns, 10);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      return "도토리는 0~100 사이 숫자여야 해요";
    }
    if (!prompt.trim()) return "미션 안내 문구를 입력해 주세요";
    if (unlockRule === "SEQUENTIAL" && !unlockPreviousId) {
      return "순차 해금에는 선행 미션을 지정해 주세요";
    }
    return null;
  }

  function onSave() {
    const err = validate();
    if (err) {
      setMsg({ kind: "error", text: err });
      return;
    }
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("description", description.trim());
    fd.set("icon", icon.trim());
    fd.set("acorns", acorns);
    fd.set("config_json", JSON.stringify(buildConfig()));
    fd.set("unlock_rule", unlockRule);
    if (unlockRule === "TIER_GATE") fd.set("unlock_threshold", unlockThreshold);
    if (unlockRule === "SEQUENTIAL")
      fd.set("unlock_previous_id", unlockPreviousId);
    fd.set("approval_mode", approvalMode);
    fd.set("starts_at", startsAt);
    fd.set("ends_at", endsAt);
    fd.set("is_active", isActive ? "true" : "false");

    startTransition(async () => {
      try {
        await updateOrgMissionAction(mission.id, fd);
        setMsg({ kind: "ok", text: "저장했어요." });
        setDirty(false);
        router.refresh();
      } catch (e) {
        setMsg({
          kind: "error",
          text: e instanceof Error ? e.message : "저장 실패",
        });
      }
    });
  }

  function onRemove() {
    if (
      !window.confirm(
        "이 미션을 스탬프북에서 제거할까요? 편집 내용도 모두 사라집니다."
      )
    )
      return;
    startTransition(async () => {
      try {
        await removeMissionFromPackAction(mission.id);
      } catch (e) {
        setMsg({
          kind: "error",
          text: e instanceof Error ? e.message : "삭제 실패",
        });
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
      <div className="space-y-6">
        {(dirty || msg) && (
          <div
            role="status"
            className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
              msg?.kind === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : msg?.kind === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {msg ? msg.text : "* 변경사항이 있어요. 저장을 눌러주세요."}
          </div>
        )}

        {/* 기본정보 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
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
                className={inputCls}
                autoComplete="off"
                required
              />
            </Field>
            <Field label="설명" htmlFor="description">
              <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  markDirty();
                }}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="아이콘" htmlFor="icon">
                <input
                  id="icon"
                  type="text"
                  value={icon}
                  onChange={(e) => {
                    setIcon(e.target.value);
                    markDirty();
                  }}
                  maxLength={4}
                  className={inputCls}
                />
              </Field>
              <Field label="도토리 (0~100)" htmlFor="acorns">
                <input
                  id="acorns"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={acorns}
                  onChange={(e) => {
                    setAcorns(e.target.value);
                    markDirty();
                  }}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* 사진 미션 설정 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
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
                  <span>캡션 필수</span>
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

        {/* 배포 필드 공통 */}
        <DeployFields
          unlockRule={unlockRule}
          setUnlockRule={setUnlockRule}
          unlockThreshold={unlockThreshold}
          setUnlockThreshold={setUnlockThreshold}
          unlockPreviousId={unlockPreviousId}
          setUnlockPreviousId={setUnlockPreviousId}
          approvalMode={approvalMode}
          setApprovalMode={setApprovalMode}
          startsAt={startsAt}
          setStartsAt={setStartsAt}
          endsAt={endsAt}
          setEndsAt={setEndsAt}
          isActive={isActive}
          setIsActive={setIsActive}
          siblings={siblings}
          missionId={mission.id}
          markDirty={markDirty}
        />
      </div>

      {/* Right: 프리뷰 + 액션 */}
      <aside className="space-y-4">
        <div className="sticky top-4 space-y-4">
          <section className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-[#8B6F47]">
              👀 참가자에게는 이렇게 보여요
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
                    📸 사진 미션 · <AcornIcon size={12} /> +{acorns || 0}
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

          <section className="rounded-2xl border border-[#D4E4BC] bg-white/95 p-4 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={onSave}
              disabled={isPending}
              className="w-full rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-[#234a30] hover:to-[#2D5A3D] disabled:opacity-50"
            >
              💾 저장
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled
                title="Phase 4에서 활성화"
                aria-label="지사에 개선 제안하기 — Phase 4 기능"
                className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#6B6560] opacity-60"
              >
                💌 개선 제안
              </button>
              <button
                type="button"
                onClick={onRemove}
                disabled={isPending}
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
              >
                🗑 제거
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
