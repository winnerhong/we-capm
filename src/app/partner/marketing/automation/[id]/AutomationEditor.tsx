"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ACTION_TYPE_OPTIONS,
  TRIGGER_OPTIONS,
  type ActionType,
  type AutomationAction,
  type TriggerType,
} from "../types";
import { updateAutomationAction } from "../actions";

type Props = {
  id: string;
  initialName: string;
  initialTrigger: TriggerType;
  initialActions: AutomationAction[];
};

export default function AutomationEditor({
  id,
  initialName,
  initialTrigger,
  initialActions,
}: Props) {
  const [name, setName] = useState(initialName);
  const [trigger, setTrigger] = useState<TriggerType>(initialTrigger);
  const [actions, setActions] = useState<AutomationAction[]>(initialActions);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const actionsJson = useMemo(() => JSON.stringify(actions), [actions]);

  function addAction() {
    setActions((prev) => [
      ...prev,
      {
        type: "KAKAO",
        delayHours: prev.length === 0 ? 0 : 24,
        title: "",
        body: "",
      },
    ]);
  }

  function updateAction(index: number, patch: Partial<AutomationAction>) {
    setActions((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...patch } : a))
    );
  }

  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  function moveAction(index: number, dir: -1 | 1) {
    setActions((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    if (actions.length === 0) {
      setError("최소 1개 이상의 액션을 추가해 주세요");
      return;
    }
    for (const a of actions) {
      if (!a.body.trim()) {
        setError("모든 액션에 본문을 입력해 주세요");
        return;
      }
    }
    startTransition(async () => {
      try {
        await updateAutomationAction(id, formData);
        setSavedAt(new Date().toLocaleTimeString("ko-KR"));
      } catch (e) {
        if (e instanceof Error && !e.message.includes("NEXT_REDIRECT")) {
          setError(e.message);
        }
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <input type="hidden" name="actions" value={actionsJson} />
      <input type="hidden" name="trigger_type" value={trigger} />

      {/* 이름 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <label
          htmlFor="edit-name"
          className="mb-2 block text-sm font-bold text-[#2D5A3D]"
        >
          📝 시나리오 이름
        </label>
        <input
          id="edit-name"
          name="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] outline-none transition focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/30"
          autoComplete="off"
        />
      </section>

      {/* 트리거 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
          <span>⚡</span>
          <span>트리거</span>
        </h2>
        <div
          role="radiogroup"
          aria-label="트리거 선택"
          className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3"
        >
          {TRIGGER_OPTIONS.map((opt) => {
            const active = trigger === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTrigger(opt.key as TriggerType)}
                className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-[#2D5A3D] bg-[#E8F0E4] shadow-sm"
                    : "border-[#D4E4BC] bg-[#FFF8F0] hover:border-[#4A7C59] hover:bg-[#E8F0E4]"
                }`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[#2D5A3D]">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#6B6560]">
                    {opt.desc}
                  </span>
                </span>
                {active ? (
                  <span aria-hidden className="shrink-0 text-lg text-[#2D5A3D]">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {/* 액션 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span>💌</span>
            <span>액션</span>
            <span className="ml-1 rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[11px] font-semibold text-[#2D5A3D]">
              {actions.length}
            </span>
          </h2>
          <button
            type="button"
            onClick={addAction}
            className="inline-flex items-center gap-1 rounded-xl bg-[#2D5A3D] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3A7A52]"
          >
            ➕ 액션 추가
          </button>
        </div>

        {actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] px-4 py-10 text-center">
            <div className="text-3xl">🌱</div>
            <p className="mt-2 text-sm font-semibold text-[#2D5A3D]">
              아직 액션이 없어요
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {actions.map((a, index) => (
              <li
                key={index}
                className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#2D5A3D]">
                    <span>#{index + 1}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveAction(index, -1)}
                      disabled={index === 0}
                      className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-xs text-[#2D5A3D] transition hover:bg-[#E8F0E4] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="위로 이동"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveAction(index, 1)}
                      disabled={index === actions.length - 1}
                      className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1 text-xs text-[#2D5A3D] transition hover:bg-[#E8F0E4] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="아래로 이동"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAction(index)}
                      className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-red-600 transition hover:bg-red-50"
                      aria-label="삭제"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[#6B6560]">
                      채널
                    </label>
                    <select
                      value={a.type}
                      onChange={(e) =>
                        updateAction(index, {
                          type: e.target.value as ActionType,
                        })
                      }
                      className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm text-[#2C2C2C] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/30"
                    >
                      {ACTION_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.icon} {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[#6B6560]">
                      지연 시간 (시간 단위)
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={a.delayHours}
                      onChange={(e) =>
                        updateAction(index, {
                          delayHours: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm text-[#2C2C2C] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/30"
                    />
                  </div>
                </div>

                {a.type === "EMAIL" ? (
                  <div className="mt-3">
                    <label className="mb-1 block text-[11px] font-semibold text-[#6B6560]">
                      제목
                    </label>
                    <input
                      type="text"
                      value={a.title}
                      onChange={(e) =>
                        updateAction(index, { title: e.target.value })
                      }
                      className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm text-[#2C2C2C] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/30"
                    />
                  </div>
                ) : null}

                <div className="mt-3">
                  <label className="mb-1 block text-[11px] font-semibold text-[#6B6560]">
                    본문
                  </label>
                  <textarea
                    value={a.body}
                    onChange={(e) =>
                      updateAction(index, { body: e.target.value })
                    }
                    rows={3}
                    className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm text-[#2C2C2C] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/30"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
        >
          ⚠️ {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {savedAt ? (
          <span className="text-xs text-[#6B6560]">
            ✅ {savedAt} 저장됨
          </span>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A7A52] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "저장 중..." : "💾 변경사항 저장"}
        </button>
      </div>
    </form>
  );
}
