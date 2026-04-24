"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MISSION_KIND_META,
  type ApprovalMode,
  type OrgMissionRow,
  type TreasureMissionConfig,
  type TreasureUnlockMethod,
  type UnlockRule,
} from "@/lib/missions/types";
import {
  removeMissionFromPackAction,
  updateOrgMissionAction,
} from "../../../actions";
import { DeployFields, Field, inputCls, toLocalInput } from "./common-fields";
import { AcornIcon } from "@/components/acorn-icon";

type Props = {
  mission: OrgMissionRow;
  siblings: OrgMissionRow[];
};

type StepDraft = {
  _uid: string;
  hint_text: string;
  unlock_rule: TreasureUnlockMethod;
  answer: string;
};

function newUid(): string {
  return Math.random().toString(36).slice(2, 8);
}

function randomB62(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => (b % 62).toString(36).padStart(1, "0"))
    .join("");
}

function generateStepToken(): string {
  return `ts_${randomB62(10)}`;
}

function generateTreasureToken(): string {
  return `tr_${randomB62(12)}`;
}

function parseTreasureConfig(
  raw: Record<string, unknown>
): TreasureMissionConfig {
  let steps: TreasureMissionConfig["steps"] = [];
  if (Array.isArray(raw.steps)) {
    steps = raw.steps.flatMap((s) => {
      if (!s || typeof s !== "object") return [];
      const o = s as Record<string, unknown>;
      const orderRaw = typeof o.order === "number" ? o.order : Number(o.order);
      if (!Number.isFinite(orderRaw)) return [];
      const hint_text = typeof o.hint_text === "string" ? o.hint_text : "";
      const urRaw = typeof o.unlock_rule === "string" ? o.unlock_rule : "AUTO";
      const unlock_rule: TreasureUnlockMethod =
        urRaw === "QR" || urRaw === "ANSWER" ? urRaw : "AUTO";
      const answer = typeof o.answer === "string" ? o.answer : undefined;
      return [
        {
          order: Math.floor(orderRaw),
          hint_text,
          unlock_rule,
          answer,
        },
      ];
    });
    steps.sort((a, b) => a.order - b.order);
  }
  const final_qr_token =
    typeof raw.final_qr_token === "string" ? raw.final_qr_token : "";
  return { steps, final_qr_token };
}

export function TreasureOrgMissionEditor({ mission, siblings }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const kindMeta = MISSION_KIND_META[mission.kind];

  const initialConfig = useMemo(
    () =>
      parseTreasureConfig(
        (mission.config_json ?? {}) as Record<string, unknown>
      ),
    [mission.config_json]
  );

  // 기본정보
  const [title, setTitle] = useState(mission.title);
  const [description, setDescription] = useState(mission.description ?? "");
  const [icon, setIcon] = useState(mission.icon ?? kindMeta.icon);
  const [acorns, setAcorns] = useState(String(mission.acorns ?? 0));

  // Steps
  const [steps, setSteps] = useState<StepDraft[]>(
    initialConfig.steps.length > 0
      ? initialConfig.steps.map((s) => ({
          _uid: newUid(),
          hint_text: s.hint_text,
          unlock_rule: s.unlock_rule,
          answer: s.answer ?? "",
        }))
      : [
          {
            _uid: newUid(),
            hint_text: "",
            unlock_rule: "AUTO",
            answer: "",
          },
        ]
  );
  const [finalQrToken, setFinalQrToken] = useState(
    initialConfig.final_qr_token
  );

  // 공통 배포 필드
  const [unlockRule, setUnlockRule] = useState<UnlockRule>(mission.unlock_rule);
  const [unlockThreshold, setUnlockThreshold] = useState(
    mission.unlock_threshold != null ? String(mission.unlock_threshold) : "10"
  );
  const [unlockPreviousId, setUnlockPreviousId] = useState(
    mission.unlock_previous_id ?? ""
  );
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(
    mission.approval_mode
  );
  const [startsAt, setStartsAt] = useState(toLocalInput(mission.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(mission.ends_at));
  const [isActive, setIsActive] = useState(mission.is_active);

  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null
  );

  function markDirty() {
    setDirty(true);
    setMsg(null);
  }

  function addStep() {
    setSteps([
      ...steps,
      { _uid: newUid(), hint_text: "", unlock_rule: "AUTO", answer: "" },
    ]);
    markDirty();
  }

  function removeStep(uid: string) {
    if (steps.length <= 1) return;
    setSteps(steps.filter((s) => s._uid !== uid));
    markDirty();
  }

  function updateStep(uid: string, patch: Partial<StepDraft>) {
    setSteps(steps.map((s) => (s._uid === uid ? { ...s, ...patch } : s)));
    markDirty();
  }

  function moveStep(uid: string, direction: "UP" | "DOWN") {
    const idx = steps.findIndex((s) => s._uid === uid);
    if (idx < 0) return;
    const neighbor = direction === "UP" ? idx - 1 : idx + 1;
    if (neighbor < 0 || neighbor >= steps.length) return;
    const next = [...steps];
    [next[idx], next[neighbor]] = [next[neighbor], next[idx]];
    setSteps(next);
    markDirty();
  }

  function randomizeStepAnswer(uid: string) {
    updateStep(uid, { answer: generateStepToken() });
  }

  function buildConfig(): Record<string, unknown> {
    const cleanSteps = steps.map((s, idx) => {
      const base: Record<string, unknown> = {
        order: idx,
        hint_text: s.hint_text.trim(),
        unlock_rule: s.unlock_rule,
      };
      if (s.unlock_rule === "QR" || s.unlock_rule === "ANSWER") {
        base.answer = s.answer.trim();
      }
      return base;
    });
    return {
      steps: cleanSteps,
      final_qr_token: finalQrToken.trim(),
    };
  }

  function validate(): string | null {
    if (!title.trim()) return "제목을 입력해 주세요";
    const n = parseInt(acorns, 10);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      return "도토리는 0~100 사이 숫자여야 해요";
    }
    if (steps.length === 0) return "최소 1개의 단계가 필요해요";
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (!s.hint_text.trim()) {
        return `${i + 1}단계의 힌트를 입력해 주세요`;
      }
      if (
        (s.unlock_rule === "QR" || s.unlock_rule === "ANSWER") &&
        !s.answer.trim()
      ) {
        return `${i + 1}단계의 ${
          s.unlock_rule === "QR" ? "QR 토큰" : "정답"
        }을 입력해 주세요`;
      }
    }
    if (!finalQrToken.trim()) {
      return "마지막 보물 QR 토큰을 생성해 주세요";
    }
    if (unlockRule === "SEQUENTIAL" && !unlockPreviousId) {
      return "순차 해금에는 선행 미션을 지정해 주세요";
    }
    return null;
  }

  function onSave() {
    const err = validate();
    if (err) {
      setMsg({ kind: "error", text: err });
      return;
    }
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("description", description.trim());
    fd.set("icon", icon.trim());
    fd.set("acorns", acorns);
    fd.set("config_json", JSON.stringify(buildConfig()));
    fd.set("unlock_rule", unlockRule);
    if (unlockRule === "TIER_GATE") fd.set("unlock_threshold", unlockThreshold);
    if (unlockRule === "SEQUENTIAL")
      fd.set("unlock_previous_id", unlockPreviousId);
    fd.set("approval_mode", approvalMode);
    fd.set("starts_at", startsAt);
    fd.set("ends_at", endsAt);
    fd.set("is_active", isActive ? "true" : "false");

    startTransition(async () => {
      try {
        await updateOrgMissionAction(mission.id, fd);
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

  function onRemove() {
    if (
      !window.confirm(
        "이 미션을 스탬프북에서 제거할까요? 편집 내용도 모두 사라집니다."
      )
    )
      return;
    startTransition(async () => {
      try {
        await removeMissionFromPackAction(mission.id);
      } catch (e) {
        setMsg({
          kind: "error",
          text: e instanceof Error ? e.message : "삭제 실패",
        });
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
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
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
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
                className={inputCls}
                autoComplete="off"
                required
              />
            </Field>
            <Field label="설명" htmlFor="description">
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
                  maxLength={4}
                  className={inputCls}
                />
              </Field>
              <Field label="도토리 (0~100)" htmlFor="acorns">
                <input
                  id="acorns"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={acorns}
                  onChange={(e) => {
                    setAcorns(e.target.value);
                    markDirty();
                  }}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
              <span aria-hidden>🗺</span>
              <span>보물찾기 단계</span>
            </h2>
            <button
              type="button"
              onClick={addStep}
              className="inline-flex items-center gap-1 rounded-xl border border-[#2D5A3D] bg-white px-3 py-1.5 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
            >
              + 단계 추가
            </button>
          </div>
          <ul className="space-y-3">
            {steps.map((s, idx) => (
              <li
                key={s._uid}
                className="rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-[#8B6F47]">
                    단계 {idx + 1}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveStep(s._uid, "UP")}
                      disabled={idx === 0}
                      aria-label="단계 위로"
                      className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-0.5 text-xs font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(s._uid, "DOWN")}
                      disabled={idx === steps.length - 1}
                      aria-label="단계 아래로"
                      className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-0.5 text-xs font-semibold text-[#2D5A3D] transition hover:bg-[#F5F1E8] disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStep(s._uid)}
                      disabled={steps.length <= 1}
                      aria-label="단계 삭제"
                      className="rounded-lg border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-30"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <div className="mt-2 space-y-3">
                  <Field label="힌트 문구" htmlFor={`hint-${s._uid}`} required>
                    <textarea
                      id={`hint-${s._uid}`}
                      rows={2}
                      value={s.hint_text}
                      onChange={(e) =>
                        updateStep(s._uid, { hint_text: e.target.value })
                      }
                      placeholder="예) 가장 큰 나무를 찾아보세요"
                      className={inputCls}
                    />
                  </Field>

                  <fieldset>
                    <legend className="mb-1.5 text-xs font-semibold text-[#2D5A3D]">
                      해금 방식
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { value: "AUTO", label: "자동 진행", icon: "➡️" },
                          { value: "QR", label: "QR 스캔", icon: "🔲" },
                          { value: "ANSWER", label: "정답 입력", icon: "✏️" },
                        ] as Array<{
                          value: TreasureUnlockMethod;
                          label: string;
                          icon: string;
                        }>
                      ).map((o) => (
                        <label
                          key={o.value}
                          className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            s.unlock_rule === o.value
                              ? "border-[#2D5A3D] bg-[#2D5A3D] text-white"
                              : "border-[#D4E4BC] bg-white text-[#6B6560] hover:border-[#2D5A3D]"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`ur-${s._uid}`}
                            value={o.value}
                            checked={s.unlock_rule === o.value}
                            onChange={() =>
                              updateStep(s._uid, { unlock_rule: o.value })
                            }
                            className="sr-only"
                          />
                          <span aria-hidden>{o.icon}</span>
                          <span>{o.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {(s.unlock_rule === "QR" || s.unlock_rule === "ANSWER") && (
                    <Field
                      label={
                        s.unlock_rule === "QR" ? "QR 토큰" : "정답"
                      }
                      htmlFor={`answer-${s._uid}`}
                      required
                    >
                      <div className="flex gap-2">
                        <input
                          id={`answer-${s._uid}`}
                          type="text"
                          value={s.answer}
                          onChange={(e) =>
                            updateStep(s._uid, { answer: e.target.value })
                          }
                          placeholder={
                            s.unlock_rule === "QR"
                              ? "ts_..."
                              : "예) 참나무"
                          }
                          className={inputCls + " font-mono"}
                          autoComplete="off"
                        />
                        {s.unlock_rule === "QR" && (
                          <button
                            type="button"
                            onClick={() => randomizeStepAnswer(s._uid)}
                            className="shrink-0 rounded-xl border border-[#2D5A3D] bg-white px-3 py-2 text-xs font-bold text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
                          >
                            🎲 생성
                          </button>
                        )}
                      </div>
                    </Field>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Final QR */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span aria-hidden>🏆</span>
            <span>최종 보물 QR</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={finalQrToken}
              readOnly
              placeholder="아직 생성되지 않았어요"
              aria-label="최종 보물 QR 토큰"
              className="min-w-0 flex-1 rounded-xl border border-[#D4E4BC] bg-[#F5F1E8] px-3 py-2.5 font-mono text-xs text-[#2C2C2C]"
            />
            <button
              type="button"
              onClick={() => {
                setFinalQrToken(generateTreasureToken());
                markDirty();
              }}
              className="rounded-xl border border-[#2D5A3D] bg-[#2D5A3D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#234a30]"
            >
              🎲 토큰 생성
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#8B7F75]">
            보물 장소에 부착할 QR 코드에 들어갈 토큰이에요. (ts_/tr_ 접두사)
          </p>
        </section>

        <DeployFields
          unlockRule={unlockRule}
          setUnlockRule={setUnlockRule}
          unlockThreshold={unlockThreshold}
          setUnlockThreshold={setUnlockThreshold}
          unlockPreviousId={unlockPreviousId}
          setUnlockPreviousId={setUnlockPreviousId}
          approvalMode={approvalMode}
          setApprovalMode={setApprovalMode}
          startsAt={startsAt}
          setStartsAt={setStartsAt}
          endsAt={endsAt}
          setEndsAt={setEndsAt}
          isActive={isActive}
          setIsActive={setIsActive}
          siblings={siblings}
          missionId={mission.id}
          markDirty={markDirty}
        />
      </div>

      {/* Right */}
      <aside className="space-y-4">
        <div className="sticky top-4 space-y-4">
          <section className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-[#8B6F47]">
              👀 참가자에게는 이렇게 보여요
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
                    🗺 보물찾기 {steps.length}단계 · <AcornIcon size={12} /> +{acorns || 0}
                  </p>
                </div>
              </div>
              <ol className="mt-3 space-y-1.5">
                {steps.map((s, idx) => (
                  <li
                    key={s._uid}
                    className="rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] p-2 text-[11px]"
                  >
                    <p className="font-semibold text-[#2D5A3D]">
                      {idx + 1}. {s.hint_text || "(힌트 입력 전)"}
                    </p>
                    <p className="text-[10px] text-[#8B7F75]">
                      해금:{" "}
                      {s.unlock_rule === "AUTO"
                        ? "자동"
                        : s.unlock_rule === "QR"
                          ? "QR"
                          : "정답"}
                    </p>
                  </li>
                ))}
              </ol>
              {finalQrToken && (
                <p className="mt-2 break-all rounded-lg bg-[#F5F1E8] p-2 font-mono text-[10px] text-[#6B6560]">
                  🏆 {finalQrToken}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#D4E4BC] bg-white/95 p-4 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={onSave}
              disabled={isPending}
              className="w-full rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-[#234a30] hover:to-[#2D5A3D] disabled:opacity-50"
            >
              💾 저장
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled
                title="Phase 4에서 활성화"
                className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#6B6560] opacity-60"
              >
                💌 개선 제안
              </button>
              <button
                type="button"
                onClick={onRemove}
                disabled={isPending}
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
              >
                🗑 제거
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
