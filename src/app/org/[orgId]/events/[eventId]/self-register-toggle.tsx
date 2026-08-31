"use client";

// 참가자 탭 상단 — 셀프 등록 허용 토글 카드.
// ON 으로 켜면 초대장 링크에 들어온 사람이 사전 등록 없이 학부모 연락처 +
// 보호자 이름만 적고 바로 입장 가능 (이름은 신규 회원가입에 필수).
// 백엔드/login API/edit-form 은 이미 구현됨 — 이 카드는 가장 자주 쓰는 위치
// (참가자 탭)에 같은 스위치를 노출.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateEventSelfRegisterAction } from "@/lib/org-events/actions";

type Props = {
  eventId: string;
  initialEnabled: boolean;
  /** LIVE 가 아니면 실제 동작 안 함을 표시. */
  eventStatus: "DRAFT" | "LIVE" | "ENDED" | "ARCHIVED";
};

export function SelfRegisterToggle({
  eventId,
  initialEnabled,
  eventStatus,
}: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isLive = eventStatus === "LIVE";

  function onToggle() {
    if (pending) return;
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      try {
        await updateEventSelfRegisterAction(eventId, next);
        router.refresh();
      } catch (e) {
        setEnabled(!next);
        setError(e instanceof Error ? e.message : "변경에 실패했어요");
      }
    });
  }

  return (
    <section
      className={`rounded-2xl border-2 p-4 shadow-sm transition ${
        enabled
          ? "border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-50/70"
          : "border-[#D4E4BC] bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          {enabled ? "🚪" : "🔒"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-[#2D5A3D]">
              셀프 등록 허용
            </h3>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                enabled
                  ? "bg-amber-500 text-white"
                  : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {enabled ? "ON" : "OFF"}
            </span>
            {pending && (
              <span className="text-[10px] text-[#6B6560]">저장 중…</span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#6B6560]">
            {enabled ? (
              <>
                초대장 링크로 들어오면 <b>연락처 + 보호자 이름</b>만 적고 바로
                입장, 명단에 자동 추가돼요.
              </>
            ) : (
              <>미리 등록한 연락처만 입장할 수 있어요.</>
            )}
          </p>
          {enabled && !isLive && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-200">
              ⚠ 행사가 진행중(LIVE) 상태일 때만 실제로 동작해요
            </p>
          )}
          {error && (
            <p className="mt-1 text-[11px] font-semibold text-rose-700">
              ⚠ {error}
            </p>
          )}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={onToggle}
          disabled={pending}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50 ${
            enabled ? "bg-amber-500" : "bg-zinc-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
            aria-hidden
          />
        </button>
      </div>
    </section>
  );
}
