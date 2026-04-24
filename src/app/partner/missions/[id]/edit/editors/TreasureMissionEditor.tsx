"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MISSION_KIND_META,
  type PartnerMissionRow,
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

type UnlockRule = "AUTO" | "QR" | "ANSWER";

type StepDraft = {
  _uid: string;
  hint_text: string;
  unlock_rule: UnlockRule;
  answer: string; // QR token or text answer (unused for AUTO)
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

const MIN_STEPS = 2;
const MAX_STEPS = 10;

function newUid(): string {
  return Math.random().toString(36).slice(2, 8);
}

function generateToken(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const b62 = Array.from(bytes)
    .map((b) => (b % 62).toString(36))
    .join("");
  return `${prefix}_${b62}`;
}

function parseConfig(raw: Record<string, unknown>): {
  steps: StepDraft[];
  final_qr_token: string;
} {
  let steps: StepDraft[] = [];
  if (Array.isArray(raw.steps)) {
    steps = raw.steps.flatMap((s) => {
      if (!s || typeof s !== "object") return [];
      const o = s as Record<string, unknown>;
      const hint_text = typeof o.hint_text === "string" ? o.hint_text : "";
      const ruleRaw = typeof o.unlock_rule === "string" ? o.unlock_rule : "AUTO";
      const unlock_rule: UnlockRule =
        ruleRaw === "QR" || ruleRaw === "ANSWER" ? ruleRaw : "AUTO";
      const answer = typeof o.answer === "string" ? o.answer : "";
      return [{ _uid: newUid(), hint_text, unlock_rule, answer }];
    });
  }
  if (steps.length < MIN_STEPS) {
    while (steps.length < MIN_STEPS) {
      steps.push({
        _uid: newUid(),
        hint_text: "",
        unlock_rule: "AUTO",
        answer: "",
      });
    }
  }
  const final_qr_token =
    typeof raw.final_qr_token === "string" ? raw.final_qr_token : "";
  return { steps, final_qr_token };
}

export function TreasureMissionEditor({ mission }: Props) {
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

  const [steps, setSteps] = useState<StepDraft[]>(initialConfig.steps);
  const [finalQrToken, setFinalQrToken] = useState(initialConfig.final_qr_token);

  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  function markDirty() {
    setDirty(true);
    setMsg(null);
  }

  function addStep() {
    if (steps.length >= MAX_STEPS) return;
    setSteps([
      ...steps,
      { _uid: newUid(), hint_text: "", unlock_rule: "AUTO", answer: "" },
    ]);
    markDirty();
  }

  function removeStep(uid: string) {
    if (steps.length <= MIN_STEPS) return;
    setSteps(steps.filter((s) => s._uid !== uid));
    markDirty();
  }

  function moveStep(uid: string, dir: -1 | 1) {
    const idx = steps.findIndex((s) => s._uid === uid);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= steps.length) return;
    const copy = [...steps];
    const [item] = copy.splice(idx, 1);
    copy.splice(next, 0, item);
    setSteps(copy);
    markDirty();
  }

  function updateStep(uid: string, patch: Partial<StepDraft>) {
    setSteps(
      steps.map((s) => {
        if (s._uid !== uid) return s;
        const next = { ...s, ...patch };
        // Rule 변경 시 answer 초기화(QR은 토큰 재생성, ANSWER는 비움, AUTO는 비움)
        if (patch.unlock_rule && patch.unlock_rule !== s.unlock_rule) {
          if (patch.unlock_rule === "QR") {
            next.answer = generateToken("ts");
          } else {
            next.answer = "";
          }
        }
        return next;
      })
    );
    markDirty();
  }

  function regenStepQr(uid: string) {
    setSteps(
      steps.map((s) =>
        s._uid === uid ? { ...s, answer: generateToken("ts") } : s
      )
    );
    markDirty();
  }

  function regenFinalQr() {
    setFinalQrToken(generateToken("tr"));
    markDirty();
  }

  function buildConfig(): Record<string, unknown> {
    const cleanSteps = steps.map((s, idx) => {
      const entry: Record<string, unknown> = {
        order: idx + 1,
        hint_text: s.hint_text.trim(),
        unlock_rule: s.unlock_rule,
      };
      if (s.unlock_rule !== "AUTO" && s.answer.trim()) {
        entry.answer = s.answer.trim();
      }
      return entry;
    });
    return {
      steps: cleanSteps,
      final_qr_token: finalQrToken.trim(),
    };
  }

  function validate(): string | null {
    if (!title.trim()) return "제목을 입력해 주세요";
    const acornsNum = parseInt(defaultAcorns, 10);
    if (Number.isNaN(acornsNum) || acornsNum < 0 || acornsNum > 20) {
      return "기본 도토리는 0~20 사이 숫자여야 해요";
    }
    if (steps.length < MIN_STEPS) {
      return `최소 ${MIN_STEPS}단계가 필요해요`;
    }
    if (steps.length > MAX_STEPS) {
      return `최대 ${MAX_STEPS}단계까지 만들 수 있어요`;
    }
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (!s.hint_text.trim()) {
        return `${i + 1}단계 힌트 텍스트를 입력해 주세요`;
      }
      if (s.unlock_rule === "QR" && !s.answer.trim()) {
        return `${i + 1}단계 QR 토큰을 생성해 주세요`;
      }
      if (s.unlock_rule === "ANSWER" && !s.answer.trim()) {
        return `${i + 1}단계 정답을 입력해 주세요`;
      }
    }
    if (!finalQrToken.trim()) {
      return "최종 QR 토큰을 생성해 주세요";
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
                placeholder="예) 숲속 보물찾기"
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
                placeholder="어떤 미션인지 기관 담당자에게 알려주세요"
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
                  placeholder="🗺"
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

        {/* Steps */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
              <span aria-hidden>🗺</span>
              <span>보물찾기 단계 ({steps.length})</span>
            </h2>
            <button
              type="button"
              onClick={addStep}
              disabled={steps.length >= MAX_STEPS}
              className="inline-flex items-center gap-1 rounded-xl border border-[#2D5A3D] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-40"
            >
              + 단계 추가
            </button>
          </div>
          <p className="mb-4 rounded-lg bg-[#F5F1E8] px-3 py-2 text-[11px] text-[#6B6560]">
            각 단계별 힌트를 설정하세요. 마지막에 최종 QR 스캔으로 완주 확정됩니다.
            (최소 {MIN_STEPS}단계, 최대 {MAX_STEPS}단계)
          </p>

          <ul className="space-y-3">
            {steps.map((s, idx) => (
              <li
                key={s._uid}
                className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-[#8B6F47]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8F0E4] text-[#2D5A3D]">
                      {idx + 1}
                    </span>
                    <span>단계</span>
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveStep(s._uid, -1)}
                      disabled={idx === 0}
                      aria-label="위로 이동"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4E4BC] bg-white text-xs text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(s._uid, 1)}
                      disabled={idx === steps.length - 1}
                      aria-label="아래로 이동"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4E4BC] bg-white text-xs text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStep(s._uid)}
                      disabled={steps.length <= MIN_STEPS}
                      aria-label="단계 삭제"
                      className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-30"
                    >
                      삭제
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  <Field label="힌트 텍스트" htmlFor={`hint-${s._uid}`} required>
                    <textarea
                      id={`hint-${s._uid}`}
                      rows={2}
                      value={s.hint_text}
                      onChange={(e) =>
                        updateStep(s._uid, { hint_text: e.target.value })
                      }
                      placeholder="예) 큰 소나무 뒤를 살펴봐!"
                      className={inputCls}
                    />
                  </Field>

                  <fieldset>
                    <legend className="mb-1.5 text-xs font-semibold text-[#2D5A3D]">
                      해제 방식
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { v: "AUTO" as const, label: "자동" },
                          { v: "QR" as const, label: "QR 스캔" },
                          { v: "ANSWER" as const, label: "정답 입력" },
                        ]
                      ).map((o) => (
                        <label
                          key={o.v}
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            s.unlock_rule === o.v
                              ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                              : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D]"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`rule-${s._uid}`}
                            value={o.v}
                            checked={s.unlock_rule === o.v}
                            onChange={() =>
                              updateStep(s._uid, { unlock_rule: o.v })
                            }
                            className="sr-only"
                          />
                          <span>{o.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {s.unlock_rule === "AUTO" && (
                    <p className="rounded-lg bg-[#F5F1E8] p-2 text-[11px] text-[#6B6560]">
                      이전 단계 해제 후 자동으로 열려요.
                    </p>
                  )}
                  {s.unlock_rule === "QR" && (
                    <Field label="QR 토큰" htmlFor={`qr-${s._uid}`} required>
                      <div className="flex gap-2">
                        <input
                          id={`qr-${s._uid}`}
                          type="text"
                          value={s.answer}
                          readOnly
                          placeholder="토큰을 생성해 주세요"
                          className="min-w-0 flex-1 rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] px-3 py-2 font-mono text-xs text-[#2C2C2C]"
                        />
                        <button
                          type="button"
                          onClick={() => regenStepQr(s._uid)}
                          className="rounded-xl border border-[#2D5A3D] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
                        >
                          🔄 재생성
                        </button>
                      </div>
                    </Field>
                  )}
                  {s.unlock_rule === "ANSWER" && (
                    <Field label="정답" htmlFor={`ans-${s._uid}`} required>
                      <input
                        id={`ans-${s._uid}`}
                        type="text"
                        value={s.answer}
                        onChange={(e) =>
                          updateStep(s._uid, { answer: e.target.value })
                        }
                        placeholder="숲에서 풀어야 할 정답"
                        className={inputCls}
                        autoComplete="off"
                      />
                    </Field>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Final QR */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🏁</span>
            <span>최종 QR 토큰</span>
          </h2>
          <p className="mb-3 text-[11px] text-[#6B6560]">
            모든 단계를 해제한 뒤 이 QR을 스캔하면 미션 완주로 기록돼요.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={finalQrToken}
              readOnly
              placeholder="최종 QR 토큰을 생성해 주세요"
              aria-label="최종 QR 토큰"
              className="min-w-0 flex-1 rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] px-3 py-2.5 font-mono text-xs text-[#2C2C2C]"
            />
            <button
              type="button"
              onClick={regenFinalQr}
              className="rounded-xl border border-[#2D5A3D] bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#234a30]"
            >
              🔄 재생성
            </button>
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
                    🗺 보물찾기 · {steps.length}단계 · <AcornIcon size={12} /> +{defaultAcorns || 0}
                  </p>
                </div>
              </div>
              <ol className="mt-3 space-y-1.5">
                {steps.map((s, idx) => (
                  <li
                    key={s._uid}
                    className="rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] p-2"
                  >
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2D5A3D]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E8F0E4]">
                        {idx + 1}
                      </span>
                      <span>
                        {s.unlock_rule === "AUTO"
                          ? "자동"
                          : s.unlock_rule === "QR"
                          ? "QR 스캔"
                          : "정답 입력"}
                      </span>
                    </p>
                    {s.hint_text && (
                      <p className="mt-1 text-[11px] text-[#6B6560]">
                        {s.hint_text}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
              {finalQrToken && (
                <p className="mt-3 break-all rounded-lg bg-[#F5F1E8] p-2 font-mono text-[10px] text-[#6B6560]">
                  🏁 {finalQrToken}
                </p>
              )}
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

