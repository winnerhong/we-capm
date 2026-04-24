"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MISSION_KIND_META,
  type PartnerMissionRow,
  type QrQuizMissionConfig,
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

type QuizType = "MCQ" | "SHORT" | "NONE";

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

function generateQrToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const b62 = Array.from(bytes)
    .map((b) => (b % 62).toString(36).padStart(1, "0"))
    .join("");
  return `mq_${b62}`;
}

function newChoiceId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function parseQrQuizConfig(raw: Record<string, unknown>): QrQuizMissionConfig {
  const qr_token = typeof raw.qr_token === "string" ? raw.qr_token : "";
  const qr_single_use =
    typeof raw.qr_single_use === "boolean" ? raw.qr_single_use : true;
  const quizTypeRaw =
    typeof raw.quiz_type === "string" ? raw.quiz_type : "NONE";
  const quiz_type: QuizType =
    quizTypeRaw === "MCQ" || quizTypeRaw === "SHORT"
      ? quizTypeRaw
      : "NONE";
  const quiz_text =
    typeof raw.quiz_text === "string" ? raw.quiz_text : undefined;
  const quiz_answer =
    typeof raw.quiz_answer === "string" ? raw.quiz_answer : undefined;
  const hint = typeof raw.hint === "string" ? raw.hint : undefined;
  let quiz_choices: Array<{ id: string; label: string }> | undefined;
  if (Array.isArray(raw.quiz_choices)) {
    quiz_choices = raw.quiz_choices.flatMap((c) => {
      if (!c || typeof c !== "object") return [];
      const o = c as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.label !== "string") return [];
      return [{ id: o.id, label: o.label }];
    });
  }
  return {
    qr_token,
    qr_single_use,
    quiz_type,
    quiz_text,
    quiz_choices,
    quiz_answer,
    hint,
  };
}

export function QrQuizMissionEditor({ mission }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const kindMeta = MISSION_KIND_META[mission.kind];

  const initialConfig = useMemo(
    () =>
      parseQrQuizConfig(
        (mission.config_json ?? {}) as Record<string, unknown>
      ),
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

  // QR
  const [qrToken, setQrToken] = useState(initialConfig.qr_token);
  const [qrSingleUse, setQrSingleUse] = useState(
    initialConfig.qr_single_use ?? true
  );

  // Quiz
  const [quizType, setQuizType] = useState<QuizType>(initialConfig.quiz_type);
  const [quizText, setQuizText] = useState(initialConfig.quiz_text ?? "");
  const [choices, setChoices] = useState<Array<{ id: string; label: string }>>(
    initialConfig.quiz_choices && initialConfig.quiz_choices.length > 0
      ? initialConfig.quiz_choices
      : [
          { id: newChoiceId(), label: "" },
          { id: newChoiceId(), label: "" },
        ]
  );
  const [quizAnswer, setQuizAnswer] = useState(initialConfig.quiz_answer ?? "");
  const [hint, setHint] = useState(initialConfig.hint ?? "");

  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  function markDirty() {
    setDirty(true);
    setMsg(null);
  }

  function onGenerateToken() {
    setQrToken(generateQrToken());
    markDirty();
  }

  function addChoice() {
    if (choices.length >= 5) return;
    setChoices([...choices, { id: newChoiceId(), label: "" }]);
    markDirty();
  }

  function removeChoice(id: string) {
    if (choices.length <= 2) return;
    setChoices(choices.filter((c) => c.id !== id));
    if (quizAnswer === id) setQuizAnswer("");
    markDirty();
  }

  function updateChoice(id: string, label: string) {
    setChoices(choices.map((c) => (c.id === id ? { ...c, label } : c)));
    markDirty();
  }

  function buildConfig(): Record<string, unknown> {
    const cfg: Record<string, unknown> = {
      qr_token: qrToken.trim(),
      qr_single_use: qrSingleUse,
      quiz_type: quizType,
    };
    if (quizType !== "NONE") {
      cfg.quiz_text = quizText.trim();
    }
    if (quizType === "MCQ") {
      cfg.quiz_choices = choices
        .map((c) => ({ id: c.id, label: c.label.trim() }))
        .filter((c) => c.label.length > 0);
      if (quizAnswer) cfg.quiz_answer = quizAnswer;
    } else if (quizType === "SHORT") {
      if (quizAnswer.trim()) cfg.quiz_answer = quizAnswer.trim();
    }
    if (hint.trim()) cfg.hint = hint.trim();
    return cfg;
  }

  function validate(): string | null {
    if (!title.trim()) return "제목을 입력해 주세요";
    const acornsNum = parseInt(defaultAcorns, 10);
    if (Number.isNaN(acornsNum) || acornsNum < 0 || acornsNum > 20) {
      return "기본 도토리는 0~20 사이 숫자여야 해요";
    }
    if (!qrToken.trim()) return "QR 토큰을 먼저 생성해 주세요";
    if (quizType !== "NONE" && !quizText.trim()) {
      return "퀴즈 문제 텍스트를 입력해 주세요";
    }
    if (quizType === "MCQ") {
      const filled = choices.filter((c) => c.label.trim()).length;
      if (filled < 2) return "객관식 보기는 최소 2개가 필요해요";
      if (!quizAnswer) return "객관식 정답을 선택해 주세요";
    }
    if (quizType === "SHORT") {
      if (!quizAnswer.trim()) return "단답형 정답을 입력해 주세요";
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

        {/* 기본정보 */}
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
                placeholder="예) 숲 속 QR 퀴즈"
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
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="아이콘" htmlFor="icon">
                <input
                  id="icon"
                  type="text"
                  value={icon}
                  onChange={(e) => {
                    setIcon(e.target.value);
                    markDirty();
                  }}
                  placeholder="🔲"
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
                {
                  VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.hint
                }
              </p>
            </Field>
          </div>
        </section>

        {/* QR */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🔲</span>
            <span>QR 토큰</span>
          </h2>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={qrToken}
                readOnly
                placeholder="아직 생성되지 않았어요"
                aria-label="QR 토큰"
                className="min-w-0 flex-1 rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] px-3 py-2.5 font-mono text-xs text-[#2C2C2C]"
              />
              <button
                type="button"
                onClick={onGenerateToken}
                className="rounded-xl border border-[#2D5A3D] bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#234a30]"
              >
                🎲 토큰 생성
              </button>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-[#2C2C2C]">
              <input
                type="checkbox"
                checked={qrSingleUse}
                onChange={(e) => {
                  setQrSingleUse(e.target.checked);
                  markDirty();
                }}
                className="h-4 w-4 rounded border-[#D4E4BC] text-[#2D5A3D] focus:ring-[#2D5A3D]"
              />
              <span>일회용 QR (한 번 스캔하면 재사용 불가)</span>
            </label>
          </div>
        </section>

        {/* Quiz */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>❓</span>
            <span>퀴즈</span>
          </h2>

          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-[#2D5A3D]">
                퀴즈 유형
              </legend>
              <div className="flex flex-wrap gap-2">
                {(["MCQ", "SHORT", "NONE"] as QuizType[]).map((t) => (
                  <label
                    key={t}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      quizType === t
                        ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                        : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quiz_type"
                      value={t}
                      checked={quizType === t}
                      onChange={() => {
                        setQuizType(t);
                        setQuizAnswer("");
                        markDirty();
                      }}
                      className="sr-only"
                    />
                    <span>
                      {t === "MCQ"
                        ? "객관식"
                        : t === "SHORT"
                        ? "단답형"
                        : "퀴즈 없음"}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {quizType !== "NONE" && (
              <Field label="문제 텍스트" htmlFor="quiz_text" required>
                <textarea
                  id="quiz_text"
                  rows={2}
                  value={quizText}
                  onChange={(e) => {
                    setQuizText(e.target.value);
                    markDirty();
                  }}
                  placeholder="예) 이 나무의 이름은 무엇일까요?"
                  className={inputCls}
                />
              </Field>
            )}

            {quizType === "MCQ" && (
              <div>
                <p className="mb-2 text-xs font-semibold text-[#2D5A3D]">
                  보기 (2~5개) <span className="text-rose-600">*</span>
                </p>
                <ul className="space-y-2">
                  {choices.map((c, idx) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#E8F0E4] text-xs font-bold text-[#2D5A3D]">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={c.label}
                        onChange={(e) => updateChoice(c.id, e.target.value)}
                        placeholder={`보기 ${idx + 1}`}
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={() => removeChoice(c.id)}
                        disabled={choices.length <= 2}
                        aria-label="보기 삭제"
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-rose-200 bg-white text-sm text-rose-700 transition hover:bg-rose-50 disabled:opacity-30"
                      >
                        −
                      </button>
                    </li>
                  ))}
                </ul>
                {choices.length < 5 && (
                  <button
                    type="button"
                    onClick={addChoice}
                    className="mt-2 inline-flex items-center gap-1 rounded-xl border border-dashed border-[#2D5A3D] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
                  >
                    + 보기 추가
                  </button>
                )}

                <div className="mt-4">
                  <Field label="정답 (보기 선택)" htmlFor="quiz_answer_mcq" required>
                    <select
                      id="quiz_answer_mcq"
                      value={quizAnswer}
                      onChange={(e) => {
                        setQuizAnswer(e.target.value);
                        markDirty();
                      }}
                      className={inputCls}
                    >
                      <option value="">(선택)</option>
                      {choices.map((c, idx) => (
                        <option key={c.id} value={c.id} disabled={!c.label.trim()}>
                          {idx + 1}. {c.label || "(비어있음)"}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            )}

            {quizType === "SHORT" && (
              <Field label="정답 (단답)" htmlFor="quiz_answer_short" required>
                <input
                  id="quiz_answer_short"
                  type="text"
                  value={quizAnswer}
                  onChange={(e) => {
                    setQuizAnswer(e.target.value);
                    markDirty();
                  }}
                  placeholder="정확한 답을 입력해 주세요"
                  className={inputCls}
                  autoComplete="off"
                />
              </Field>
            )}

            <Field label="힌트 (선택)" htmlFor="hint">
              <input
                id="hint"
                type="text"
                value={hint}
                onChange={(e) => {
                  setHint(e.target.value);
                  markDirty();
                }}
                placeholder="참여자가 어려워할 때 보여줄 한 줄"
                className={inputCls}
                autoComplete="off"
              />
            </Field>
          </div>
        </section>
      </div>

      {/* Right: preview + actions */}
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
                    🔲 QR 퀴즈 · <AcornIcon size={12} /> +{defaultAcorns || 0}
                  </p>
                </div>
              </div>
              {qrToken && (
                <p className="mt-3 break-all rounded-lg bg-[#F5F1E8] p-2 font-mono text-[10px] text-[#6B6560]">
                  {qrToken}
                </p>
              )}
              {quizType !== "NONE" && quizText && (
                <div className="mt-3 rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] p-3">
                  <p className="text-xs font-semibold text-[#2C2C2C]">
                    Q. {quizText}
                  </p>
                  {quizType === "MCQ" && (
                    <ul className="mt-2 space-y-1 text-[11px] text-[#6B6560]">
                      {choices
                        .filter((c) => c.label.trim())
                        .map((c, idx) => (
                          <li key={c.id}>
                            {idx + 1}. {c.label}
                          </li>
                        ))}
                    </ul>
                  )}
                  {hint && (
                    <p className="mt-2 text-[10px] text-[#8B7F75]">💡 {hint}</p>
                  )}
                </div>
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
