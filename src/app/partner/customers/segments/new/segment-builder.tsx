"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { createSegmentAction, previewSegmentCountAction } from "../actions";
import type { SegmentType } from "../actions";

type Rule = {
  id: number;
  field: string;
  op: ">" | "<" | "=" | ">=" | "<=" | "contains";
  value: string;
};

const ICONS = ["🎯", "👑", "💖", "⚠️", "💤", "🎂", "🌟", "🔥", "💰", "🌱"];

const TYPE_FIELDS: Record<SegmentType, { value: string; label: string; type: "number" | "text" }[]> = {
  CUSTOMER: [
    { value: "total_spent", label: "총매출", type: "number" },
    { value: "total_events", label: "참여 횟수", type: "number" },
    { value: "ltv", label: "LTV", type: "number" },
    { value: "tier", label: "티어", type: "text" },
    { value: "status", label: "상태", type: "text" },
    { value: "source", label: "유입 경로", type: "text" },
  ],
  ORG: [
    { value: "children_count", label: "원아 수", type: "number" },
    { value: "class_count", label: "반 수", type: "number" },
    { value: "org_type", label: "기관 유형", type: "text" },
    { value: "status", label: "상태", type: "text" },
  ],
  COMPANY: [
    { value: "total_revenue", label: "총매출", type: "number" },
    { value: "total_contracts", label: "총 계약", type: "number" },
    { value: "active_contracts", label: "활성 계약", type: "number" },
    { value: "industry", label: "산업", type: "text" },
    { value: "status", label: "상태", type: "text" },
  ],
  MIXED: [
    { value: "status", label: "상태", type: "text" },
    { value: "created_at", label: "등록일", type: "text" },
  ],
};

const OPS: { value: Rule["op"]; label: string }[] = [
  { value: ">", label: ">  초과" },
  { value: ">=", label: "≥  이상" },
  { value: "<", label: "<  미만" },
  { value: "<=", label: "≤  이하" },
  { value: "=", label: "=  같음" },
  { value: "contains", label: "∋  포함" },
];

export function SegmentBuilder() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [color, setColor] = useState("#7c3aed");
  const [segmentType, setSegmentType] = useState<SegmentType>("CUSTOMER");
  const [combinator, setCombinator] = useState<"AND" | "OR">("AND");
  const [rules, setRules] = useState<Rule[]>([
    { id: 1, field: TYPE_FIELDS.CUSTOMER[0].value, op: ">", value: "" },
  ]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, startPreview] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // segmentType 변경 시 첫 필드로 초기화
  useEffect(() => {
    setRules((prev) =>
      prev.map((r) => ({
        ...r,
        field: TYPE_FIELDS[segmentType][0]?.value ?? r.field,
      }))
    );
  }, [segmentType]);

  // 규칙 변경 debounce 미리보기
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      const valid = rules.filter((r) => r.field && r.value.trim() !== "");
      if (valid.length === 0) {
        setPreviewCount(null);
        return;
      }
      startPreview(async () => {
        try {
          const count = await previewSegmentCountAction(segmentType, {
            combinator,
            conditions: valid.map((r) => {
              const num = Number(r.value);
              return {
                field: r.field,
                op: r.op,
                value: Number.isFinite(num) && r.value.trim() !== "" ? num : r.value,
              };
            }),
          });
          setPreviewCount(count);
        } catch {
          setPreviewCount(null);
        }
      });
    }, 400);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [rules, segmentType, combinator]);

  function addRule() {
    const nextId = Math.max(0, ...rules.map((r) => r.id)) + 1;
    setRules([
      ...rules,
      { id: nextId, field: TYPE_FIELDS[segmentType][0]?.value ?? "", op: ">", value: "" },
    ]);
  }

  function removeRule(id: number) {
    setRules(rules.filter((r) => r.id !== id));
  }

  function updateRule(id: number, patch: Partial<Rule>) {
    setRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);
    formData.set("icon", icon);
    formData.set("color", color);
    formData.set("segment_type", segmentType);
    formData.set("combinator", combinator);
    rules.forEach((r, i) => {
      if (!r.field || r.value.trim() === "") return;
      formData.set(`rule_field_${i + 1}`, r.field);
      formData.set(`rule_op_${i + 1}`, r.op);
      formData.set(`rule_value_${i + 1}`, r.value);
    });

    startSubmit(async () => {
      try {
        await createSegmentAction(formData);
      } catch (err) {
        alert(err instanceof Error ? err.message : "저장 실패");
      }
    });
  }

  const fields = TYPE_FIELDS[segmentType];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 기본 정보 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>📝</span>
          <span>기본 정보</span>
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-semibold text-[#2C2C2C]">
              이름 <span className="text-rose-500">*</span>
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 고액 결제 VIP 가족"
              required
              maxLength={60}
              className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </div>
          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-semibold text-[#2C2C2C]">
              설명
            </label>
            <input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="선택"
              maxLength={200}
              className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-semibold text-[#2C2C2C]">아이콘</span>
            <div className="flex flex-wrap gap-1">
              {ICONS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  onClick={() => setIcon(ic)}
                  aria-label={`아이콘 ${ic}`}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl transition ${
                    icon === ic
                      ? "border-violet-500 bg-violet-50 ring-2 ring-violet-200"
                      : "border-[#D4E4BC] bg-white hover:bg-[#FFF8F0]"
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="color" className="mb-1 block text-sm font-semibold text-[#2C2C2C]">
              색상
            </label>
            <div className="flex items-center gap-2">
              <input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 cursor-pointer rounded-xl border border-[#D4E4BC]"
              />
              <span className="text-xs text-[#6B6560]">{color}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 대상 유형 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
          <span>🎯</span>
          <span>대상 유형</span>
        </h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {(
            [
              { v: "ORG", label: "🏫 기관" },
              { v: "CUSTOMER", label: "👨‍👩‍👧 개인" },
              { v: "COMPANY", label: "🏢 기업" },
              { v: "MIXED", label: "🔀 혼합" },
            ] as { v: SegmentType; label: string }[]
          ).map((t) => (
            <button
              type="button"
              key={t.v}
              onClick={() => setSegmentType(t.v)}
              aria-pressed={segmentType === t.v}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                segmentType === t.v
                  ? "border-violet-500 bg-violet-100 text-violet-800 ring-2 ring-violet-200"
                  : "border-[#D4E4BC] bg-white text-[#2C2C2C] hover:bg-[#FFF8F0]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* 규칙 빌더 */}
      <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span>🧩</span>
            <span>규칙</span>
          </h2>
          <div className="inline-flex rounded-lg border border-[#D4E4BC] bg-[#F5F1E8] p-0.5">
            {(["AND", "OR"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCombinator(c)}
                aria-pressed={combinator === c}
                className={`rounded-md px-3 py-1 text-xs font-bold transition ${
                  combinator === c
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-[#6B6560] hover:text-[#2C2C2C]"
                }`}
              >
                {c === "AND" ? "모두 (AND)" : "하나라도 (OR)"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {rules.map((r, i) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3"
            >
              <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded bg-violet-100 px-1.5 text-[10px] font-bold text-violet-700">
                {i === 0 ? "WHERE" : combinator}
              </span>
              <select
                value={r.field}
                onChange={(e) => updateRule(r.id, { field: e.target.value })}
                aria-label="필드"
                className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none"
              >
                {fields.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                value={r.op}
                onChange={(e) => updateRule(r.id, { op: e.target.value as Rule["op"] })}
                aria-label="조건"
                className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none"
              >
                {OPS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                value={r.value}
                onChange={(e) => updateRule(r.id, { value: e.target.value })}
                placeholder="값"
                aria-label="값"
                inputMode={
                  fields.find((f) => f.value === r.field)?.type === "number" ? "numeric" : "text"
                }
                className="min-w-0 flex-1 rounded-lg border border-[#D4E4BC] bg-white px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none"
              />
              {rules.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRule(r.id)}
                  aria-label="규칙 삭제"
                  className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRule}
          className="mt-3 w-full rounded-xl border-2 border-dashed border-[#D4E4BC] bg-white px-3 py-2 text-sm font-semibold text-[#6B6560] transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700"
        >
          ➕ 규칙 추가
        </button>
      </section>

      {/* 실시간 미리보기 + 저장 */}
      <section className="sticky bottom-0 rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
              미리보기
            </p>
            <p className="mt-1 text-2xl font-extrabold text-violet-900">
              {previewing ? (
                <span className="text-violet-600">계산 중...</span>
              ) : previewCount == null ? (
                <span className="text-[#6B6560]">규칙을 입력해 주세요</span>
              ) : (
                <>
                  이 규칙에 <span className="text-3xl">{previewCount.toLocaleString("ko-KR")}</span>
                  명 일치
                </>
              )}
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting || !name}
            className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "저장 중..." : "💾 저장"}
          </button>
        </div>
      </section>
    </form>
  );
}
