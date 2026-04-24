"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  triggerBroadcastAction,
  cancelBroadcastAction,
  createSampleBroadcastMissionAction,
} from "@/lib/missions/broadcast-actions";
import type { BroadcastTargetScope } from "@/lib/missions/types";
import { AcornIcon } from "@/components/acorn-icon";

type TargetScope = Exclude<BroadcastTargetScope, "ALL">; // ORG | EVENT

type BroadcastMissionSummary = {
  id: string;
  title: string;
  icon: string | null;
  description: string | null;
  acorns: number;
  prompt: string;
  duration_sec: number;
  submission_kind: "PHOTO" | "TEXT";
  is_active: boolean;
};

type ActiveEvent = {
  id: string;
  name: string;
};

type Props = {
  missions: BroadcastMissionSummary[];
  activeEvents: ActiveEvent[];
};

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (s === 0) return `${m}분`;
  return `${m}분 ${s}초`;
}

export function BroadcastTriggerPanel({ missions, activeEvents }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [openId, setOpenId] = useState<string | null>(null);
  const [scope, setScope] = useState<TargetScope>("ORG");
  const [eventId, setEventId] = useState("");
  const [msg, setMsg] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const openMission = missions.find((m) => m.id === openId) ?? null;

  function closeModal() {
    setOpenId(null);
    setScope("ORG");
    setEventId("");
  }

  function onConfirm() {
    if (!openMission) return;
    if (scope === "EVENT" && !eventId) {
      setMsg({ kind: "error", text: "행사를 선택해 주세요." });
      return;
    }
    startTransition(async () => {
      try {
        await triggerBroadcastAction(
          openMission.id,
          scope,
          scope === "EVENT" ? eventId.trim() : undefined
        );
        setMsg({ kind: "ok", text: "발동했어요!" });
        closeModal();
        router.refresh();
      } catch (e) {
        setMsg({
          kind: "error",
          text:
            e instanceof Error
              ? e.message
              : "발동에 실패했어요. 잠시 후 다시 시도해 주세요.",
        });
      }
    });
  }

  function onCreateSample() {
    setMsg(null);
    startTransition(async () => {
      try {
        await createSampleBroadcastMissionAction();
        setMsg({
          kind: "ok",
          text: "샘플 돌발 미션을 만들었어요. 아래 🚨 발동 버튼을 눌러 주세요.",
        });
        router.refresh();
      } catch (e) {
        setMsg({
          kind: "error",
          text:
            e instanceof Error
              ? e.message
              : "샘플 미션 생성에 실패했어요.",
        });
      }
    });
  }

  if (missions.length === 0) {
    return (
      <div className="space-y-3">
        {msg && (
          <div
            role="status"
            className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
              msg.kind === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {msg.text}
          </div>
        )}
        <div className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-6 text-center">
          <p className="text-3xl" aria-hidden>
            📭
          </p>
          <p className="mt-2 text-sm font-bold text-[#2D5A3D]">
            아직 돌발 미션이 없어요
          </p>
          <p className="mt-1 text-xs text-[#6B6560]">
            샘플을 한 개 만들어 바로 발동해 보거나, 스탬프북 편집에서 직접
            만들어도 돼요.
          </p>
          <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onCreateSample}
              disabled={isPending}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-rose-700 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ⚡ {isPending ? "만드는 중…" : "샘플 돌발 미션 만들기"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#8B7F75]">
            샘플은 언제든 카탈로그에서 내용 수정 가능해요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {msg && (
        <div
          role="status"
          className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
            msg.kind === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {missions.map((m) => (
          <li
            key={m.id}
            className={`rounded-2xl border p-4 shadow-sm ${
              m.is_active
                ? "border-[#D4E4BC] bg-white"
                : "border-zinc-200 bg-zinc-50 opacity-70"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-2xl" aria-hidden>
                {m.icon || "⚡"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#2D5A3D]">
                  {m.title || "(제목 없음)"}
                </p>
                <p className="text-[11px] text-[#6B6560]">
                  <AcornIcon size={12} /> +{m.acorns} · ⏱ {formatDuration(m.duration_sec)} ·{" "}
                  {m.submission_kind === "PHOTO" ? "📸 사진" : "✍️ 텍스트"}
                </p>
              </div>
              {!m.is_active && (
                <span className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                  비활성
                </span>
              )}
            </div>
            {m.prompt && (
              <p className="mt-3 line-clamp-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                {m.prompt}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setOpenId(m.id);
                setMsg(null);
              }}
              disabled={!m.is_active || isPending}
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-rose-700 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              🚨 발동
            </button>
          </li>
        ))}
      </ul>

      {/* Confirm modal */}
      {openMission && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="broadcast-confirm-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-xl">
            <div className="flex items-start gap-2">
              <span className="text-3xl" aria-hidden>
                🚨
              </span>
              <div className="flex-1">
                <h3
                  id="broadcast-confirm-title"
                  className="text-base font-bold text-rose-700"
                >
                  돌발 미션을 발동할까요?
                </h3>
                <p className="mt-1 text-xs text-[#6B6560]">
                  버튼을 누르는 즉시 전체 참가자에게 알림이 가요. 되돌리려면
                  취소 버튼을 눌러야 해요.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">
                {openMission.icon || "⚡"} {openMission.title}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-amber-900">
                {openMission.prompt}
              </p>
              <p className="mt-2 text-[11px] text-amber-800">
                <AcornIcon size={12} /> +{openMission.acorns} · ⏱{" "}
                {formatDuration(openMission.duration_sec)} ·{" "}
                {openMission.submission_kind === "PHOTO"
                  ? "📸 사진 제출"
                  : "✍️ 텍스트 제출"}
              </p>
            </div>

            <fieldset className="mt-4">
              <legend className="mb-2 text-xs font-semibold text-[#2D5A3D]">
                알림 대상
              </legend>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[#D4E4BC] bg-white p-3 has-[:checked]:border-[#2D5A3D] has-[:checked]:bg-[#E8F0E4]">
                  <input
                    type="radio"
                    name="scope"
                    value="ORG"
                    checked={scope === "ORG"}
                    onChange={() => setScope("ORG")}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#2D5A3D]">
                      🏠 우리 기관 전체
                    </p>
                    <p className="text-[11px] text-[#6B6560]">
                      기관에 소속된 모든 참가자
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[#D4E4BC] bg-white p-3 has-[:checked]:border-[#2D5A3D] has-[:checked]:bg-[#E8F0E4]">
                  <input
                    type="radio"
                    name="scope"
                    value="EVENT"
                    checked={scope === "EVENT"}
                    onChange={() => setScope("EVENT")}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#2D5A3D]">
                      📅 특정 행사 참가자
                    </p>
                    <p className="text-[11px] text-[#6B6560]">
                      {activeEvents.length > 0
                        ? "진행중 행사 중 하나를 선택하세요"
                        : "현재 진행중인 행사가 없어요"}
                    </p>
                    {scope === "EVENT" && activeEvents.length > 0 && (
                      <select
                        value={eventId}
                        onChange={(e) => setEventId(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-2 py-1.5 text-xs text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
                      >
                        <option value="">행사 선택…</option>
                        {activeEvents.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>
              </div>
            </fieldset>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="flex-1 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-50"
              >
                돌아가기
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isPending}
                className="flex-1 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-rose-700 hover:to-orange-600 disabled:opacity-50"
              >
                {isPending ? "발동 중…" : "🚨 지금 발동"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type CancelProps = {
  broadcastId: string;
};

export function CancelBroadcastButton({ broadcastId }: CancelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onClick() {
    if (!window.confirm("이 돌발 미션을 지금 중단할까요?")) return;
    startTransition(async () => {
      try {
        await cancelBroadcastAction(broadcastId);
        router.refresh();
      } catch (e) {
        setErr(
          e instanceof Error
            ? e.message
            : "취소에 실패했어요. 잠시 후 다시 시도해 주세요."
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
      >
        🛑 {isPending ? "중단 중…" : "취소"}
      </button>
      {err && (
        <p className="text-[10px] font-semibold text-rose-700">{err}</p>
      )}
    </div>
  );
}
