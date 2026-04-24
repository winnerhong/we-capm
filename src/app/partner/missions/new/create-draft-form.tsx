"use client";

import { useState, useTransition } from "react";
import { MISSION_KIND_META, type MissionKind } from "@/lib/missions/types";
import { createDraftMissionAction } from "../actions";
import { AcornIcon } from "@/components/acorn-icon";

const ALL_KINDS: MissionKind[] = [
  "PHOTO",
  "QR_QUIZ",
  "PHOTO_APPROVAL",
  "COOP",
  "BROADCAST",
  "TREASURE",
  "RADIO",
  "FINAL_REWARD",
];

const SUPPORTED_KINDS: Set<MissionKind> = new Set([
  "PHOTO",
  "QR_QUIZ",
  "PHOTO_APPROVAL",
  "COOP",
  "BROADCAST",
  "TREASURE",
  "RADIO",
  "FINAL_REWARD",
]);

export function CreateDraftForm() {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingKind, setPendingKind] = useState<MissionKind | null>(null);

  function onPick(kind: MissionKind) {
    if (!SUPPORTED_KINDS.has(kind)) return;
    setErrorMsg(null);
    setPendingKind(kind);
    startTransition(async () => {
      try {
        await createDraftMissionAction(kind);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "알 수 없는 오류가 발생했어요";
        setErrorMsg(msg);
        setPendingKind(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {ALL_KINDS.map((kind) => {
          const meta = MISSION_KIND_META[kind];
          const supported = SUPPORTED_KINDS.has(kind);
          const isLoading = isPending && pendingKind === kind;
          return (
            <button
              key={kind}
              type="button"
              disabled={!supported || isPending}
              onClick={() => onPick(kind)}
              aria-label={`${meta.label} 미션 만들기`}
              className={`group relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
                supported
                  ? "border-[#D4E4BC] bg-white shadow-sm hover:border-[#2D5A3D] hover:shadow-md disabled:cursor-wait disabled:opacity-70"
                  : "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400"
              }`}
            >
              {!supported && (
                <span className="absolute right-2 top-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  Phase 3 준비 중
                </span>
              )}
              <span className="text-3xl" aria-hidden>
                {meta.icon}
              </span>
              <div className="min-w-0 space-y-1">
                <p
                  className={`text-sm font-bold ${
                    supported ? "text-[#2D5A3D]" : "text-zinc-500"
                  }`}
                >
                  {meta.label}
                </p>
                <p
                  className={`text-[11px] leading-snug ${
                    supported ? "text-[#6B6560]" : "text-zinc-400"
                  }`}
                >
                  {meta.shortDesc}
                </p>
              </div>
              <div className="mt-auto flex w-full items-center justify-between pt-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    supported
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-zinc-200 bg-zinc-100 text-zinc-400"
                  }`}
                >
                  <AcornIcon size={12} />
                  <span>+{meta.defaultAcorns}</span>
                </span>
                {supported && (
                  <span
                    className={`text-[11px] font-semibold ${
                      isLoading
                        ? "text-[#2D5A3D]"
                        : "text-[#2D5A3D] group-hover:underline"
                    }`}
                  >
                    {isLoading ? "만드는 중..." : "시작 →"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
