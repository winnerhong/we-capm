"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createMissionAction } from "../actions";
import type { TemplateType } from "@/lib/supabase/database.types";
import { getTemplateById, type MissionTemplate } from "@/lib/mission-templates";

const TEMPLATES: { value: TemplateType; label: string; description: string }[] = [
  { value: "PHOTO", label: "📸 사진 숲길", description: "지정된 장면을 촬영해 인증" },
  { value: "QUIZ", label: "✍️ 퀴즈", description: "질문에 정답 입력 (자동 채점 가능)" },
  { value: "LOCATION", label: "📍 위치 숲길", description: "특정 장소 방문 GPS 자동 인증" },
  { value: "VIDEO", label: "🎥 영상 숲길", description: "짧은 영상 촬영 후 업로드" },
  { value: "TIMEATTACK", label: "🏃 타임어택", description: "제한시간 내 수행 + 카운트다운" },
];

export default function NewMissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);

  return (
    <Suspense fallback={<div className="p-4 text-sm text-neutral-500">불러오는 중…</div>}>
      <NewMissionForm eventId={eventId} />
    </Suspense>
  );
}

function NewMissionForm({ eventId }: { eventId: string }) {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const prefill: MissionTemplate | undefined = templateId
    ? getTemplateById(templateId)
    : undefined;

  const [template, setTemplate] = useState<TemplateType>(prefill?.template_type ?? "PHOTO");

  // Narrowed config values for prefill display.
  const cfg = prefill?.config ?? {};
  const photoMin = typeof cfg.photo_min === "number" ? String(cfg.photo_min) : "1";
  const photoMax = typeof cfg.photo_max === "number" ? String(cfg.photo_max) : "3";
  const quizQuestion = typeof cfg.quiz_question === "string" ? cfg.quiz_question : "";
  const quizAnswer = typeof cfg.quiz_answer === "string" ? cfg.quiz_answer : "";
  const videoMaxDuration =
    typeof cfg.video_max_duration === "number" ? String(cfg.video_max_duration) : "30";
  const timeLimit = typeof cfg.time_limit === "number" ? String(cfg.time_limit) : "60";

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <Link
          href={`/admin/events/${eventId}/missions`}
          className="text-sm text-neutral-500 hover:underline"
        >
          ← 숲길 목록
        </Link>
        <h1 className="text-2xl font-bold">새 숲길</h1>
      </div>

      {prefill && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm"
        >
          <span className="text-xl" aria-hidden="true">
            {prefill.icon}
          </span>
          <div className="flex-1">
            <div className="font-semibold text-violet-900">✨ 템플릿 적용됨</div>
            <div className="text-violet-700">
              <span className="font-medium">{prefill.title}</span> · 🌰 {prefill.points}
            </div>
          </div>
          <Link
            href={`/admin/events/${eventId}/missions/new`}
            className="shrink-0 rounded border border-violet-300 bg-white px-2 py-1 text-xs text-violet-700 hover:bg-violet-100"
          >
            초기화
          </Link>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">숲길 종류</label>
        <div className="grid grid-cols-1 gap-2">
          {TEMPLATES.map((t) => {
            const disabled = false;
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
        // Keying on prefill id forces re-mount so defaultValue fields update cleanly
        // when admin navigates between templates.
        key={prefill?.id ?? "blank"}
        action={createMissionAction.bind(null, eventId)}
        className="space-y-4 rounded-lg border bg-white p-6"
      >
        <input type="hidden" name="template_type" value={template} />

        <Field
          label="숲길 이름"
          name="title"
          required
          placeholder="가족 사진 찍기"
          defaultValue={prefill?.title}
        />
        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium">
            설명
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={3}
            placeholder="가족 모두 나오게 사진 한 장 찍어주세요"
            defaultValue={prefill?.instruction ?? prefill?.description}
            className="w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <Field
          label="도토리 배점"
          name="points"
          type="number"
          required
          defaultValue={prefill ? String(prefill.points) : "10"}
        />

        {template === "PHOTO" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="최소 장수" name="photo_min" type="number" defaultValue={photoMin} />
            <Field label="최대 장수" name="photo_max" type="number" defaultValue={photoMax} />
          </div>
        )}

        {template === "QUIZ" && (
          <>
            <Field
              label="질문"
              name="quiz_question"
              required
              placeholder="토리로의 첫 글자는?"
              defaultValue={quizQuestion}
            />
            <Field
              label="정답"
              name="quiz_answer"
              required
              placeholder="캠"
              defaultValue={quizAnswer}
            />
            <div>
              <label htmlFor="quiz_type" className="mb-1 block text-sm font-medium">
                유형
              </label>
              <select
                id="quiz_type"
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
              <Field
                label="위도 (lat)"
                name="loc_lat"
                type="number"
                required
                placeholder="37.5665"
              />
              <Field
                label="경도 (lng)"
                name="loc_lng"
                type="number"
                required
                placeholder="126.9780"
              />
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

        {template === "VIDEO" && (
          <Field
            label="최대 길이 (초)"
            name="video_max_duration"
            type="number"
            defaultValue={videoMaxDuration}
          />
        )}

        {template === "TIMEATTACK" && (
          <Field
            label="제한시간 (초)"
            name="time_limit"
            type="number"
            required
            defaultValue={timeLimit}
          />
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="auto_approve"
            defaultChecked={prefill ? prefill.auto_approve : template === "QUIZ"}
          />
          자동 승인 (제출 즉시 도토리 반영)
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
