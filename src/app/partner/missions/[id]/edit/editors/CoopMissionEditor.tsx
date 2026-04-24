"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MISSION_KIND_META,
  type PartnerMissionRow,
  type CoopMissionConfig,
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

const MIN_WINDOW = 5;
const MAX_WINDOW = 120;
const DEFAULT_WINDOW = 30;
const DEFAULT_GROUP_SIZE = 2;

type CompletionRule = CoopMissionConfig["completion_rule"];

const COMPLETION_OPTIONS: Array<{
  value: CompletionRule;
  label: string;
  hint: string;
}> = [
  {
    value: "BOTH_CONFIRM",
    label: "✅ 양쪽 각자 완료",
    hint: "두 가족이 각자 완료 버튼을 누르면 완성돼요.",
  },
  {
    value: "SHARED_PHOTO",
    label: "📸 함께 찍은 사진 공유",
    hint: "함께 찍은 사진 1장을 공유하면 완성돼요.",
  },
];

function parseConfig(raw: Record<string, unknown>): CoopMissionConfig {
  const gs =
    typeof raw.group_size === "number" && raw.group_size >= 2
      ? Math.floor(raw.group_size)
      : DEFAULT_GROUP_SIZE;
  const mw =
    typeof raw.match_window_min === "number" && raw.match_window_min > 0
      ? Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, Math.floor(raw.match_window_min)))
      : DEFAULT_WINDOW;
  const ruleRaw =
    typeof raw.completion_rule === "string" ? raw.completion_rule : "";
  const completion_rule: CompletionRule =
    ruleRaw === "SHARED_PHOTO" ? "SHARED_PHOTO" : "BOTH_CONFIRM";
  return {
    group_size: gs,
    match_window_min: mw,
    completion_rule,
  };
}

export function CoopMissionEditor({ mission }: Props) {
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

  // MVP: group_size 는 2 고정
  const [groupSize] = useState(String(initialConfig.group_size));
  const [matchWindow, setMatchWindow] = useState(
    String(initialConfig.match_window_min)
  );
  const [completionRule, setCompletionRule] = useState<CompletionRule>(
    initialConfig.completion_rule
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
    const mw = Math.min(
      MAX_WINDOW,
      Math.max(MIN_WINDOW, parseInt(matchWindow, 10) || DEFAULT_WINDOW)
    );
    return {
      group_size: DEFAULT_GROUP_SIZE,
      match_window_min: mw,
      completion_rule: completionRule,
    };
  }

  function validate(): string | null {
    if (!title.trim()) return "제목을 입력해 주세요";
    const acornsNum = parseInt(defaultAcorns, 10);
    if (Number.isNaN(acornsNum) || acornsNum < 0 || acornsNum > 20) {
      return "기본 도토리는 0~20 사이 숫자여야 해요";
    }
    const mw = parseInt(matchWindow, 10);
    if (!Number.isFinite(mw) || mw < MIN_WINDOW || mw > MAX_WINDOW) {
      return `매칭 유효 시간은 ${MIN_WINDOW}~${MAX_WINDOW}분 사이여야 해요`;
    }
    if (
      completionRule !== "BOTH_CONFIRM" &&
      completionRule !== "SHARED_PHOTO"
    ) {
      return "완성 조건을 선택해 주세요";
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

  const completionHint =
    COMPLETION_OPTIONS.find((o) => o.value === completionRule)?.hint ?? "";

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
                placeholder="예) 두 가족이 함께 도토리 굴리기"
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
                placeholder="두 가족이 6자리 코드로 매칭되어 함께 수행해요. 양쪽이 모두 완료해야 도토리가 지급됩니다."
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
                  placeholder="🤝"
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

        {/* Coop config */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🤝</span>
            <span>협동 미션 설정</span>
          </h2>
          <p className="mb-4 rounded-lg bg-[#F5F1E8] px-3 py-2 text-[11px] text-[#6B6560]">
            두 가족이 6자리 코드로 매칭되어 함께 수행해요. 양쪽이 모두 완료해야
            도토리가 지급됩니다.
          </p>

          <div className="space-y-4">
            <Field label="매칭 인원 (그룹 크기)" htmlFor="group_size">
              <input
                id="group_size"
                type="number"
                inputMode="numeric"
                value={groupSize}
                disabled
                readOnly
                className={`${inputCls} cursor-not-allowed bg-zinc-50 text-zinc-500`}
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                현재는 2가족만 지원해요. (추후 3~6가족 그룹 확장 예정)
              </p>
            </Field>

            <Field
              label={`페어 코드 유효 시간 (${MIN_WINDOW}~${MAX_WINDOW}분)`}
              htmlFor="match_window_min"
            >
              <input
                id="match_window_min"
                type="number"
                inputMode="numeric"
                min={MIN_WINDOW}
                max={MAX_WINDOW}
                value={matchWindow}
                onChange={(e) => {
                  setMatchWindow(e.target.value);
                  markDirty();
                }}
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                6자리 페어 코드가 유효한 시간이에요. 시간 내 짝꿍이 합류하지
                않으면 세션이 만료돼요. 기본 30분.
              </p>
            </Field>

            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-[#2D5A3D]">
                완성 조건 <span className="text-rose-600">*</span>
              </legend>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {COMPLETION_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className={`cursor-pointer rounded-xl border p-3 transition ${
                      completionRule === o.value
                        ? "border-[#2D5A3D] bg-[#E8F0E4]"
                        : "border-[#D4E4BC] bg-white hover:border-[#2D5A3D]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="completion_rule"
                      value={o.value}
                      checked={completionRule === o.value}
                      onChange={() => {
                        setCompletionRule(o.value);
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
              👀 기관이 복사해 쓸 때 이렇게 보여요
            </p>
            <div className="mt-3 rounded-xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden>
                  {icon || kindMeta.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#2C2C2C]">
                    {title || "(제목 없음)"}
                  </p>
                  <p className="text-[10px] text-[#6B6560]">
                    🤝 협동 미션 · <AcornIcon size={12} /> +{defaultAcorns || 0}
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] p-2">
                <p className="text-[10px] font-semibold text-[#8B6F47]">
                  페어 코드
                </p>
                <p className="mt-0.5 font-mono text-lg tracking-widest text-[#2D5A3D]">
                  ABC123
                </p>
                <p className="mt-1 text-[10px] text-[#6B6560]">
                  유효 시간 {matchWindow || DEFAULT_WINDOW}분
                </p>
              </div>
              <div className="mt-2 rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] p-2">
                <p className="text-[10px] font-semibold text-[#8B6F47]">
                  완성 조건
                </p>
                <p className="mt-0.5 text-xs text-[#2C2C2C]">
                  {completionHint}
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
