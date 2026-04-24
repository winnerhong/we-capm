"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MISSION_KIND_META,
  type PartnerMissionRow,
  type BroadcastMissionConfig,
  type MissionVisibility,
} from "@/lib/missions/types";
import {
  updatePartnerMissionAction,
  publishMissionAction,
  archiveMissionAction,
  deleteMissionAction,
} from "../../../actions";
import { AcornIcon } from "@/components/acorn-icon";

type Props = {
  mission: PartnerMissionRow;
};

const VISIBILITY_OPTIONS: Array<{
  value: MissionVisibility;
  label: string;
  hint: string;
}> = [
  {
    value: "DRAFT",
    label: "🔒 비공개 (초안)",
    hint: "지사 내부에서만 보입니다.",
  },
  {
    value: "ALL",
    label: "🌍 전체 공개",
    hint: "모든 기관이 미션 풀에서 볼 수 있어요.",
  },
  {
    value: "SELECTED",
    label: "🎯 선택 공개",
    hint: "지정한 기관에게만 노출됩니다.",
  },
  { value: "ARCHIVED", label: "📦 보관", hint: "목록에서 숨김 처리됩니다." },
];

const MIN_DURATION = 30;
const MAX_DURATION = 3600;
const DEFAULT_DURATION = 300;
const MIN_PROMPT = 4;

type SubmissionKind = BroadcastMissionConfig["submission_kind"];

const SUBMISSION_OPTIONS: Array<{
  value: SubmissionKind;
  label: string;
  hint: string;
}> = [
  {
    value: "PHOTO",
    label: "📸 사진 제출",
    hint: "참가자가 지금 찍은 사진 1장을 올려요.",
  },
  {
    value: "TEXT",
    label: "✍️ 텍스트 제출",
    hint: "참가자가 짧은 메시지를 작성해요.",
  },
];

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (s === 0) return `${m}분`;
  return `${m}분 ${s}초`;
}

function parseConfig(raw: Record<string, unknown>): BroadcastMissionConfig {
  const dur =
    typeof raw.duration_sec === "number" && raw.duration_sec > 0
      ? Math.min(
          MAX_DURATION,
          Math.max(MIN_DURATION, Math.floor(raw.duration_sec))
        )
      : DEFAULT_DURATION;
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  const kindRaw =
    typeof raw.submission_kind === "string" ? raw.submission_kind : "";
  const submission_kind: SubmissionKind = kindRaw === "TEXT" ? "TEXT" : "PHOTO";
  return {
    duration_sec: dur,
    prompt,
    submission_kind,
  };
}

export function BroadcastMissionEditor({ mission }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const kindMeta = MISSION_KIND_META[mission.kind];

  const initialConfig = useMemo(
    () => parseConfig((mission.config_json ?? {}) as Record<string, unknown>),
    [mission.config_json]
  );

  const [title, setTitle] = useState(mission.title);
  const [description, setDescription] = useState(mission.description ?? "");
  const [icon, setIcon] = useState(mission.icon ?? kindMeta.icon);
  const [defaultAcorns, setDefaultAcorns] = useState(
    String(mission.default_acorns ?? 0)
  );
  const [visibility, setVisibility] = useState<MissionVisibility>(
    mission.visibility
  );

  const [prompt, setPrompt] = useState(initialConfig.prompt);
  const [durationSec, setDurationSec] = useState(
    String(initialConfig.duration_sec)
  );
  const [submissionKind, setSubmissionKind] = useState<SubmissionKind>(
    initialConfig.submission_kind
  );

  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  function markDirty() {
    setDirty(true);
    setMsg(null);
  }

  function buildConfig(): Record<string, unknown> {
    const dur = Math.min(
      MAX_DURATION,
      Math.max(MIN_DURATION, parseInt(durationSec, 10) || DEFAULT_DURATION)
    );
    return {
      duration_sec: dur,
      prompt: prompt.trim(),
      submission_kind: submissionKind,
    };
  }

  function validate(): string | null {
    if (!title.trim()) return "제목을 입력해 주세요";
    const acornsNum = parseInt(defaultAcorns, 10);
    if (Number.isNaN(acornsNum) || acornsNum < 0 || acornsNum > 20) {
      return "기본 도토리는 0~20 사이 숫자여야 해요";
    }
    if (prompt.trim().length < MIN_PROMPT) {
      return `방송 문구는 최소 ${MIN_PROMPT}자 이상 입력해 주세요`;
    }
    const dur = parseInt(durationSec, 10);
    if (!Number.isFinite(dur) || dur < MIN_DURATION || dur > MAX_DURATION) {
      return `제한 시간은 ${MIN_DURATION}~${MAX_DURATION}초 사이여야 해요`;
    }
    if (submissionKind !== "PHOTO" && submissionKind !== "TEXT") {
      return "제출 방식을 선택해 주세요";
    }
    return null;
  }

  function onSave(publish = false) {
    const err = validate();
    if (err) {
      setMsg({ kind: "error", text: err });
      return;
    }
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("description", description.trim());
    fd.set("icon", icon.trim());
    fd.set("default_acorns", defaultAcorns);
    fd.set("visibility", visibility);
    fd.set("config_json", JSON.stringify(buildConfig()));

    startTransition(async () => {
      try {
        await updatePartnerMissionAction(mission.id, fd);
        if (publish) {
          await publishMissionAction(mission.id);
          setMsg({ kind: "ok", text: "게시했어요!" });
        } else {
          setMsg({ kind: "ok", text: "저장했어요." });
        }
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

  function onArchive() {
    if (!window.confirm("이 미션을 보관할까요?")) return;
    startTransition(async () => {
      try {
        await archiveMissionAction(mission.id);
        setMsg({ kind: "ok", text: "보관했어요." });
        router.refresh();
      } catch (e) {
        setMsg({
          kind: "error",
          text: e instanceof Error ? e.message : "보관 실패",
        });
      }
    });
  }

  function onDelete() {
    if (!window.confirm("정말 삭제할까요?")) return;
    startTransition(async () => {
      try {
        await deleteMissionAction(mission.id);
      } catch (e) {
        setMsg({
          kind: "error",
          text: e instanceof Error ? e.message : "삭제 실패",
        });
      }
    });
  }

  const durNum = parseInt(durationSec, 10);
  const durDisplay = Number.isFinite(durNum)
    ? formatDuration(Math.min(MAX_DURATION, Math.max(MIN_DURATION, durNum)))
    : formatDuration(DEFAULT_DURATION);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
      <div className="space-y-6">
        {(dirty || msg) && (
          <div
            role="status"
            className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
              msg?.kind === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : msg?.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {msg ? msg.text : "* 변경사항이 있어요. 저장을 눌러주세요."}
          </div>
        )}

        {/* 기본 정보 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>📝</span>
            <span>기본 정보</span>
          </h2>
          <div className="space-y-4">
            <Field label="제목" htmlFor="title" required>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  markDirty();
                }}
                placeholder="예) 토리의 깜짝 도토리 방송"
                className={inputCls}
                autoComplete="off"
                required
              />
            </Field>

            <Field label="설명 (선택)" htmlFor="description">
              <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  markDirty();
                }}
                placeholder="기관 운영자가 직접 발동하는 깜짝 미션이에요. 설정한 시간 안에 참여하면 즉시 도토리를 받아요."
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="아이콘 (이모지)" htmlFor="icon">
                <input
                  id="icon"
                  type="text"
                  value={icon}
                  onChange={(e) => {
                    setIcon(e.target.value);
                    markDirty();
                  }}
                  placeholder="⚡"
                  maxLength={4}
                  className={inputCls}
                />
              </Field>
              <Field label="기본 도토리 (0~20)" htmlFor="default_acorns">
                <input
                  id="default_acorns"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20}
                  value={defaultAcorns}
                  onChange={(e) => {
                    setDefaultAcorns(e.target.value);
                    markDirty();
                  }}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="공개 범위" htmlFor="visibility">
              <select
                id="visibility"
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.target.value as MissionVisibility);
                  markDirty();
                }}
                className={inputCls}
              >
                {VISIBILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                {VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.hint}
              </p>
            </Field>
          </div>
        </section>

        {/* Broadcast config */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>⚡</span>
            <span>돌발 미션 설정</span>
          </h2>
          <p className="mb-4 rounded-lg bg-[#F5F1E8] px-3 py-2 text-[11px] text-[#6B6560]">
            기관 운영자가 직접 발동하는 깜짝 미션이에요. 설정한 시간 안에
            참여하면 즉시 도토리를 받아요.
          </p>

          <div className="space-y-4">
            <Field label="방송 문구 (prompt)" htmlFor="prompt" required>
              <textarea
                id="prompt"
                rows={3}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  markDirty();
                }}
                placeholder="예) 🚨 긴급! 토리가 보너스 도토리를 숨겼어요! 지금 노을을 찍어 올려주세요"
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                운영자가 발동하면 참가자 화면에 큰 배너로 뜨는 문구예요.
              </p>
            </Field>

            <Field
              label={`제한 시간 (${MIN_DURATION}~${MAX_DURATION}초)`}
              htmlFor="duration_sec"
            >
              <input
                id="duration_sec"
                type="number"
                inputMode="numeric"
                min={MIN_DURATION}
                max={MAX_DURATION}
                value={durationSec}
                onChange={(e) => {
                  setDurationSec(e.target.value);
                  markDirty();
                }}
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                남은 시간 표시용이에요. 현재 설정: <b>{durDisplay}</b>. 기본 5분
                (300초).
              </p>
            </Field>

            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-[#2D5A3D]">
                제출 방식 <span className="text-rose-600">*</span>
              </legend>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {SUBMISSION_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className={`cursor-pointer rounded-xl border p-3 transition ${
                      submissionKind === o.value
                        ? "border-[#2D5A3D] bg-[#E8F0E4]"
                        : "border-[#D4E4BC] bg-white hover:border-[#2D5A3D]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="submission_kind"
                      value={o.value}
                      checked={submissionKind === o.value}
                      onChange={() => {
                        setSubmissionKind(o.value);
                        markDirty();
                      }}
                      className="sr-only"
                    />
                    <p className="text-sm font-bold text-[#2D5A3D]">
                      {o.label}
                    </p>
                    <p className="text-[11px] text-[#6B6560]">{o.hint}</p>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </section>
      </div>

      {/* Right */}
      <aside className="space-y-4">
        <div className="sticky top-4 space-y-4">
          <section className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-[#8B6F47]">
              👀 발동 시 참가자에게 이렇게 보여요
            </p>
            <div className="mt-3 rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden>
                  {icon || kindMeta.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#2C2C2C]">
                    {title || "(제목 없음)"}
                  </p>
                  <p className="text-[10px] text-[#6B6560]">
                    ⚡ 돌발 미션 · <AcornIcon size={12} /> +{defaultAcorns || 0}
                  </p>
                </div>
              </div>
              {prompt && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-white p-2">
                  <p className="text-[10px] font-semibold text-amber-800">
                    방송 문구
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-[#2C2C2C]">
                    {prompt}
                  </p>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-100/60 px-2 py-2">
                <span className="text-[10px] font-semibold text-amber-900">
                  ⏱ 남은 시간
                </span>
                <span className="font-mono text-sm font-bold text-amber-900">
                  {durDisplay}
                </span>
              </div>
              <div className="mt-2 rounded-lg border border-[#D4E4BC] bg-white p-2">
                <p className="text-[10px] font-semibold text-[#8B6F47]">
                  제출 방식
                </p>
                <p className="mt-0.5 text-xs text-[#2C2C2C]">
                  {
                    SUBMISSION_OPTIONS.find((o) => o.value === submissionKind)
                      ?.label
                  }
                </p>
              </div>
            </div>
          </section>

          <section className="sticky top-4 rounded-2xl border border-[#D4E4BC] bg-white/95 p-4 shadow-sm backdrop-blur">
            {msg && (
              <div
                role="status"
                className={`mb-3 rounded-xl border-2 px-3 py-2.5 text-center text-sm font-bold ${
                  msg.kind === "error"
                    ? "border-rose-400 bg-rose-50 text-rose-800"
                    : "border-emerald-400 bg-emerald-50 text-emerald-800"
                }`}
              >
                {msg.kind === "ok" ? "✅ " : "⚠️ "}
                {msg.text}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSave(false)}
                disabled={isPending}
                className="rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-50"
              >
                {isPending ? "💾 저장 중..." : "💾 저장(초안)"}
              </button>
              <button
                type="button"
                onClick={() => onSave(true)}
                disabled={isPending}
                className="rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-[#234a30] hover:to-[#2D5A3D] disabled:opacity-50"
              >
                {isPending ? "🚀 게시 중..." : "🚀 저장 & 게시"}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onArchive}
                disabled={isPending}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                📦 보관
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={isPending}
                className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
              >
                🗑 삭제
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30";

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-semibold text-[#2D5A3D]"
      >
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      {children}
    </div>
  );
}
