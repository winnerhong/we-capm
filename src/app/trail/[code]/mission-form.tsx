"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { MissionType } from "@/lib/trails/types";
import { submitStopMissionAction } from "./actions";

type Props = {
  qrCode: string;
  trailId: string;
  missionType: MissionType;
  missionConfig: Record<string, unknown>;
  targetLat: number | null;
  targetLng: number | null;
};

export function MissionForm({
  qrCode,
  trailId,
  missionType,
  missionConfig,
  targetLat,
  targetLng,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");

  // 재방문 시 localStorage에서 이름/전화뒷4 자동 채움
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`trail-progress-${trailId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { phone_last4?: string; name?: string };
        if (parsed.phone_last4) setPhoneLast4(parsed.phone_last4);
        if (parsed.name) setName(parsed.name);
      }
    } catch {
      /* ignore */
    }
  }, [trailId]);

  // 제출 직전 localStorage 업데이트 (낙관적: 서버 제출 성공 전에도 다음 지점 UI에 반영)
  const saveProgressLocal = () => {
    try {
      const key = `trail-progress-${trailId}`;
      const raw = localStorage.getItem(key);
      const prev = raw
        ? (JSON.parse(raw) as { stops_cleared?: string[]; phone_last4?: string; name?: string })
        : {};
      const cleared = new Set(prev.stops_cleared ?? []);
      cleared.add(qrCode);
      const next = {
        stops_cleared: Array.from(cleared),
        phone_last4: phoneLast4 || prev.phone_last4 || "",
        name: name || prev.name || "",
      };
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const onUseLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("이 기기에서는 위치를 확인할 수 없어요");
      return;
    }
    setGpsBusy(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsBusy(false);
      },
      (err) => {
        setGpsError(err.message || "위치를 가져오지 못했어요");
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);

    // 폰 번호 뒷 4자리만 들어오면 그대로 participant_phone에 저장
    saveProgressLocal();

    startTransition(async () => {
      try {
        await submitStopMissionAction(qrCode, fd);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "제출에 실패했어요";
        // Next.js redirect는 특수 에러 throw → 무시
        if (
          msg.includes("NEXT_REDIRECT") ||
          (err as { digest?: string })?.digest?.includes?.("NEXT_REDIRECT")
        ) {
          return;
        }
        setError(msg);
      }
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {/* 미션 타입별 UI */}
      {missionType === "CHECKIN" && (
        <div className="rounded-xl bg-[#E8F0E4] p-4 text-sm text-[#2D5A3D] text-center">
          지점에 도착했다면 아래 버튼을 눌러주세요!
        </div>
      )}

      {missionType === "QUIZ" && (
        <div>
          <label
            htmlFor="answer"
            className="block text-sm font-bold text-[#2D5A3D] mb-1"
          >
            {typeof missionConfig.question === "string"
              ? (missionConfig.question as string)
              : "이 지점의 정답을 입력해 주세요"}
          </label>
          {typeof missionConfig.hint === "string" && (
            <p className="text-xs text-zinc-500 mb-2">
              💡 {missionConfig.hint as string}
            </p>
          )}
          <textarea
            id="answer"
            name="answer"
            required
            rows={3}
            className="w-full rounded-xl border-2 border-[#D4E4BC] focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20 bg-white px-3 py-2 text-sm outline-none"
            placeholder="정답을 입력하세요"
          />
        </div>
      )}

      {missionType === "PHOTO" && (
        <div>
          <label
            htmlFor="photo_url"
            className="block text-sm font-bold text-[#2D5A3D] mb-1"
          >
            📷 사진 URL
          </label>
          <p className="text-xs text-zinc-500 mb-2">
            (Phase 2에서 업로드 가능 — 지금은 URL을 붙여넣어 주세요)
          </p>
          <input
            id="photo_url"
            name="photo_url"
            type="url"
            required
            inputMode="url"
            autoComplete="off"
            className="w-full rounded-xl border-2 border-[#D4E4BC] focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20 bg-white px-3 py-2 text-sm outline-none"
            placeholder="https://..."
          />
        </div>
      )}

      {missionType === "LOCATION" && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={onUseLocation}
            disabled={gpsBusy}
            className="w-full rounded-xl border-2 border-[#2D5A3D] bg-white text-[#2D5A3D] font-bold h-12 disabled:opacity-60"
          >
            {gpsBusy ? "위치 확인 중..." : "📍 내 위치 확인"}
          </button>
          {coords && (
            <div className="rounded-xl bg-[#E8F0E4] px-3 py-2 text-xs text-[#2D5A3D]">
              현재 위치 · {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              {targetLat !== null && targetLng !== null && (
                <span className="block text-[11px] text-zinc-500 mt-0.5">
                  지점 좌표: {targetLat.toFixed(5)}, {targetLng.toFixed(5)}
                </span>
              )}
            </div>
          )}
          {gpsError && (
            <p className="text-xs text-red-600" role="alert">
              {gpsError}
            </p>
          )}
          <input type="hidden" name="lat" value={coords?.lat ?? ""} />
          <input type="hidden" name="lng" value={coords?.lng ?? ""} />
        </div>
      )}

      {/* 공통 — 이름 + 전화 뒷4 (선택) */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor="participant_name"
            className="block text-xs font-semibold text-zinc-600 mb-1"
          >
            이름 (선택)
          </label>
          <input
            id="participant_name"
            name="participant_name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border-2 border-[#D4E4BC] focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20 bg-white px-3 py-2 text-sm outline-none"
            placeholder="홍길동"
          />
        </div>
        <div>
          <label
            htmlFor="participant_phone"
            className="block text-xs font-semibold text-zinc-600 mb-1"
          >
            전화 뒷 4자리 (선택)
          </label>
          <input
            id="participant_phone"
            name="participant_phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={4}
            pattern="[0-9]{0,4}"
            value={phoneLast4}
            onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-xl border-2 border-[#D4E4BC] focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/20 bg-white px-3 py-2 text-sm outline-none"
            placeholder="1234"
          />
        </div>
      </div>

      {error && (
        <p
          className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={
          pending ||
          (missionType === "LOCATION" && !coords)
        }
        className="w-full h-14 rounded-2xl bg-[#2D5A3D] hover:bg-[#264C33] disabled:opacity-60 text-white font-bold text-lg shadow-lg transition active:scale-[0.98]"
      >
        {pending
          ? "제출 중..."
          : missionType === "CHECKIN"
            ? "✅ 도착했어요!"
            : "🎯 미션 완료하기"}
      </button>
    </form>
  );
}
