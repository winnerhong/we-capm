"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMissionHostOrganizerAction } from "../../actions";

type Props = {
  missionId: string;
  initialHost: string;
  initialOrganizer: string;
  /** 연결된 행사의 기본값 — 비어있을 수 있음. "자동채움" 버튼의 출처. */
  eventDefaults: { host: string; organizer: string } | null;
};

const inputCls =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

export function HostOrganizerCard({
  missionId,
  initialHost,
  initialOrganizer,
  eventDefaults,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [host, setHost] = useState(initialHost);
  const [organizer, setOrganizer] = useState(initialOrganizer);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null
  );

  const canAutofill =
    eventDefaults &&
    ((eventDefaults.host && eventDefaults.host !== host) ||
      (eventDefaults.organizer && eventDefaults.organizer !== organizer));

  function applyAutofill() {
    if (!eventDefaults) return;
    if (eventDefaults.host) setHost(eventDefaults.host);
    if (eventDefaults.organizer) setOrganizer(eventDefaults.organizer);
    setDirty(true);
    setMsg(null);
  }

  function onSave() {
    const fd = new FormData();
    fd.set("invitation_host", host.trim());
    fd.set("invitation_organizer", organizer.trim());
    startTransition(async () => {
      try {
        await updateMissionHostOrganizerAction(missionId, fd);
        setMsg({ kind: "ok", text: "저장했어요." });
        setDirty(false);
        router.refresh();
      } catch (e) {
        setMsg({
          kind: "error",
          text: e instanceof Error ? e.message : "저장 실패",
        });
      }
    });
  }

  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span aria-hidden>🏛</span>
          <span>주최 · 주관</span>
        </h2>
        {eventDefaults && (
          <button
            type="button"
            onClick={applyAutofill}
            disabled={isPending || !canAutofill}
            className="inline-flex items-center gap-1 rounded-full border border-[#D4E4BC] bg-[#F5F1E8] px-2.5 py-1 text-[11px] font-bold text-[#2D5A3D] shadow-sm hover:bg-[#E8DDC8] disabled:cursor-not-allowed disabled:opacity-50"
            title={
              canAutofill
                ? "연결된 행사의 주최·주관 값으로 채워요"
                : "이미 행사 값과 같아요"
            }
          >
            <span aria-hidden>✨</span>
            <span>행사에서 자동채움</span>
          </button>
        )}
      </div>

      {eventDefaults ? (
        <p className="mb-3 rounded-lg bg-[#F5F1E8] px-3 py-2 text-[11px] text-[#6B6560]">
          <span className="font-semibold text-[#2D5A3D]">📌 연결된 행사 값:</span>{" "}
          주최{" "}
          <b className="text-[#2C2C2C]">
            {eventDefaults.host || "(비어있음)"}
          </b>{" "}
          · 주관{" "}
          <b className="text-[#2C2C2C]">
            {eventDefaults.organizer || "(비어있음)"}
          </b>
        </p>
      ) : (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          연결된 행사가 없거나 행사에 주최·주관이 입력되지 않았어요. 직접
          입력해 주세요.
        </p>
      )}

      <div className="space-y-3">
        <div>
          <label
            htmlFor="invitation_host"
            className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
          >
            🏫 주최
          </label>
          <input
            id="invitation_host"
            type="text"
            value={host}
            onChange={(e) => {
              setHost(e.target.value);
              setDirty(true);
              setMsg(null);
            }}
            placeholder="예) 구미혜당학교"
            className={inputCls}
            autoComplete="off"
          />
        </div>
        <div>
          <label
            htmlFor="invitation_organizer"
            className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
          >
            🎯 주관
          </label>
          <input
            id="invitation_organizer"
            type="text"
            value={organizer}
            onChange={(e) => {
              setOrganizer(e.target.value);
              setDirty(true);
              setMsg(null);
            }}
            placeholder="예) 위너키즈스포츠 [위너기획]"
            className={inputCls}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        {msg ? (
          <p
            role="status"
            className={`text-xs font-semibold ${
              msg.kind === "error" ? "text-rose-700" : "text-emerald-700"
            }`}
          >
            {msg.text}
          </p>
        ) : dirty ? (
          <p className="text-xs font-semibold text-amber-800">
            * 변경사항이 있어요.
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={isPending || !dirty}
          className="rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:from-[#234a30] hover:to-[#2D5A3D] disabled:opacity-50"
        >
          💾 주최·주관 저장
        </button>
      </div>
    </section>
  );
}
