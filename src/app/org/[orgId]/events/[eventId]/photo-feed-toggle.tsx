"use client";

// 사진 나눠보기 스위치 — 참가 가족끼리 미션 사진을 볼 수 있게 할지.
//
// 이 스위치 하나가 곧 공개 결정이다. 켜면 이 행사에서 **기관 확인이 끝난 사진이
// 모두** 참가 가족에게 보인다(전에 올린 사진 포함). 보호자별 개별 동의는 없다.
// 아이 사진에 대한 결정이라 그 범위를 문구로 못 박아 둔다 — 켜는 사람이 무엇을
// 켜는지 모른 채 켜는 일만은 없어야 한다.
//
// 단 그 문단은 **꺼져 있을 때만** 띄운다. 결정은 켜는 순간에 하는 것이고,
// 이미 켠 뒤에도 같은 경고를 계속 세워 두면 카드가 글자로 꽉 차서 정작
// 스위치가 안 보인다. 켜진 상태의 공개 범위는 제목 아래 한 줄이 말한다.
//
// SelfRegisterToggle 과 같은 낙관적 업데이트(실패 시 서버 값으로 롤백).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateEventPhotoFeedAction } from "@/lib/org-events/actions";

export function PhotoFeedToggle({
  eventId,
  initialEnabled,
}: {
  eventId: string;
  initialEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onToggle() {
    if (pending) return;
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      try {
        await updateEventPhotoFeedAction(eventId, next);
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
          ? "border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/70"
          : "border-[#D4E4BC] bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          {enabled ? "📸" : "🔒"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#2D5A3D]">
                사진 나눠보기
              </h3>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[#6B6560]">
                {enabled
                  ? "확인 끝난 사진을 참가 가족이 서로 보고 있어요."
                  : "지금은 올린 사람만 자기 사진을 봐요."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="사진 나눠보기"
              disabled={pending}
              onClick={onToggle}
              className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
                enabled ? "bg-emerald-500" : "bg-zinc-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                  enabled ? "left-[1.375rem]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          {/* 아이 사진에 대한 결정이라 범위를 못 박아 두되, **결정하는 순간에만**
              말한다. 이미 켠 뒤로는 같은 문단이 매번 자리를 차지할 뿐이다
              (켜진 상태의 범위는 바로 위 한 줄이 이미 말하고 있다). */}
          {!enabled && (
            <p className="mt-3 rounded-xl border border-[#E8DDC8] bg-[#FFF8F0] px-3 py-2 text-[11px] leading-relaxed text-[#6B4423]">
              🌿 켜면 <b>확인 끝난 사진이 모두</b> 보여요 — 먼저 올린 것까지.
              (검토 중·반려는 빠져요)
              <br />
              보호자가 사진마다 고르지는 않으니 참가 안내에 함께 적어주세요.
            </p>
          )}

          {enabled && (
            <p className="mt-2 text-[11px] text-[#8B7F75]">
              끄면 바로 안 보여요 (사진은 지워지지 않아요)
            </p>
          )}

          {error && (
            <p className="mt-2 text-[11px] font-semibold text-rose-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
