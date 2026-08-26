"use client";

// 접수 탭 상단 — 참가 접수 ON/OFF · 마감 · 정원 설정 카드.
//
// self-register-toggle.tsx 의 패턴을 그대로 따른다:
//   낙관적으로 로컬 state 를 바꾸고, 서버 액션이 실패하면 되돌린다.
//
// 접수를 켜면 이 행사에서는 "연락처만 넣으면 바로 참가" 경로가 전부 막히고
// 승인된 신청서만 참가자가 된다. 그 파급이 큰 스위치라 문구로 명시한다.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateEventApplicationSettingsAction } from "@/lib/org-events/application-actions";
import type { OrgEventApplicationCounts } from "@/lib/org-events/types";

type Props = {
  orgId: string;
  eventId: string;
  initialEnabled: boolean;
  /** datetime-local 값("2026-09-10T18:00"). 없으면 빈 문자열. */
  initialCloseAtLocal: string;
  /** 없으면 빈 문자열. */
  initialCapacity: string;
  counts: OrgEventApplicationCounts;
  /** 초대장이 발행되지 않았으면 신청 폼이 아예 안 뜬다는 경고를 띄운다. */
  invitationPublished: boolean;
  /**
   * 마감을 비웠을 때 실제로 적용될 자동 마감 라벨("2026.09.12 08:40").
   * 행사 시작 시각이 없으면 null.
   */
  defaultCloseLabel: string | null;
};

export function ApplicationSettings({
  orgId,
  eventId,
  initialEnabled,
  initialCloseAtLocal,
  initialCapacity,
  counts,
  invitationPublished,
  defaultCloseLabel,
}: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [closeAt, setCloseAt] = useState(initialCloseAtLocal);
  const [capacity, setCapacity] = useState(initialCapacity);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(next: {
    enabled?: boolean;
    closeAtLocal?: string;
    capacity?: string;
  }) {
    const payload = {
      enabled: next.enabled ?? enabled,
      closeAtLocal: next.closeAtLocal ?? closeAt,
      capacity: next.capacity ?? capacity,
    };
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateEventApplicationSettingsAction(orgId, eventId, payload);
        setSaved(true);
        router.refresh();
      } catch (e) {
        // 실패 → 화면을 서버 값으로 되돌린다.
        setEnabled(initialEnabled);
        setCloseAt(initialCloseAtLocal);
        setCapacity(initialCapacity);
        setError(e instanceof Error ? e.message : "저장에 실패했어요");
      }
    });
  }

  const capacityNum = Number(capacity);
  const hasCapacity = Number.isFinite(capacityNum) && capacityNum > 0;
  const ratio = hasCapacity
    ? Math.min(100, Math.round((counts.approved_people / capacityNum) * 100))
    : 0;
  const full = hasCapacity && counts.approved_people >= capacityNum;

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
          {enabled ? "📥" : "📪"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#2D5A3D]">
                참가 접수 받기
              </h3>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[#6B6560]">
                {enabled
                  ? "초대장 하단에 신청서가 뜹니다. 수락한 사람만 참가자가 돼요."
                  : "지금은 초대장 링크를 받은 사람이 연락처만 넣으면 바로 참가합니다."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              disabled={pending}
              onClick={() => {
                const next = !enabled;
                setEnabled(next);
                save({ enabled: next });
              }}
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

          {enabled && !invitationPublished && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
              ⚠️ 초대장이 아직 발행되지 않아 신청 폼이 보이지 않아요. 개요 탭에서
              초대장을 발행해 주세요.
            </p>
          )}

          {enabled && (
            <>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-[#6B4423]">
                    🕘 접수 마감
                  </span>
                  <input
                    type="datetime-local"
                    value={closeAt}
                    disabled={pending}
                    onChange={(e) => setCloseAt(e.target.value)}
                    onBlur={() => save({ closeAtLocal: closeAt })}
                    className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm text-[#2D5A3D] outline-none focus:border-[#3A7A52] disabled:opacity-50"
                  />
                  {/* 비워둬도 무기한이 아니다 — 행사 시작 1시간 전에 자동으로 닫힌다. */}
                  <span className="mt-1 block text-[10px] leading-relaxed text-[#8B7F75]">
                    {closeAt
                      ? "이 시각에 신청 폼이 닫혀요."
                      : defaultCloseLabel
                        ? `비워두면 ${defaultCloseLabel}에 자동 마감돼요 (행사 시작 1시간 전).`
                        : "행사 시작 일시를 정하면 그 1시간 전에 자동 마감돼요."}
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-[#6B4423]">
                    👥 정원 — 총 인원 (비우면 무제한)
                  </span>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={capacity}
                    disabled={pending}
                    placeholder="예: 120"
                    onChange={(e) => setCapacity(e.target.value)}
                    onBlur={() => save({ capacity })}
                    className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm text-[#2D5A3D] outline-none focus:border-[#3A7A52] disabled:opacity-50"
                  />
                </label>
              </div>

              {/* 현황 게이지 — 정원은 "승인 인원 합계" 기준 */}
              <div className="mt-3 rounded-xl bg-white/70 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold">
                  <span className="text-emerald-700">
                    ✅ 승인 {counts.approved_people}명
                    {hasCapacity ? ` / ${capacityNum}명` : ""}
                  </span>
                  <span className="text-amber-700">
                    ⏳ 대기 {counts.pending_count}건
                  </span>
                  {counts.rejected_count > 0 && (
                    <span className="text-zinc-500">
                      ❌ 거절 {counts.rejected_count}건
                    </span>
                  )}
                  {counts.canceled_count > 0 && (
                    <span className="text-rose-700">
                      🚫 취소 {counts.canceled_count}건
                    </span>
                  )}
                </div>
                {hasCapacity && (
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#EDEAE2]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        full ? "bg-rose-400" : "bg-emerald-500"
                      }`}
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                )}
                {full && (
                  <p className="mt-1.5 text-[11px] font-semibold text-rose-700">
                    정원이 찼어요. 신청은 계속 들어오지만 신청자에게 &quot;대기
                    접수&quot;로 안내됩니다.
                  </p>
                )}
              </div>
            </>
          )}

          {error && (
            <p className="mt-2 text-[11px] font-semibold text-rose-700">
              {error}
            </p>
          )}
          {saved && !error && (
            <p className="mt-2 text-[11px] font-semibold text-emerald-700">
              저장했어요
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
