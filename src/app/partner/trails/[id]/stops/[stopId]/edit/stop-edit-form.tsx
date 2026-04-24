"use client";

import Link from "next/link";
import { useState } from "react";
import { MISSION_TYPE_META, type TrailStopRow } from "@/lib/trails/types";
import { ImageUploader } from "@/components/image-uploader";

type MissionType = "PHOTO" | "QUIZ" | "LOCATION" | "CHECKIN";
const MISSION_KEYS: MissionType[] = ["CHECKIN", "PHOTO", "QUIZ", "LOCATION"];

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  stop: TrailStopRow;
  trailId: string;
};

function getCfgNum(
  cfg: Record<string, unknown> | null | undefined,
  key: string
): number | "" {
  if (!cfg) return "";
  const v = cfg[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return "";
}

function getCfgStr(
  cfg: Record<string, unknown> | null | undefined,
  key: string
): string {
  if (!cfg) return "";
  const v = cfg[key];
  return typeof v === "string" ? v : "";
}

export function StopEditForm({ action, stop, trailId }: Props) {
  const [missionType, setMissionType] = useState<MissionType>(
    stop.mission_type
  );
  const cfg = stop.mission_config ?? {};

  return (
    <form
      action={action}
      className="space-y-5 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6"
    >
      <div>
        <label htmlFor="name" className="text-xs font-semibold text-[#2D5A3D]">
          지점 이름 *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={stop.name}
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
          defaultValue={stop.description ?? ""}
          className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
        />
      </div>

      <div>
        <label
          htmlFor="location_hint"
          className="text-xs font-semibold text-[#2D5A3D]"
        >
          위치 힌트
        </label>
        <input
          id="location_hint"
          name="location_hint"
          type="text"
          defaultValue={stop.location_hint ?? ""}
          className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
        />
      </div>

      <ImageUploader
        name="photo_url"
        label="지점 사진"
        defaultValue={stop.photo_url ?? ""}
        folder="trails/stops"
        maxKb={500}
        hint="가족들이 QR 스캔 시 이 사진을 보게 돼요"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="lat"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            위도 (lat)
          </label>
          <input
            id="lat"
            name="lat"
            type="number"
            step="any"
            inputMode="decimal"
            defaultValue={
              stop.lat !== null && stop.lat !== undefined
                ? String(stop.lat)
                : ""
            }
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>
        <div>
          <label
            htmlFor="lng"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            경도 (lng)
          </label>
          <input
            id="lng"
            name="lng"
            type="number"
            step="any"
            inputMode="decimal"
            defaultValue={
              stop.lng !== null && stop.lng !== undefined
                ? String(stop.lng)
                : ""
            }
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="mission_type"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            미션 타입 *
          </label>
          <select
            id="mission_type"
            name="mission_type"
            value={missionType}
            onChange={(e) => setMissionType(e.target.value as MissionType)}
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          >
            {MISSION_KEYS.map((k) => {
              const m = MISSION_TYPE_META[k];
              return (
                <option key={k} value={k}>
                  {m.icon} {m.label}
                </option>
              );
            })}
          </select>
          <p className="mt-1 text-[10px] text-[#6B6560]">
            {MISSION_TYPE_META[missionType].desc}
          </p>
        </div>
        <div>
          <label
            htmlFor="reward_points"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            보상 점수
          </label>
          <input
            id="reward_points"
            name="reward_points"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            defaultValue={stop.reward_points ?? 10}
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>
      </div>

      {/* mission_config */}
      {missionType === "PHOTO" && (
        <div>
          <label
            htmlFor="cfg_min_photos"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            최소 사진 장수
          </label>
          <input
            id="cfg_min_photos"
            name="cfg_min_photos"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            defaultValue={getCfgNum(cfg, "min_photos") || 1}
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>
      )}

      {missionType === "QUIZ" && (
        <>
          <div>
            <label
              htmlFor="cfg_question"
              className="text-xs font-semibold text-[#2D5A3D]"
            >
              문제 *
            </label>
            <input
              id="cfg_question"
              name="cfg_question"
              type="text"
              required
              defaultValue={getCfgStr(cfg, "question")}
              className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
            />
          </div>
          <div>
            <label
              htmlFor="cfg_answer"
              className="text-xs font-semibold text-[#2D5A3D]"
            >
              정답 *
            </label>
            <input
              id="cfg_answer"
              name="cfg_answer"
              type="text"
              required
              defaultValue={getCfgStr(cfg, "answer")}
              className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
            />
          </div>
        </>
      )}

      {missionType === "LOCATION" && (
        <div>
          <label
            htmlFor="cfg_radius_m"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            허용 반경 (미터)
          </label>
          <input
            id="cfg_radius_m"
            name="cfg_radius_m"
            type="number"
            min={5}
            step={5}
            inputMode="numeric"
            defaultValue={getCfgNum(cfg, "radius_m") || 30}
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>
      )}

      {missionType === "CHECKIN" && (
        <div className="rounded-lg border border-dashed border-[#D4E4BC] bg-[#F5F1E8] p-3 text-xs text-[#6B6560]">
          ✓ QR 인식만으로 체크인 완료 — 추가 설정은 없어요.
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Link
          href={`/partner/trails/${trailId}`}
          className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
        >
          취소
        </Link>
        <button
          type="submit"
          className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#4A7C59]"
        >
          💾 저장
        </button>
      </div>
    </form>
  );
}
