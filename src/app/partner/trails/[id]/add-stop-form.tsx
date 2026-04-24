"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addStopAction } from "../actions";
import { MISSION_TYPE_META } from "@/lib/trails/types";
import { ImageUploader } from "@/components/image-uploader";

type MissionType = "PHOTO" | "QUIZ" | "LOCATION" | "CHECKIN";

const MISSION_KEYS: MissionType[] = ["CHECKIN", "PHOTO", "QUIZ", "LOCATION"];

type Props = {
  trailId: string;
  nextOrder: number;
};

export function AddStopForm({ trailId, nextOrder }: Props) {
  const [open, setOpen] = useState(false);
  const [missionType, setMissionType] = useState<MissionType>("CHECKIN");
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const boundAction = addStopAction.bind(null, trailId);

  const handleSubmit = (formData: FormData) => {
    setErr(null);
    startTransition(async () => {
      try {
        await boundAction(formData);
        setOpen(false);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("NEXT_REDIRECT")) setErr(msg);
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-[#D4E4BC] bg-white p-3 text-sm font-bold text-[#2D5A3D] transition hover:border-[#2D5A3D] hover:bg-[#F5F1E8]"
      >
        ➕ 새 지점 추가
      </button>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-4 rounded-2xl border border-[#2D5A3D] bg-[#F5F1E8] p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#2D5A3D]">➕ 새 지점 추가</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[#6B6560] hover:text-[#2D5A3D]"
          aria-label="닫기"
        >
          ✕ 접기
        </button>
      </div>

      <input type="hidden" name="order" value={nextOrder} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label
            htmlFor="stop-name"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            지점 이름 *
          </label>
          <input
            id="stop-name"
            name="name"
            type="text"
            required
            maxLength={60}
            placeholder="예) 첫 번째 이정표"
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="stop-description"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            설명
          </label>
          <textarea
            id="stop-description"
            name="description"
            rows={2}
            placeholder="이 지점에서 만나는 풍경이나 스토리를 적어주세요."
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="stop-location-hint"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            위치 힌트
          </label>
          <input
            id="stop-location-hint"
            name="location_hint"
            type="text"
            placeholder="예) 큰 참나무 옆 벤치"
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>

        <div className="md:col-span-2">
          <ImageUploader
            name="photo_url"
            label="지점 사진"
            folder="trails/stops"
            maxKb={500}
            hint="가족들이 QR 스캔 시 이 사진을 보게 돼요"
          />
        </div>

        <div>
          <label
            htmlFor="stop-lat"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            위도 (lat)
          </label>
          <input
            id="stop-lat"
            name="lat"
            type="number"
            step="any"
            inputMode="decimal"
            placeholder="37.5665"
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>
        <div>
          <label
            htmlFor="stop-lng"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            경도 (lng)
          </label>
          <input
            id="stop-lng"
            name="lng"
            type="number"
            step="any"
            inputMode="decimal"
            placeholder="126.9780"
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>

        <div>
          <label
            htmlFor="stop-mission-type"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            미션 타입 *
          </label>
          <select
            id="stop-mission-type"
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
            htmlFor="stop-reward-points"
            className="text-xs font-semibold text-[#2D5A3D]"
          >
            보상 점수
          </label>
          <input
            id="stop-reward-points"
            name="reward_points"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            defaultValue={10}
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>

        {/* mission_config fields */}
        <MissionConfigFields type={missionType} />
      </div>

      {err && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          ⚠️ {err}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={isPending}
          className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#2D5A3D] transition hover:bg-white disabled:opacity-60"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#4A7C59] disabled:opacity-60"
        >
          {isPending ? "추가 중..." : "➕ 지점 추가"}
        </button>
      </div>
    </form>
  );
}

function MissionConfigFields({ type }: { type: MissionType }) {
  if (type === "PHOTO") {
    return (
      <div className="md:col-span-2">
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
          defaultValue={1}
          inputMode="numeric"
          className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
        />
      </div>
    );
  }

  if (type === "QUIZ") {
    return (
      <>
        <div className="md:col-span-2">
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
            placeholder="이 지점에 있는 나무의 이름은?"
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>
        <div className="md:col-span-2">
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
            placeholder="참나무"
            className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
          />
        </div>
      </>
    );
  }

  if (type === "LOCATION") {
    return (
      <div className="md:col-span-2">
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
          defaultValue={30}
          inputMode="numeric"
          className="mt-1 w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/20"
        />
        <p className="mt-1 text-[10px] text-[#6B6560]">
          참가자가 이 거리 안에 들어오면 인증 성공으로 처리돼요.
        </p>
      </div>
    );
  }

  return (
    <div className="md:col-span-2 rounded-lg border border-dashed border-[#D4E4BC] bg-white p-3 text-xs text-[#6B6560]">
      ✓ QR 인식만으로 체크인 완료 — 추가 설정은 없어요.
    </div>
  );
}
