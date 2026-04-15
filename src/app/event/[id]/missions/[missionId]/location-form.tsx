"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitLocationAction } from "../actions";

export function LocationForm({ eventId, missionId }: { eventId: string; missionId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleGetLocation = () => {
    setError(null);
    setStatus("위치 확인 중...");

    if (!navigator.geolocation) {
      setError("이 브라우저는 위치 정보를 지원하지 않습니다");
      setStatus("");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setStatus(`위치 확보 (정확도 ${Math.round(accuracy)}m)`);

        if (accuracy > 100) {
          setError("GPS 정확도가 낮습니다. 야외로 나가서 다시 시도해주세요");
          setStatus("");
          return;
        }

        startTransition(async () => {
          try {
            const result = await submitLocationAction(
              eventId,
              missionId,
              latitude,
              longitude,
              accuracy
            );
            if (!result.ok) {
              setError(result.message ?? "범위 밖입니다");
              setStatus("");
              return;
            }
            router.push(`/event/${eventId}/missions?result=correct`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "제출 실패");
            setStatus("");
          }
        });
      },
      (err) => {
        setError(`위치 접근 거부 (${err.message})`);
        setStatus("");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="space-y-4 rounded-lg border bg-white p-6">
      <p className="text-sm">📍 이 장소 근처로 이동한 후 인증 버튼을 눌러주세요</p>

      {status && <p className="text-sm text-violet-600">{status}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleGetLocation}
        disabled={pending}
        className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {pending ? "인증 중..." : "📍 위치 인증"}
      </button>
    </div>
  );
}
