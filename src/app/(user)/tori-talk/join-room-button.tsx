"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinRoomSelfAction } from "@/lib/toritalk/actions";

export function JoinRoomButton({
  roomId,
  roomName,
}: {
  roomId: string;
  roomName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const join = () => {
    setError(null);
    startTransition(async () => {
      const r = await joinRoomSelfAction(roomId);
      if (!r.ok) {
        setError(r.reason ?? "입장 실패");
        return;
      }
      router.push(`/tori-talk/${roomId}`);
    });
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={join}
        disabled={pending}
        className="w-full rounded-xl bg-[#2D5A3D] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#264C33] disabled:opacity-50"
      >
        {pending ? "입장 중..." : `🚪 "${roomName}" 입장하기`}
      </button>
      {error && (
        <p className="text-[11px] text-rose-700" role="alert">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
