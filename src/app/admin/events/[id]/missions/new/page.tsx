"use client";

import { useState } from "react";
import Link from "next/link";
import { use } from "react";
import { createMissionAction } from "../actions";
import type { TemplateType } from "@/lib/supabase/database.types";

const TEMPLATES: { value: TemplateType; label: string; description: string }[] = [
  { value: "PHOTO", label: "📸 사진 미션", description: "지정된 장면을 촬영해 인증" },
  { value: "QUIZ", label: "✍️ 퀴즈", description: "질문에 정답 입력 (자동 채점 가능)" },
  { value: "LOCATION", label: "📍 위치 미션", description: "특정 장소 방문 GPS 자동 인증" },
  { value: "VIDEO", label: "🎥 영상 미션", description: "짧은 영상 촬영 (추후)" },
  { value: "TIMEATTACK", label: "🏃 타임어택", description: "제한시간 내 수행 (추후)" },
];

export default function NewMissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const [template, setTemplate] = useState<TemplateType>("PHOTO");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <Link
          href={`/admin/events/${eventId}/missions`}
          className="text-sm text-neutral-500 hover:underline"
        >
          ← 미션 목록
        </Link>
        <h1 className="text-2xl font-bold">새 미션</h1>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">미션 종류</label>
        <div className="grid grid-cols-1 gap-2">
          {TEMPLATES.map((t) => {
            const disabled = t.value === "VIDEO" || t.value === "TIMEATTACK";
            return (
              <button
                key={t.value}
                type="button"
                disabled={disabled}
                onClick={() => setTemplate(t.value)}
                className={`rounded-lg border p-3 text-left transition ${
                  template === t.value
                    ? "border-violet-600 bg-violet-50"
                    : "border-neutral-200 hover:border-neutral-400"
                } ${disabled ? "opacity-40" : ""}`}
              >
                <div className="font-semibold">{t.label}</div>
                <div className="text-xs text-neutral-500">{t.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      <form
        action={createMissionAction.bind(null, eventId)}
        className="space-y-4 rounded-lg border bg-white p-6"
      >
        <input type="hidden" name="template_type" value={template} />

        <Field label="미션명" name="title" required placeholder="가족 사진 찍기" />
        <div>
          <label className="mb-1 block text-sm font-medium">설명</label>
          <textarea
            name="description"
            required
            rows={3}
            placeholder="가족 모두 나오게 사진 한 장 찍어주세요"
            className="w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <Field label="배점" name="points" type="number" required defaultValue="10" />

        {template === "PHOTO" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="최소 장수" name="photo_min" type="number" defaultValue="1" />
            <Field label="최대 장수" name="photo_max" type="number" defaultValue="3" />
          </div>
        )}

        {template === "QUIZ" && (
          <>
            <Field label="질문" name="quiz_question" required placeholder="캠프닉의 첫 글자는?" />
            <Field label="정답" name="quiz_answer" required placeholder="캠" />
            <div>
              <label className="mb-1 block text-sm font-medium">유형</label>
              <select
                name="quiz_type"
                defaultValue="SUBJECTIVE"
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="SUBJECTIVE">주관식 (정답 일치 자동 채점)</option>
                <option value="OBJECTIVE">객관식</option>
              </select>
            </div>
          </>
        )}

        {template === "LOCATION" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="위도 (lat)" name="loc_lat" type="number" required placeholder="37.5665" />
              <Field label="경도 (lng)" name="loc_lng" type="number" required placeholder="126.9780" />
            </div>
            <Field
              label="반경 (미터)"
              name="loc_radius"
              type="number"
              required
              defaultValue="50"
            />
            <p className="text-xs">
              📍 구글 지도에서 장소를 우클릭하면 좌표가 나옵니다. 반경은 50m 이상 권장.
            </p>
          </>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="auto_approve" defaultChecked={template === "QUIZ"} />
          자동 승인 (제출 즉시 점수 반영)
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700"
        >
          만들기
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  );
}
