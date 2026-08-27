"use client";

// 사진 나눠보기 스위치 — 참가 가족끼리 미션 사진을 볼 수 있게 할지.
//
// 이 스위치 하나가 곧 공개 결정이다. 켜면 이 행사에서 **기관 확인이 끝난 사진이
// 모두** 참가 가족에게 보인다(전에 올린 사진 포함). 보호자별 개별 동의는 없다.
// 아이 사진에 대한 결정이라 그 범위를 문구로 못 박아 둔다 — 켜는 사람이 무엇을
// 켜는지 모른 채 켜는 일만은 없어야 한다.
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
                  ? "참가 가족들이 서로의 미션 사진을 보고 있어요. 참가자 화면 하단에 [📸 사진] 탭이 생깁니다."
                  : "지금은 각 가족이 올린 사진을 본인만 볼 수 있어요."}
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

          {/* 켜기 전에 반드시 읽혀야 하는 문장 — 아이 사진에 대한 결정이다. */}
          <p className="mt-3 rounded-xl border border-[#E8DDC8] bg-[#FFF8F0] px-3 py-2 text-[11px] leading-relaxed text-[#6B4423]">
            🌿 켜면 <b>기관 확인이 끝난 사진이 모두</b> 참가 가족에게 보여요.
            <br />
            먼저 올려둔 사진도 함께 올라갑니다. 검토 중·반려한 사진은 오르지
            않아요. 보호자가 사진마다 따로 고르지는 않으니, 참가 안내에 이 점을
            함께 알려주세요.
          </p>

          {enabled && (
            <p className="mt-2 text-[11px] leading-relaxed text-[#8B7F75]">
              끄면 이미 보이던 사진도 즉시 화면에서 사라져요 (지워지지는 않아요).
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
