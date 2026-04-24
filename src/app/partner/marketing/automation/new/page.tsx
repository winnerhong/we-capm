"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  TRIGGER_OPTIONS,
  ACTION_TYPE_OPTIONS,
  type ActionType,
  type AutomationAction,
  type TriggerType,
} from "../types";
import { createAutomationAction } from "../actions";

export default function NewAutomationPage() {
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<TriggerType | "">("");
  const [actions, setActions] = useState<AutomationAction[]>([]);
  const [error, setError] = useState<string | null>(null);
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
    if (!trigger) {
      setError("트리거를 선택해 주세요");
      return;
    }
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
        await createAutomationAction(formData);
      } catch (e) {
        if (e instanceof Error && !e.message.includes("NEXT_REDIRECT")) {
          setError(e.message);
        }
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-[#6B6560]">
            <Link
              href="/partner/marketing/automation"
              className="hover:underline"
            >
              ← 자동화 시나리오
            </Link>
          </div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#2D5A3D] md:text-3xl">
            <span>🛠️</span>
            <span>빈 시나리오 만들기</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6560]">
            트리거와 액션을 자유롭게 조합해보세요 🌿
          </p>
        </div>
      </div>

      <form action={handleSubmit} className="space-y-6">
        <input type="hidden" name="actions" value={actionsJson} />
        <input type="hidden" name="trigger_type" value={trigger} />

        {/* 시나리오 이름 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <label
            htmlFor="name"
            className="mb-2 block text-sm font-bold text-[#2D5A3D]"
          >
            📝 시나리오 이름
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 신규 고객 환영 시나리오"
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] outline-none transition focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/30"
            autoComplete="off"
          />
        </section>

        {/* 트리거 선택 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
            <span>⚡</span>
            <span>1단계: 언제 실행할까요?</span>
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
                    <span
                      aria-hidden
                      className="shrink-0 text-lg text-[#2D5A3D]"
                    >
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
              <span>2단계: 무엇을 보낼까요?</span>
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
              <p className="mt-1 text-xs text-[#6B6560]">
                ➕ 액션 추가 버튼으로 시작하세요
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
                    {/* 타입 */}
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

                    {/* 지연 시간 */}
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
                      <p className="mt-1 text-[10px] text-[#6B6560]">
                        0 = 즉시 · 24 = 하루 뒤 · 168 = 일주일 뒤
                      </p>
                    </div>
                  </div>

                  {/* 제목 (이메일만) */}
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
                        placeholder="예) 오늘만 특별 할인!"
                        className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm text-[#2C2C2C] outline-none focus:border-[#2D5A3D] focus:ring-2 focus:ring-[#2D5A3D]/30"
                      />
                    </div>
                  ) : null}

                  {/* 본문 */}
                  <div className="mt-3">
                    <label className="mb-1 block text-[11px] font-semibold text-[#6B6560]">
                      본문 ({"{이름}"}, {"{쿠폰코드}"} 변수 사용 가능)
                    </label>
                    <textarea
                      value={a.body}
                      onChange={(e) =>
                        updateAction(index, { body: e.target.value })
                      }
                      rows={3}
                      placeholder="예) {이름}님, 토리로에 오신 걸 환영해요 🌲"
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

        {/* 저장 버튼 */}
        <div className="flex items-center justify-end gap-2">
          <Link
            href="/partner/marketing/automation"
            className="inline-flex items-center rounded-xl border border-[#D4E4BC] bg-white px-4 py-2 text-sm font-semibold text-[#2D5A3D] transition hover:bg-[#E8F0E4]"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A7A52] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "저장 중..." : "💾 시나리오 저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
