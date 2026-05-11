"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  backfillToritalkFromClassNamesAction,
  setToritalkEnabledAction,
} from "@/lib/toritalk/actions";

export function ToritalkEnableToggle({
  orgId,
  enabled,
}: {
  orgId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  const toggle = () => {
    const next = !on;
    setError(null);
    setOn(next);
    startTransition(async () => {
      try {
        await setToritalkEnabledAction(orgId, next);
        router.refresh();
      } catch (err) {
        setOn(!next);
        setError(err instanceof Error ? err.message : "변경 실패");
      }
    });
  };

  const backfill = () => {
    if (
      !confirm(
        "기존 참가자 자녀들의 반명 데이터로 토리톡 방을 일괄 생성합니다. 진행할까요?"
      )
    )
      return;
    setBackfillMsg(null);
    startTransition(async () => {
      try {
        const r = await backfillToritalkFromClassNamesAction(orgId);
        setBackfillMsg(
          `방 ${r.roomsCreated}개 생성 · 멤버 ${r.membersAdded}명 추가됨`
        );
        router.refresh();
      } catch (err) {
        setBackfillMsg(
          err instanceof Error ? `⚠ ${err.message}` : "⚠ 백필 실패"
        );
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-[#2D5A3D]">토리톡 활성화</p>
          <p className="mt-0.5 text-xs text-[#6B6560]">
            켜면 참가자 홈 하단 메뉴와 /tori-talk 페이지에 채팅 기능이
            노출됩니다.
          </p>
          {error && (
            <p className="mt-2 text-xs text-rose-700" role="alert">
              ⚠ {error}
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={toggle}
          disabled={pending}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
            on ? "bg-[#2D5A3D]" : "bg-[#D4E4BC]"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition ${
              on ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {on && (
        <div className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#2D5A3D]">
                📥 반명 데이터 일괄 적용
              </p>
              <p className="mt-0.5 text-[11px] text-[#8B7F75]">
                참가자에게 이미 입력된 반명으로 방을 자동 생성·가입시킵니다.
                활성화 직후 한 번만 누르면 돼요.
              </p>
            </div>
            <button
              type="button"
              onClick={backfill}
              disabled={pending}
              className="shrink-0 rounded-xl border border-[#2D5A3D] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#E8F0E4] disabled:opacity-50"
            >
              {pending ? "처리 중..." : "🔄 백필 실행"}
            </button>
          </div>
          {backfillMsg && (
            <p
              className={`mt-2 text-[11px] ${
                backfillMsg.startsWith("⚠")
                  ? "text-rose-700"
                  : "text-emerald-700"
              }`}
              role="status"
            >
              {backfillMsg.startsWith("⚠") ? "" : "✅ "}
              {backfillMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
