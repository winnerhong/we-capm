import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateMissionAction } from "../actions";

export const dynamic = "force-dynamic";

const TEMPLATE_LABEL: Record<string, string> = {
  PHOTO: "📸 사진 숲길",
  VIDEO: "🎥 영상 숲길",
  LOCATION: "📍 위치 숲길",
  QUIZ: "✍️ 퀴즈",
  MIXED: "🎯 복합 숲길",
  TEAM: "🤝 팀 협력",
  TIMEATTACK: "🏃 타임어택",
};

export default async function EditMissionPage({
  params,
}: {
  params: Promise<{ id: string; missionId: string }>;
}) {
  const { id: eventId, missionId } = await params;
  const supabase = await createClient();

  const { data: mission } = await supabase
    .from("missions")
    .select("*")
    .eq("id", missionId)
    .single();
  if (!mission || mission.event_id !== eventId) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link
        href={`/admin/events/${eventId}/missions`}
        className="text-sm text-neutral-500 hover:underline"
      >
        ← 숲길 목록
      </Link>

      <div>
        <p className="text-sm text-neutral-500">
          {TEMPLATE_LABEL[mission.template_type] ?? mission.template_type}
        </p>
        <h1 className="text-2xl font-bold">숲길 편집</h1>
      </div>

      <form
        action={updateMissionAction.bind(null, eventId, missionId)}
        className="space-y-4 rounded-lg border bg-white p-6"
      >
        <Field label="숲길 이름" name="title" required defaultValue={mission.title} />
        <div>
          <label className="mb-1 block text-sm font-medium">설명</label>
          <textarea
            name="description"
            required
            rows={3}
            defaultValue={mission.description}
            className="w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <Field
          label="도토리 배점"
          name="points"
          type="number"
          required
          defaultValue={String(mission.points)}
        />

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="auto_approve" defaultChecked={mission.auto_approve} />
          자동 승인 (제출 즉시 도토리 반영)
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700"
        >
          저장
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
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
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
        defaultValue={defaultValue}
        className="w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  );
}
